const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { sanitizeArtisanForUser } = require('../utils/sanitizeArtisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

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

async function semanticSearch(queryEmbedding, queryText, { city, limit = 3 }) {
  const filter = { ...PUBLIC_STATUS_FILTER, embedding: { $exists: true, $size: queryEmbedding.length } };
  if (city) filter.city = { $regex: city.trim(), $options: 'i' };
  const candidates = await Artisan.find(filter).lean();
  return candidates.map(({ embedding, ...artisan }) => {
    const semanticScore = cosineSimilarity(embedding, queryEmbedding);
    const nameScore = trigramSimilarity(artisan.companyName || '', queryText);
    return {
      ...artisan,
      semanticScore,
      nameScore,
      combinedScore: 0.75 * semanticScore + 0.25 * nameScore
    };
  }).sort((left, right) => right.combinedScore - left.combinedScore).slice(0, limit);
}

// Try initializing Gemini if key is provided
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

router.post('/', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Search brief query is required.' });
    }

    // Require authentication to prevent anonymous AI endpoint spamming
    let userPlan = 'basic';
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Authentication required to use AI Sourcing.' });
    }

    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (user) {
        userPlan = user.subscriptionPlan;
      }
    } catch (err) {
      return res.status(401).json({ message: 'Invalid token.' });
    }

    // If Gemini key is set, run live pipeline
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

        // Step 1: Extract intent parameters
        const intentPrompt = `Extract search keywords from the following natural language project brief. We need a service keyword (e.g. Architectural, False Ceiling, Painting, Create Art, Interior Designing, etc.) and a city keyword (e.g. Tirupati, Delhi, Pune, Bangalore, Lucknow, Ghaziabad, etc.). 
Brief: "${query}"

Return the response ONLY as a JSON object, e.g. { "service": "extracted_service", "city": "extracted_city" }. Do not add markdown code blocks, backticks, or any conversational text.`;

        const intentResult = await model.generateContent(intentPrompt);
        const intentResponse = await intentResult.response;
        const intentText = intentResponse.text().trim();
        
        let extracted = { service: '', city: '' };
        try {
          // Strip potential markdown wrapper backticks if returned
          const cleanJsonStr = intentText.replace(/```json/g, '').replace(/```/g, '').trim();
          extracted = JSON.parse(cleanJsonStr);
        } catch (e) {
          console.warn('Gemini JSON parse failed for intent extraction, fallback to regex:', intentText);
          // Fallback parsing
          const serviceMatch = query.match(/(architectural|false ceiling|interior|painting|contracting)/i);
          extracted.service = serviceMatch ? serviceMatch[0] : '';
          const cityMatch = query.match(/(tirupati|delhi|mumbai|pune|lucknow|kanpur|ghaziabad|noida)/i);
          extracted.city = cityMatch ? cityMatch[0] : '';
        }

        // Prefer local vector ranking when the optional embedding backfill has run.
        try {
          const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' });
          const embeddingResult = await embeddingModel.embedContent(query);
          const queryEmbedding = embeddingResult.embedding.values;
          const semanticResults = await semanticSearch(queryEmbedding, query, {
            city: extracted.city,
            limit: 3
          });

          if (semanticResults.length > 0) {
            return res.json({
              results: semanticResults.map((artisan, index) => ({
                ...sanitizeArtisanForUser(artisan),
                matchPercentage: Math.max(0, Math.min(99, Math.round(artisan.combinedScore * 100))),
                aiReasoning: `Ranked from ${Math.round(artisan.semanticScore * 100)}% semantic similarity and ${Math.round(artisan.nameScore * 100)}% name similarity.`
              })),
              extracted,
              semantic: true,
              simulated: false
            });
          }
        } catch (embeddingError) {
          console.warn('Semantic ranking unavailable, continuing with existing AI ranking:', embeddingError.message);
        }

        // Step 2: Query database for matching candidates
        const conditions = [PUBLIC_STATUS_FILTER];
        if (extracted.service) {
          conditions.push({ specialization: { $regex: extracted.service.trim(), $options: 'i' } });
        }
        if (extracted.city) {
          conditions.push({ city: { $regex: extracted.city.trim(), $options: 'i' } });
        }
        const dbQuery = { $and: conditions };

        // Retrieve candidates (limit to 10 for AI recommendation matching)
        const candidates = await Artisan.find(dbQuery).limit(10);
        if (candidates.length === 0) {
          return res.json({
            results: [],
            extracted,
            simulated: false,
            message: 'No matching artisans found for the extracted keywords.'
          });
        }

        // Step 3: Rank and generate custom compatibility reasoning
        const rankPrompt = `Here is a client's project brief: "${query}"

Here is a list of verified local artisans matching their city:
${JSON.stringify(candidates.map(c => ({ id: c._id, name: c.companyName, city: c.city, specializations: c.specialization })))}

Select the top 3 best matching artisans. For each selected artisan, output their database ID, a match compatibility percentage (e.g. 95), and a custom, detailed reasoning sentence explaining why they are a great match for the client's specific brief (mentioning how their specialties, city, or styles align).

Return the response ONLY as a JSON array of objects, e.g. [{"id": "artisan_id", "matchPercentage": 95, "reasoning": "custom reasoning sentence"}]. Do not add markdown code blocks, backticks, or any other text.`;

        const rankResult = await model.generateContent(rankPrompt);
        const rankResponse = await rankResult.response;
        const rankText = rankResponse.text().trim();

        let matchMetadata = [];
        try {
          const cleanRankStr = rankText.replace(/```json/g, '').replace(/```/g, '').trim();
          matchMetadata = JSON.parse(cleanRankStr);
        } catch (e) {
          console.warn('Gemini JSON parse failed for ranking matching:', rankText);
        }

        // Merge matches with full Artisan records
        const results = [];
        for (const meta of matchMetadata) {
          const artisan = candidates.find(c => c._id.toString() === meta.id);
          if (artisan) {
            results.push({
              ...sanitizeArtisanForUser(artisan),
              matchPercentage: meta.matchPercentage,
              aiReasoning: meta.reasoning
            });
          }
        }

        // If JSON ranking output was broken, just return standard candidates with default match info
        if (results.length === 0) {
          candidates.slice(0, 3).forEach((c, idx) => {
            results.push({
              ...sanitizeArtisanForUser(c),
              matchPercentage: 90 - idx * 5,
              aiReasoning: `Matched based on specialization in ${c.specialization.join(', ')} in ${c.city}.`
            });
          });
        }

        return res.json({
          results,
          extracted,
          simulated: false
        });

      } catch (err) {
        console.error('Gemini live pipeline error, falling back to simulation:', err.message);
      }
    }

    // --- SIMULATED AI MATCHING (FALLBACK / OFFLINE MODE) ---
    // Extract keywords manually for mock responses
    const queryLower = query.toLowerCase();
    
    let matchedService = 'Architectural';
    if (queryLower.includes('ceiling')) matchedService = 'False Ceiling';
    else if (queryLower.includes('paint')) matchedService = 'Painting';
    else if (queryLower.includes('interior')) matchedService = 'Interior Designing';

    let matchedCity = 'Tirupati';
    if (queryLower.includes('delhi')) matchedCity = 'Delhi';
    else if (queryLower.includes('lucknow')) matchedCity = 'Lucknow';
    else if (queryLower.includes('pune')) matchedCity = 'Pune';
    else if (queryLower.includes('mumbai')) matchedCity = 'Mumbai';

    // Search Database
    const dbQuery = {
      $and: [
        PUBLIC_STATUS_FILTER,
        { specialization: { $regex: matchedService, $options: 'i' } },
        { city: { $regex: matchedCity, $options: 'i' } }
      ]
    };

    let candidates = await Artisan.find(dbQuery).limit(3);

    // If no exact match in target city, just grab top 3 for the service anywhere
    if (candidates.length === 0) {
      candidates = await Artisan.find({
        ...PUBLIC_STATUS_FILTER,
        specialization: { $regex: matchedService, $options: 'i' }
      }).limit(3);
    }

    const mockReasonings = [
      `Selected for high-end modern integration. Their past verified projects perfectly match your requested style profile and operational scope.`,
      `Highly recommended local specialist. Their verified response rate and specialized tools align with the structural details outlined in your brief.`,
      `Strong choice for budget-optimized implementation. They have verified expertise in similar materials and delivery schedules.`
    ];

    const results = candidates.map((c, idx) => ({
      ...sanitizeArtisanForUser(c),
      matchPercentage: 98 - idx * 6,
      aiReasoning: mockReasonings[idx] || `Verified specialist in ${c.city} matching your service requirements.`
    }));

    // Add a tiny artificial delay to simulate API processing time (gorgeous UX!)
    await new Promise(resolve => setTimeout(resolve, 1500));

    res.json({
      results,
      extracted: {
        service: matchedService,
        city: matchedCity
      },
      simulated: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error processing AI Matchmaker search.' });
  }
});

module.exports = router;
