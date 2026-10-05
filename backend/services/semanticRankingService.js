const Artisan = require('../models/Artisan');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');
const { cosineSimilarity } = require('./geminiService');
const { scorePreferences } = require('../utils/clientPreferences');
const { locationFilter } = require('../utils/locations');

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
  const locationCondition = locationFilter(city);
  const candidates = await Artisan.find(locationCondition ? { $and: [filter, locationCondition] } : filter).lean();

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

module.exports = {
  MIN_ITEM_SCORE,
  MIN_PROFILE_IMAGE_SCORE,
  PREF_INTEREST_BOOST,
  PREF_LOCATION_BOOST,
  applyPreferences,
  imageMatchPercentage,
  escapeRegex,
  trigramSimilarity,
  profileBoost,
  profileTermMatches,
  imageReasoning,
  toMatchedItem,
  rankCatalogue,
  stripEmbeddings,
  semanticSearch
};
