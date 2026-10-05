const jwt = require('jsonwebtoken');
const { findAccountById } = require('./accountLookupService');
const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { sanitizeArtisanForUser } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const {
  parseExtractedJson,
  regexExtract,
  buildIntentPrompt,
  buildSummaryPrompt,
  buildSuggestionsPrompt,
  buildFallbackSuggestions,
  parseSuggestionsJson,
  serviceOrConditions
} = require('../utils/searchIntent');
const { getGenerativeModel, generateWithRetry, embedText } = require('./geminiService');
const { parseImageDataUrl } = require('../utils/imageUpload');
const { asString, buildClientImagePrompt, parseClientImageJson, imagePart } = require('../utils/visualSearch');
const { getClientPreferences } = require('../utils/clientPreferences');
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
  const orConditions = [...(serviceFilter?.$or || []), ...catalogueFilter];
  if (orConditions.length) conditions.push({ $or: orConditions });
  if (includeCity && extracted.city) {
    const cityRegex = { $regex: escapeRegex(extracted.city.trim()), $options: 'i' };
    conditions.push({ $or: [{ city: cityRegex }, { serviceArea: cityRegex }] });
  }
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

async function maybeSummarize(model, query, extracted, resultCount) {
  if (!model) return null;
  try {
    const summaryResult = await model.generateContent(buildSummaryPrompt(query, extracted, resultCount));
    const text = summaryResult.response.text().trim();
    return text || null;
  } catch (err) {
    console.warn('AI search summary skipped:', err.message);
    return null;
  }
}

async function maybeSuggestions(model, query, extracted) {
  const fallback = buildFallbackSuggestions(query, extracted);
  if (!model) return fallback;
  try {
    const result = await model.generateContent(buildSuggestionsPrompt(query, extracted));
    const parsed = parseSuggestionsJson(result.response.text().trim());
    if (parsed.length > 0) return parsed;
  } catch (err) {
    console.warn('AI search suggestions skipped:', err.message);
  }
  return fallback;
}

function fallbackSummary(extracted, resultCount) {
  const bits = [];
  if (extracted.city || extracted.location) bits.push(`near ${extracted.city || extracted.location}`);
  if (extracted.productType || extracted.service) bits.push(`for ${extracted.productType || extracted.service}`);
  if (extracted.useCase) bits.push(`(${extracted.useCase})`);
  if (extracted.material) bits.push(`material: ${extracted.material}`);
  if (extracted.budgetMax) bits.push(`budget up to ₹${Math.round(extracted.budgetMax).toLocaleString('en-IN')}`);
  const focus = bits.length ? bits.join(' ') : 'your brief';
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

/**
 * Text AI search. Returns the response `payload` plus the `search` record to log
 * (via recordSearchAndNotify) once the response has been sent.
 */
async function textSearch(query, user) {
  const prefs = getClientPreferences(user);
  const reply = payload => ({
    payload: { ...payload, personalized: Boolean(prefs) },
    search: {
      searchType: 'ai_text',
      query,
      extracted: payload.extracted,
      results: payload.results,
      simulated: payload.simulated
    }
  });

  const model = getGenerativeModel();
  if (model) {
    try {
      // Step 1: Structured intent extraction (SRS §5.1 + synonyms §5.2)
      let extracted;
      try {
        const intentResult = await model.generateContent(buildIntentPrompt(query));
        const intentText = intentResult.response.text().trim();
        extracted = parseExtractedJson(intentText);
      } catch (parseErr) {
        console.warn('Gemini intent parse failed, using regex fallback:', parseErr.message);
        extracted = regexExtract(query);
      }

      const semanticQuery = extracted.expandedQuery || query;

      // Prefer vector ranking when embeddings exist (vendor profiles + catalogue items)
      try {
        const queryEmbedding = await embedText(semanticQuery);
        const semanticResults = await semanticSearch(queryEmbedding, semanticQuery, {
          city: extracted.city,
          extracted,
          limit: 5,
          prefs
        });

        if (semanticResults.length > 0) {
          const results = semanticResults.map(artisan => ({
            ...sanitizeArtisanForUser(artisan),
            matchPercentage: Math.max(0, Math.min(99, Math.round(artisan.combinedScore * 100))),
            aiReasoning: (artisan.matchedItems.length && artisan.itemScore >= artisan.semanticScore
              ? `Catalogue product "${artisan.matchedItems[0].title}" is a ${Math.round(artisan.itemScore * 100)}% semantic match`
              : `Ranked from ${Math.round(artisan.semanticScore * 100)}% semantic similarity`)
              + (extracted.material || extracted.useCase
                ? ` aligned with ${[extracted.material, extracted.useCase, extracted.designPreference].filter(Boolean).join(', ')}.`
                : ` and ${Math.round(artisan.nameScore * 100)}% name similarity.`)
          }));
          const summary = (await maybeSummarize(model, query, extracted, results.length))
            || fallbackSummary(extracted, results.length);
          const suggestions = await maybeSuggestions(model, query, extracted);

          return reply({
            results,
            extracted,
            summary,
            suggestions,
            semantic: true,
            simulated: false
          });
        }
      } catch (embeddingError) {
        console.warn('Semantic ranking unavailable, continuing with AI ranking:', embeddingError.message);
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
        const summary = fallbackSummary(extracted, 0);
        const suggestions = await maybeSuggestions(model, query, extracted);
        return reply({
          results: [],
          extracted,
          summary,
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

      const rankResult = await model.generateContent(rankPrompt);
      const rankText = rankResult.response.text().trim();

      let matchMetadata = [];
      try {
        const cleanRankStr = rankText.replace(/```json/g, '').replace(/```/g, '').trim();
        matchMetadata = JSON.parse(cleanRankStr);
      } catch (e) {
        console.warn('Gemini JSON parse failed for ranking matching:', rankText);
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

      const summary = (await maybeSummarize(model, query, extracted, results.length))
        || fallbackSummary(extracted, results.length);
      const suggestions = await maybeSuggestions(model, query, extracted);

      return reply({
        results: applyPreferences(results, prefs, extracted),
        extracted,
        summary,
        suggestions,
        simulated: false
      });
    } catch (err) {
      console.error('Gemini live pipeline error, falling back to simulation:', err.message);
    }
  }

  // --- Offline / no-key fallback ---
  const extracted = regexExtract(query);
  let candidates = await Artisan.find(buildDbQuery(extracted)).select('-embedding -catalogue.embedding').limit(5);
  if (candidates.length === 0 && extracted.service) {
    candidates = await Artisan.find({
      ...PUBLIC_STATUS_FILTER,
      specialization: { $regex: escapeRegex(extracted.service), $options: 'i' }
    }).select('-embedding -catalogue.embedding').limit(5);
  }

  const mockReasonings = [
    'Selected for profile alignment with your brief (category, city, and stated preferences).',
    'Local specialist whose tags and specialization overlap your extracted requirements.',
    'Strong candidate when weighing material / use-case keywords from your prompt.'
  ];

  const results = applyPreferences(candidates.map((c, idx) => ({
    ...sanitizeArtisanForUser(c),
    matchedItems: keywordCatalogueMatches(c.catalogue, extracted),
    matchPercentage: 92 - idx * 6,
    aiReasoning: mockReasonings[idx] || `Verified specialist in ${c.city}.`
  })), prefs, extracted);

  await new Promise(resolve => setTimeout(resolve, 800));

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
  if (model) {
    try {
      const visionResult = await generateWithRetry(model, [buildClientImagePrompt(note), imagePart(image)]);
      extracted = parseClientImageJson(visionResult.response.text().trim());
    } catch (err) {
      console.warn('Gemini image analysis failed:', err.message);
    }
  }

  // If the vision call failed (quota / overload), further Gemini calls would almost
  // certainly fail too and only burn more quota, so summary and suggestions fall back.
  const followUpModel = extracted ? model : null;

  if (!extracted) {
    if (!note) {
      throw new HttpError(503, 'Photo search is temporarily unavailable. Add a short description of the item or use the text brief instead.');
    }
    extracted = regexExtract(note);
  }

  const briefForAi = note
    ? `Photo of ${extracted.productType || 'an item'} — client note: ${note}`
    : `Photo of ${[extracted.designPreference, extracted.material, extracted.productType].filter(Boolean).join(' ') || 'an item'}`;

  let results = [];
  try {
    const queryEmbedding = await embedText(extracted.expandedQuery || briefForAi);
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

  const summary = (await maybeSummarize(followUpModel, briefForAi, extracted, results.length))
    || fallbackSummary(extracted, results.length);
  const suggestions = await maybeSuggestions(followUpModel, briefForAi, extracted);

  return {
    payload: {
      results,
      extracted,
      summary,
      suggestions,
      imageSearch: true,
      personalized: Boolean(prefs),
      simulated: !model
    },
    search: {
      searchType: 'ai_image',
      query: note || briefForAi,
      extracted,
      results,
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
