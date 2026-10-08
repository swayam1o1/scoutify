const jwt = require('jsonwebtoken');
const { findAccountById } = require('./accountLookupService');
const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { sanitizeArtisanForUser } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const {
  parseIntentResponse,
  withQueryFallbacks,
  regexExtract,
  buildIntentPrompt,
  buildFallbackSuggestions,
  serviceOrConditions
} = require('../utils/searchIntent');
const { getGenerativeModel, generateWithRetry, embedText } = require('./geminiService');
const { parseImageDataUrl } = require('../utils/imageUpload');
const { asString, buildClientImagePrompt, parseClientImageJson, imagePart } = require('../utils/visualSearch');
const { getClientPreferences } = require('../utils/clientPreferences');
const { buildSearchTerms, searchTermsFilter, scoreSearchTerms } = require('../utils/searchTerms');
const { locationFilter } = require('../utils/locations');
const { JWT_SECRET, isSessionValid } = require('../middleware/auth');
const {
  applyPreferences,
  imageMatchPercentage,
  escapeRegex,
  imageReasoning,
  toMatchedItem,
  semanticSearch
} = require('./semanticRankingService');

const IMAGE_RESULT_LIMIT = 6;
const TEXT_RESULT_LIMIT = 50;
// Basic plan sees this many AI leads per search; the rest are never sent and unlock with Pro.
const BASIC_AI_RESULT_LIMIT = 5;
// Past these, search carries on with the regex intent / keyword matches instead of waiting.
const INTENT_TIMEOUT_MS = 4000;
const EMBED_TIMEOUT_MS = 3000;
const RANK_TIMEOUT_MS = 5000;
const VISION_TIMEOUT_MS = 10000;
// Vector neighbours with no query word in their listing are only kept when clearly similar;
// otherwise any vendor in the right city surfaces as a "match".
const MIN_SEMANTIC_WITHOUT_KEYWORDS = 0.62;

function extractedTerms(extracted) {
  return buildSearchTerms(extracted.productType, extracted.service, extracted.material, extracted.synonyms || []);
}

// Listings that mention the brief's words (or synonyms) by name, specialization, products or
// catalogue. Covers the many vendors that have no embedding yet.
async function keywordMatches(extracted, terms, { excludeIds = [], limit }) {
  const termsFilter = searchTermsFilter(terms);
  if (!termsFilter || limit <= 0) return [];
  const query = includeCity => {
    const conditions = [PUBLIC_STATUS_FILTER, termsFilter, { _id: { $nin: excludeIds } }];
    const locationCondition = includeCity && locationFilter(extracted.city);
    if (locationCondition) conditions.push(locationCondition);
    return { $and: conditions };
  };
  let docs = await Artisan.find(query(true)).select('-embedding -catalogue.embedding').lean();
  if (docs.length === 0 && extracted.city && excludeIds.length === 0) {
    docs = await Artisan.find(query(false)).select('-embedding -catalogue.embedding').lean();
  }
  return docs
    .map(artisan => ({ artisan, relevance: scoreSearchTerms(artisan, terms) }))
    .sort((left, right) => right.relevance.matchedWords - left.relevance.matchedWords || right.relevance.score - left.relevance.score)
    .slice(0, limit)
    .map(({ artisan, relevance }) => ({
      ...sanitizeArtisanForUser(artisan),
      matchedItems: keywordCatalogueMatches(artisan.catalogue, extracted),
      matchPercentage: Math.min(90, 50 + relevance.matchedWords * 10 + relevance.score * 3),
      aiReasoning: `Listing mentions ${extracted.productType || extracted.service || 'what you searched for'} in its ${relevance.score >= 3 ? 'specialization, products or catalogue' : 'name or description'}.`
    }));
}

function catalogueOrConditions(extracted) {
  const terms = [extracted.productType, extracted.service, extracted.material, ...(extracted.synonyms || [])]
    .map(term => asString(term, 60).toLowerCase())
    .filter(Boolean);
  const unique = [...new Set(terms)];
  if (unique.length === 0) return [];
  return unique.flatMap(term => {
    const regex = { $regex: escapeRegex(term), $options: 'i' };
    return [
      { 'catalogue.title': regex },
      { 'catalogue.category': regex },
      { 'catalogue.material': regex },
      { 'catalogue.tags': regex }
    ];
  });
}

function buildDbQuery(extracted, { includeCity = true } = {}) {
  const conditions = [PUBLIC_STATUS_FILTER];
  const serviceFilter = serviceOrConditions(extracted);
  const catalogueFilter = catalogueOrConditions(extracted);
  const termsFilter = searchTermsFilter(extractedTerms(extracted));
  const orConditions = [...(serviceFilter?.$or || []), ...catalogueFilter, ...(termsFilter?.$or || [])];
  if (orConditions.length) conditions.push({ $or: orConditions });
  const locationCondition = includeCity && locationFilter(extracted.city);
  if (locationCondition) conditions.push(locationCondition);
  return { $and: conditions };
}

// Keyword match against catalogue items, used when embeddings are unavailable.
function keywordCatalogueMatches(catalogue, extracted, limit = 3) {
  const terms = [extracted.productType, extracted.service, extracted.material, ...(extracted.synonyms || [])]
    .map(term => asString(term, 60).toLowerCase())
    .filter(Boolean);
  if (terms.length === 0) return [];
  return (catalogue || [])
    .filter(item => {
      const haystack = [item.title, item.category, item.material, ...(item.tags || [])].join(' ').toLowerCase();
      return terms.some(term => haystack.includes(term));
    })
    .slice(0, limit)
    .map(item => toMatchedItem(item, null));
}

function fallbackSummary(extracted, resultCount) {
  const bits = [];
  if (extracted.productType || extracted.service) bits.push(`for ${extracted.productType || extracted.service}`);
  if (extracted.city || extracted.location) bits.push(`in ${extracted.city || extracted.location}`);
  if (extracted.useCase) bits.push(`(${extracted.useCase})`);
  if (extracted.material) bits.push(`material: ${extracted.material}`);
  if (extracted.budgetMax) bits.push(`budget up to ₹${Math.round(extracted.budgetMax).toLocaleString('en-IN')}`);
  const focus = bits.length ? bits.join(' ') : 'for your brief';
  if (resultCount === 0) return `No verified vendors matched ${focus}. Try broadening the category or city.`;
  return `Found ${resultCount} verified vendor${resultCount === 1 ? '' : 's'} ${focus}. Rankings use AI interpretation of your prompt plus profile similarity.`;
}

/**
 * Returns the signed-in user for an Authorization header. AI Sourcing keeps its own
 * messages (and answers 401 for deleted/suspended accounts), so it does not use requireAuth.
 */
async function authenticateClient(authHeader) {
  if (!authHeader) {
    throw new HttpError(401, 'Authentication required to use AI Sourcing.');
  }
  let decoded;
  let user;
  try {
    const token = authHeader.split(' ')[1];
    decoded = jwt.verify(token, JWT_SECRET);
    user = await findAccountById(decoded.id, decoded.role);
  } catch (err) {
    throw new HttpError(401, 'Invalid token.');
  }
  if (!user || !isSessionValid(decoded, user) || user.isDeleted || user.isSuspended) {
    throw new HttpError(401, 'Session expired. Please sign in again.', { code: 'SESSION_REVOKED' });
  }
  return user;
}

function validateTextQuery(query) {
  if (!query || !query.trim()) {
    throw new HttpError(400, 'Search brief query is required.');
  }
}

function capForPlan(allResults, user) {
  const isBasic = (user ? user.subscriptionPlan : 'basic') === 'basic';
  const totalResults = allResults.length;
  return {
    results: isBasic ? allResults.slice(0, BASIC_AI_RESULT_LIMIT) : allResults,
    totalResults,
    paywallActive: isBasic && totalResults > BASIC_AI_RESULT_LIMIT,
    resultLimit: isBasic ? BASIC_AI_RESULT_LIMIT : null
  };
}

/**
 * Text AI search. Returns the response `payload` plus the `search` record to log
 * (via recordSearchAndNotify) once the response has been sent.
 */
async function textSearch(query, user) {
  const prefs = getClientPreferences(user);
  const reply = payload => {
    const { results, totalResults, paywallActive, resultLimit } = capForPlan(payload.results, user);
    return {
      payload: {
        ...payload,
        results,
        totalResults,
        paywallActive,
        resultLimit,
        personalized: Boolean(prefs)
      },
      search: {
        searchType: 'ai_text',
        query,
        extracted: payload.extracted,
        results,
        simulated: payload.simulated
      }
    };
  };

  const model = getGenerativeModel();
  if (model) {
    try {
      // Step 1: Structured intent extraction (SRS §5.1 + synonyms §5.2) and related prompts, in one call.
      let extracted;
      let aiSuggestions = [];
      try {
        const intentResult = await model.generateContent(buildIntentPrompt(query), { timeout: INTENT_TIMEOUT_MS });
        ({ extracted, suggestions: aiSuggestions } = parseIntentResponse(intentResult.response.text().trim(), query));
      } catch (intentError) {
        console.warn('Gemini intent unavailable, using regex fallback:', intentError.message);
        extracted = regexExtract(query);
      }
      extracted = withQueryFallbacks(extracted, query);
      const suggestions = aiSuggestions.length ? aiSuggestions : buildFallbackSuggestions(query, extracted);

      const semanticQuery = extracted.expandedQuery || query;
      const terms = extractedTerms(extracted);

      // Prefer vector ranking when embeddings exist (vendor profiles + catalogue items)
      let semanticResults = [];
      try {
        const queryEmbedding = await embedText(semanticQuery, { timeout: EMBED_TIMEOUT_MS });
        if (queryEmbedding) {
          semanticResults = (await semanticSearch(queryEmbedding, semanticQuery, {
            city: extracted.city,
            extracted,
            limit: TEXT_RESULT_LIMIT,
            prefs
          })).filter(artisan => terms.length === 0
            || scoreSearchTerms(artisan, terms).matchedWords > 0
            || artisan.semanticScore >= MIN_SEMANTIC_WITHOUT_KEYWORDS);
        }
      } catch (embeddingError) {
        console.warn('Semantic ranking unavailable, using keyword matches:', embeddingError.message);
      }

      const keywordResults = await keywordMatches(extracted, terms, {
        excludeIds: semanticResults.map(artisan => artisan._id),
        limit: TEXT_RESULT_LIMIT - semanticResults.length
      });

      if (semanticResults.length > 0 || keywordResults.length > 0) {
        const semanticHits = semanticResults.map(artisan => ({
          ...sanitizeArtisanForUser(artisan),
          matchPercentage: Math.max(0, Math.min(99, Math.round(artisan.combinedScore * 100))),
          aiReasoning: (artisan.matchedItems.length && artisan.itemScore >= artisan.semanticScore
            ? `Catalogue product "${artisan.matchedItems[0].title}" is a ${Math.round(artisan.itemScore * 100)}% semantic match`
            : `Ranked from ${Math.round(artisan.semanticScore * 100)}% semantic similarity`)
            + (extracted.material || extracted.useCase
              ? ` aligned with ${[extracted.material, extracted.useCase, extracted.designPreference].filter(Boolean).join(', ')}.`
              : ` and ${Math.round(artisan.nameScore * 100)}% name similarity.`)
        }));
        const results = [...semanticHits, ...applyPreferences(keywordResults, prefs, extracted)]
          .sort((left, right) => right.matchPercentage - left.matchPercentage);

        return reply({
          results,
          extracted,
          summary: fallbackSummary(extracted, results.length),
          suggestions,
          semantic: semanticHits.length > 0,
          simulated: false
        });
      }

      // Step 2: DB candidates via service synonyms + city
      let candidates = await Artisan.find(buildDbQuery(extracted)).select('-embedding -catalogue.embedding').limit(15);

      // Relax city if nothing found
      if (candidates.length === 0 && extracted.city) {
        candidates = await Artisan.find(buildDbQuery(extracted, { includeCity: false }))
          .select('-embedding -catalogue.embedding')
          .limit(15);
      }

      if (candidates.length === 0) {
        return reply({
          results: [],
          extracted,
          summary: fallbackSummary(extracted, 0),
          suggestions,
          simulated: false,
          message: 'No matching artisans found for the extracted keywords.'
        });
      }

      // Step 3: Gemini rank + reasoning
      const rankPrompt = `Client brief: "${query}"

Extracted attributes: ${JSON.stringify(extracted)}

Candidate vendors:
${JSON.stringify(candidates.map(c => ({
  id: c._id,
  name: c.companyName,
  city: c.city,
  specializations: c.specialization,
  products: c.products,
  catalogue: (c.catalogue || []).slice(0, 8).map(item => item.title),
  tags: c.customTags,
  description: (c.description || '').slice(0, 180)
})))}
${prefs ? `
Client's saved preferences (use only as a tie-breaker; the brief always wins): ${JSON.stringify({
  interests: prefs.interests,
  preferredLocations: extracted.city ? [] : prefs.locations
})}
` : ''}
Select up to 5 best matches. Prefer vendors that fit use-case, product/material, design preference, and city.
Return ONLY a JSON array: [{"id":"artisan_id","matchPercentage":95,"reasoning":"one sentence"}]
No markdown.`;

      let matchMetadata = [];
      try {
        const rankResult = await model.generateContent(rankPrompt, { timeout: RANK_TIMEOUT_MS });
        const cleanRankStr = rankResult.response.text().trim().replace(/```json/g, '').replace(/```/g, '').trim();
        matchMetadata = JSON.parse(cleanRankStr);
      } catch (rankError) {
        console.warn('Gemini ranking unavailable, using database order:', rankError.message);
      }

      const results = [];
      for (const meta of matchMetadata) {
        const artisan = candidates.find(c => c._id.toString() === String(meta.id));
        if (artisan) {
          results.push({
            ...sanitizeArtisanForUser(artisan),
            matchedItems: keywordCatalogueMatches(artisan.catalogue, extracted),
            matchPercentage: meta.matchPercentage,
            aiReasoning: meta.reasoning
          });
        }
      }

      if (results.length === 0) {
        candidates.slice(0, 5).forEach((c, idx) => {
          results.push({
            ...sanitizeArtisanForUser(c),
            matchedItems: keywordCatalogueMatches(c.catalogue, extracted),
            matchPercentage: 90 - idx * 5,
            aiReasoning: `Matched on ${[c.specialization?.join(', '), c.city].filter(Boolean).join(' · ')}.`
          });
        });
      }

      return reply({
        results: applyPreferences(results, prefs, extracted),
        extracted,
        summary: fallbackSummary(extracted, results.length),
        suggestions,
        simulated: false
      });
    } catch (err) {
      console.error('Gemini live pipeline error, falling back to simulation:', err.message);
    }
  }

  // --- Offline / no-key fallback ---
  const extracted = regexExtract(query);
  let candidates = await Artisan.find(buildDbQuery(extracted)).select('-embedding -catalogue.embedding').limit(TEXT_RESULT_LIMIT);
  if (candidates.length === 0 && extracted.service) {
    candidates = await Artisan.find({
      ...PUBLIC_STATUS_FILTER,
      specialization: { $regex: escapeRegex(extracted.service), $options: 'i' }
    }).select('-embedding -catalogue.embedding').limit(TEXT_RESULT_LIMIT);
  }

  const mockReasonings = [
    'Selected for profile alignment with your brief (category, city, and stated preferences).',
    'Local specialist whose tags and specialization overlap your extracted requirements.',
    'Strong candidate when weighing material / use-case keywords from your prompt.'
  ];

  const results = applyPreferences(candidates.map((c, idx) => ({
    ...sanitizeArtisanForUser(c),
    matchedItems: keywordCatalogueMatches(c.catalogue, extracted),
    matchPercentage: Math.max(40, 92 - idx * 6),
    aiReasoning: mockReasonings[idx] || `Verified specialist in ${c.city}.`
  })), prefs, extracted);

  return reply({
    results,
    extracted,
    summary: fallbackSummary(extracted, results.length),
    suggestions: buildFallbackSuggestions(query, extracted),
    simulated: true
  });
}

/**
 * Photo search: the photo is analysed in memory (never stored) and matched against
 * vendor catalogues. Returns the response `payload` plus the `search` record to log.
 */
async function imageSearch({ image: imageDataUrl, note: rawNote }, user) {
  const prefs = getClientPreferences(user);

  const image = parseImageDataUrl(imageDataUrl);
  const note = asString(rawNote, 500);

  const model = getGenerativeModel();
  let extracted = null;
  let aiSuggestions = [];
  if (model) {
    try {
      const visionResult = await generateWithRetry(model, [buildClientImagePrompt(note), imagePart(image)], {
        retries: 1,
        timeout: VISION_TIMEOUT_MS
      });
      ({ extracted, suggestions: aiSuggestions } = parseClientImageJson(visionResult.response.text().trim()));
    } catch (err) {
      console.warn('Gemini image analysis failed:', err.message);
    }
  }

  if (!extracted) {
    if (!note) {
      throw new HttpError(503, 'Photo search is temporarily unavailable. Add a short description of the item or use the text brief instead.');
    }
    extracted = regexExtract(note);
  }
  if (note) extracted = withQueryFallbacks(extracted, note);

  const briefForAi = note
    ? `Photo of ${extracted.productType || 'an item'} — client note: ${note}`
    : `Photo of ${[extracted.designPreference, extracted.material, extracted.productType].filter(Boolean).join(' ') || 'an item'}`;

  let results = [];
  try {
    const queryEmbedding = await embedText(extracted.expandedQuery || briefForAi, { timeout: EMBED_TIMEOUT_MS });
    if (queryEmbedding) {
      let semanticResults = await semanticSearch(queryEmbedding, extracted.expandedQuery, {
        city: extracted.city,
        extracted,
        limit: 6,
        mode: 'image',
        prefs
      });
      if (semanticResults.length === 0 && extracted.city) {
        semanticResults = await semanticSearch(queryEmbedding, extracted.expandedQuery, {
          extracted,
          limit: 6,
          mode: 'image',
          prefs
        });
      }
      results = semanticResults.map(({ profileTerms, ...artisan }) => ({
        ...sanitizeArtisanForUser(artisan),
        matchPercentage: imageMatchPercentage(artisan.combinedScore),
        aiReasoning: imageReasoning(artisan, extracted)
      }));
    }
  } catch (err) {
    console.warn('Image semantic ranking unavailable, using keyword match:', err.message);
  }

  // Top up with keyword matches on listing products / catalogue, covering vendors that
  // have no embedding yet and the case where the embedding service is down.
  const hasKeywordTerms = [extracted.productType, extracted.service, extracted.material, ...(extracted.synonyms || [])].some(Boolean);
  if (results.length < IMAGE_RESULT_LIMIT && hasKeywordTerms) {
    const seen = results.map(r => r._id);
    const keywordQuery = includeCity => ({
      $and: [buildDbQuery(extracted, { includeCity }), { _id: { $nin: seen } }]
    });
    const remaining = IMAGE_RESULT_LIMIT - results.length;
    let candidates = await Artisan.find(keywordQuery(true)).select('-embedding -catalogue.embedding').limit(remaining);
    if (candidates.length === 0 && extracted.city) {
      candidates = await Artisan.find(keywordQuery(false)).select('-embedding -catalogue.embedding').limit(remaining);
    }
    const floor = results.length ? Math.min(...results.map(r => r.matchPercentage)) : 85;
    results = results.concat(applyPreferences(candidates.map((c, idx) => {
      const matchedItems = keywordCatalogueMatches(c.catalogue, extracted);
      return {
        ...sanitizeArtisanForUser(c),
        matchedItems,
        matchPercentage: Math.max(40, (results.length ? floor - 5 : floor) - idx * 5),
        aiReasoning: matchedItems.length
          ? `Catalogue lists "${matchedItems[0].title}", matching ${extracted.productType || 'your photo'}.`
          : imageReasoning(c, extracted)
      };
    }), prefs, extracted));
  }

  const capped = capForPlan(results, user);
  return {
    payload: {
      results: capped.results,
      totalResults: capped.totalResults,
      paywallActive: capped.paywallActive,
      resultLimit: capped.resultLimit,
      extracted,
      summary: fallbackSummary(extracted, results.length),
      suggestions: aiSuggestions.length ? aiSuggestions : buildFallbackSuggestions(briefForAi, extracted),
      imageSearch: true,
      personalized: Boolean(prefs),
      simulated: !model
    },
    search: {
      searchType: 'ai_image',
      query: note || briefForAi,
      extracted,
      results: capped.results,
      simulated: !model
    }
  };
}

module.exports = {
  authenticateClient,
  validateTextQuery,
  textSearch,
  imageSearch,
  buildDbQuery,
  catalogueOrConditions,
  keywordCatalogueMatches,
  fallbackSummary
};
