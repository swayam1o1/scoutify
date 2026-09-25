const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
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

const { JWT_SECRET, isSessionValid } = require('../middleware/auth');

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : 0;
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
    ...(artisan.customTags || [])
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

async function semanticSearch(queryEmbedding, queryText, { city, extracted, limit = 3 }) {
  const filter = { ...PUBLIC_STATUS_FILTER, embedding: { $exists: true, $ne: [] } };
  if (city) filter.city = { $regex: city.trim(), $options: 'i' };
  const candidates = await Artisan.find(filter).lean();
  return candidates.map(({ embedding, ...artisan }) => {
    const semanticScore = cosineSimilarity(embedding, queryEmbedding);
    const nameScore = trigramSimilarity(artisan.companyName || '', queryText);
    const boost = profileBoost(artisan, extracted || {});
    return {
      ...artisan,
      semanticScore,
      nameScore,
      combinedScore: 0.7 * semanticScore + 0.2 * nameScore + boost
    };
  }).sort((left, right) => right.combinedScore - left.combinedScore).slice(0, limit);
}

function buildDbQuery(extracted) {
  const conditions = [PUBLIC_STATUS_FILTER];
  const serviceFilter = serviceOrConditions(extracted);
  if (serviceFilter) conditions.push(serviceFilter);
  if (extracted.city) {
    conditions.push({
      $or: [
        { city: { $regex: extracted.city.trim(), $options: 'i' } },
        { serviceArea: { $regex: extracted.city.trim(), $options: 'i' } }
      ]
    });
  }
  return { $and: conditions };
}

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function maybeSummarize(model, query, extracted, resultCount) {
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

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search brief query is required.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required to use AI Sourcing.' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user || !isSessionValid(decoded, user) || user.isDeleted || user.isSuspended) {
        return res.status(401).json({ message: 'Session expired. Please sign in again.', code: 'SESSION_REVOKED' });
      }
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

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

        const embedText = extracted.expandedQuery || query;

        // Prefer vector ranking when embeddings exist
        try {
          const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
          const embeddingResult = await embeddingModel.embedContent(embedText);
          const queryEmbedding = embeddingResult.embedding.values;
          const semanticResults = await semanticSearch(queryEmbedding, embedText, {
            city: extracted.city,
            extracted,
            limit: 5
          });

          if (semanticResults.length > 0) {
            const results = semanticResults.map(artisan => ({
              ...sanitizeArtisanForUser(artisan),
              matchPercentage: Math.max(0, Math.min(99, Math.round(artisan.combinedScore * 100))),
              aiReasoning: `Ranked from ${Math.round(artisan.semanticScore * 100)}% semantic similarity`
                + (extracted.material || extracted.useCase
                  ? ` aligned with ${[extracted.material, extracted.useCase, extracted.designPreference].filter(Boolean).join(', ')}.`
                  : ` and ${Math.round(artisan.nameScore * 100)}% name similarity.`)
            }));
            const summary = (await maybeSummarize(model, query, extracted, results.length))
              || fallbackSummary(extracted, results.length);
            const suggestions = await maybeSuggestions(model, query, extracted);

            return res.json({
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
        let candidates = await Artisan.find(buildDbQuery(extracted)).limit(15);

        // Relax city if nothing found
        if (candidates.length === 0 && extracted.city) {
          const serviceOnly = [PUBLIC_STATUS_FILTER];
          const serviceFilter = serviceOrConditions(extracted);
          if (serviceFilter) serviceOnly.push(serviceFilter);
          candidates = await Artisan.find({ $and: serviceOnly }).limit(15);
        }

        if (candidates.length === 0) {
          const summary = fallbackSummary(extracted, 0);
          const suggestions = await maybeSuggestions(model, query, extracted);
          return res.json({
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
  tags: c.customTags,
  description: (c.description || '').slice(0, 180)
})))}

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
              matchPercentage: meta.matchPercentage,
              aiReasoning: meta.reasoning
            });
          }
        }

        if (results.length === 0) {
          candidates.slice(0, 5).forEach((c, idx) => {
            results.push({
              ...sanitizeArtisanForUser(c),
              matchPercentage: 90 - idx * 5,
              aiReasoning: `Matched on ${[c.specialization?.join(', '), c.city].filter(Boolean).join(' · ')}.`
            });
          });
        }

        const summary = (await maybeSummarize(model, query, extracted, results.length))
          || fallbackSummary(extracted, results.length);
        const suggestions = await maybeSuggestions(model, query, extracted);

        return res.json({
          results,
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
    let candidates = await Artisan.find(buildDbQuery(extracted)).limit(5);
    if (candidates.length === 0 && extracted.service) {
      candidates = await Artisan.find({
        ...PUBLIC_STATUS_FILTER,
        specialization: { $regex: extracted.service, $options: 'i' }
      }).limit(5);
    }

    const mockReasonings = [
      'Selected for profile alignment with your brief (category, city, and stated preferences).',
      'Local specialist whose tags and specialization overlap your extracted requirements.',
      'Strong candidate when weighing material / use-case keywords from your prompt.'
    ];

    const results = candidates.map((c, idx) => ({
      ...sanitizeArtisanForUser(c),
      matchPercentage: 92 - idx * 6,
      aiReasoning: mockReasonings[idx] || `Verified specialist in ${c.city}.`
    }));

    await new Promise(resolve => setTimeout(resolve, 800));

    res.json({
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

module.exports = router;
