const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
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
const { getGenerativeModel, generateWithRetry, embedText, cosineSimilarity } = require('../services/geminiService');
const { parseImageDataUrl, ImageUploadError } = require('../utils/imageUpload');
const { asString, buildClientImagePrompt, parseClientImageJson, imagePart } = require('../utils/visualSearch');
const { recordSearchAndNotify } = require('../services/searchNotificationService');
const { getClientPreferences, scorePreferences } = require('../utils/clientPreferences');

const { JWT_SECRET, isSessionValid } = require('../middleware/auth');

const MIN_ITEM_SCORE = 0.55;
const MIN_PROFILE_IMAGE_SCORE = 0.55;
// Onboarding preferences nudge ordering between similarly relevant vendors; they never outrank a clearly better match.
const PREF_INTEREST_BOOST = 0.04;
const PREF_LOCATION_BOOST = 0.05;

// Keyword / Gemini-ranked paths: attach preference reasons and float preferred vendors up among equals.
function applyPreferences(results, prefs, extracted) {
  if (!prefs) return results;
  return results
    .map((result, index) => {
      const { interestHits, locationHit, reasons } = scorePreferences(result, prefs, { explicitLocation: Boolean(extracted?.city) });
      const bonus = (interestHits.length ? 3 : 0) + (locationHit ? 4 : 0);
      return { result: { ...result, preferenceReasons: reasons, matchPercentage: Math.min(99, (Number(result.matchPercentage) || 0) + bonus) }, index };
    })
    .sort((left, right) => right.result.matchPercentage - left.result.matchPercentage || left.index - right.index)
    .map(entry => entry.result);
}

// Photo-to-profile cosine scores sit in a narrow band (~0.45 unrelated → ~0.85 near-identical),
// so spread them onto a readable 0–99 scale.
function imageMatchPercentage(combinedScore) {
  return Math.max(1, Math.min(99, Math.round(((combinedScore - 0.4) / 0.45) * 100)));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trigramSimilarity(leftValue, rightValue) {
  const left = `  ${leftValue.toLowerCase().trim()} `;
  const right = `  ${rightValue.toLowerCase().trim()} `;
  if (left.length < 3 || right.length < 3) return left === right ? 1 : 0;

  const trigrams = value => {
    const result = new Map();
    for (let index = 0; index <= value.length - 3; index++) {
      const gram = value.slice(index, index + 3);
      result.set(gram, (result.get(gram) || 0) + 1);
    }
    return result;
  };

  const leftTrigrams = trigrams(left);
  const rightTrigrams = trigrams(right);
  let intersection = 0;
  for (const [gram, count] of leftTrigrams) intersection += Math.min(count, rightTrigrams.get(gram) || 0);
  return (2 * intersection) / (left.length - 2 + right.length - 2);
}

function profileBoost(artisan, extracted) {
  const haystack = [
    artisan.companyName,
    artisan.city,
    artisan.description,
    artisan.searchText,
    ...(artisan.specialization || []),
    ...(artisan.products || []),
    ...(artisan.customTags || []),
    ...(artisan.catalogue || []).flatMap(item => [item.title, item.category, item.material, ...(item.tags || [])])
  ].join(' ').toLowerCase();

  let boost = 0;
  const needles = [
    extracted.material,
    extracted.useCase,
    extracted.designPreference,
    extracted.productType,
    ...(extracted.synonyms || [])
  ].filter(Boolean);

  for (const needle of needles) {
    if (haystack.includes(String(needle).toLowerCase())) boost += 0.03;
  }
  return Math.min(boost, 0.15);
}

const GENERIC_WORDS = new Set(['services', 'service', 'work', 'works', 'design', 'designing', 'custom', 'made', 'items', 'products', 'other']);

// Listing products / specializations that share a meaningful word with what the photo shows.
function profileTermMatches(artisan, extracted, limit = 3) {
  const words = new Set(
    [extracted.productType, extracted.service, extracted.material, extracted.designPreference, ...(extracted.synonyms || [])]
      .join(' ')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(word => word.length > 3 && !GENERIC_WORDS.has(word))
  );
  if (words.size === 0) return [];
  const entries = [...(artisan.products || []), ...(artisan.specialization || []), ...(artisan.customTags || [])];
  return [...new Set(entries.filter(entry =>
    String(entry).toLowerCase().split(/[^a-z]+/).some(word => words.has(word) || (word.length > 3 && words.has(word.replace(/s$/, ''))))
  ))].slice(0, limit);
}

function imageReasoning(artisan, extracted) {
  const item = extracted.productType || 'the item in your photo';
  if (artisan.matchedItems?.length) {
    return `Catalogue product "${artisan.matchedItems[0].title}" looks ${artisan.matchedItems[0].similarity}% similar to your photo.`;
  }
  const terms = profileTermMatches(artisan, extracted);
  if (terms.length) return `Lists ${terms.join(', ')} — a match for ${item}.`;
  return `Vendor profile is a close match for ${item}.`;
}

function toMatchedItem(item, score) {
  return {
    _id: item._id,
    title: item.title,
    category: item.category,
    material: item.material,
    imageUrl: item.imageUrl,
    similarity: score == null ? null : Math.round(score * 100)
  };
}

function rankCatalogue(catalogue, queryEmbedding, limit = 3) {
  return (catalogue || [])
    .map(item => ({ item, score: cosineSimilarity(item.embedding, queryEmbedding) }))
    .filter(match => match.score >= MIN_ITEM_SCORE)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function stripEmbeddings(artisan) {
  const { embedding, ...rest } = artisan;
  return { ...rest, catalogue: (artisan.catalogue || []).map(({ embedding: _e, ...item }) => item) };
}

// mode 'text': profile + name similarity lead; mode 'image': catalogue photos lead.
async function semanticSearch(queryEmbedding, queryText, { city, extracted, limit = 3, mode = 'text', prefs = null }) {
  const filter = {
    ...PUBLIC_STATUS_FILTER,
    $or: [
      { embedding: { $exists: true, $ne: [] } },
      { 'catalogue.embedding.0': { $exists: true } }
    ]
  };
  if (city) filter.city = { $regex: escapeRegex(city.trim()), $options: 'i' };
  const candidates = await Artisan.find(filter).lean();

  return candidates.map(artisan => {
    const profileScore = cosineSimilarity(artisan.embedding, queryEmbedding);
    const itemMatches = rankCatalogue(artisan.catalogue, queryEmbedding);
    const itemScore = itemMatches[0]?.score || 0;
    const boost = profileBoost(artisan, extracted || {});

    let semanticScore;
    let nameScore = 0;
    let combinedScore;
    let profileTerms = [];
    if (mode === 'image') {
      profileTerms = profileTermMatches(artisan, extracted || {});
      semanticScore = Math.max(itemScore, profileScore);
      combinedScore = semanticScore + boost + (itemScore ? 0.05 : 0) + (profileTerms.length ? 0.08 : 0);
    } else {
      semanticScore = Math.max(profileScore, itemScore);
      nameScore = trigramSimilarity(artisan.companyName || '', queryText);
      combinedScore = 0.7 * semanticScore + 0.2 * nameScore + boost;
    }

    const preference = scorePreferences(artisan, prefs, { explicitLocation: Boolean(extracted?.city) });
    combinedScore += (preference.interestHits.length ? PREF_INTEREST_BOOST : 0) + (preference.locationHit ? PREF_LOCATION_BOOST : 0);

    return {
      ...stripEmbeddings(artisan),
      semanticScore,
      itemScore,
      nameScore,
      combinedScore,
      profileTerms,
      preferenceReasons: preference.reasons,
      matchedItems: itemMatches.map(({ item, score }) => toMatchedItem(item, score))
    };
  })
    .filter(artisan => artisan.semanticScore > 0)
    // Photo search: profile-only vendors need a listed product match or a strong profile similarity.
    .filter(artisan => mode !== 'image' || artisan.itemScore > 0 || artisan.profileTerms.length > 0
      || artisan.semanticScore >= MIN_PROFILE_IMAGE_SCORE)
    .sort((left, right) => right.combinedScore - left.combinedScore)
    .slice(0, limit);
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

// Returns the signed-in user, or sends a 401 and returns null.
async function authenticate(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'Authentication required to use AI Sourcing.' });
    return null;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !isSessionValid(decoded, user) || user.isDeleted || user.isSuspended) {
      res.status(401).json({ message: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
      return null;
    }
    return user;
  } catch (err) {
    res.status(401).json({ message: 'Invalid token.' });
    return null;
  }
}

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search brief query is required.' });
    }

    const user = await authenticate(req, res);
    if (!user) return;
    const prefs = getClientPreferences(user);
    const reply = payload => {
      res.json({ ...payload, personalized: Boolean(prefs) });
      recordSearchAndNotify({
        user,
        searchType: 'ai_text',
        query,
        extracted: payload.extracted,
        results: payload.results,
        simulated: payload.simulated
      });
    };

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

    reply({
      results,
      extracted,
      summary: fallbackSummary(extracted, results.length),
      suggestions: buildFallbackSuggestions(query, extracted),
      simulated: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing AI Matchmaker search.' });
  }
});

// Photo search: client uploads a picture of the item they want; the photo is
// analysed in memory (never stored) and matched against vendor catalogues.
router.post('/image', async (req, res) => {
  try {
    const user = await authenticate(req, res);
    if (!user) return;
    const prefs = getClientPreferences(user);

    let image;
    try {
      image = parseImageDataUrl(req.body.image);
    } catch (err) {
      if (err instanceof ImageUploadError) return res.status(err.status).json({ message: err.message });
      throw err;
    }
    const note = asString(req.body.note, 500);

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
        return res.status(503).json({
          message: 'Photo search is temporarily unavailable. Add a short description of the item or use the text brief instead.'
        });
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
    const IMAGE_RESULT_LIMIT = 6;
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

    res.json({
      results,
      extracted,
      summary,
      suggestions,
      imageSearch: true,
      personalized: Boolean(prefs),
      simulated: !model
    });
    recordSearchAndNotify({
      user,
      searchType: 'ai_image',
      query: note || briefForAi,
      extracted,
      results,
      simulated: !model
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing photo search.' });
  }
});

module.exports = router;
