/**
 * Keyword matching shared by standard and AI search.
 * A query is split into words; each word matches on its stem (manufacture → manufactur*)
 * or a synonym (furniture → wood, carpentry), across every descriptive listing field.
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STOPWORDS = new Set([
  'and', 'the', 'for', 'with', 'near', 'from', 'best', 'top', 'need', 'looking', 'want',
  'service', 'services', 'company', 'companies', 'provider', 'providers', 'agency', 'vendor', 'vendors'
]);

// Words in one group are treated as the same need.
const SYNONYM_GROUPS = [
  ['furniture', 'carpentry', 'carpenter', 'woodwork', 'wood', 'joinery', 'cabinet', 'modular'],
  ['interior', 'interiors', 'fitout'],
  ['architect', 'architecture', 'architectural'],
  ['ceiling', 'gypsum'],
  ['paint', 'painting', 'painter'],
  ['light', 'lights', 'lighting'],
  ['landscape', 'landscaping', 'garden'],
  ['curtain', 'curtains', 'furnishing', 'furnishings', 'upholstery'],
  ['marble', 'granite', 'stone'],
  ['tile', 'tiles', 'flooring']
];

// Field weights: what a vendor says it does counts more than a passing mention.
const FIELD_WEIGHTS = [
  ['specialization', 3],
  ['products', 3],
  ['customTags', 3],
  ['catalogue.title', 3],
  ['catalogue.category', 3],
  ['catalogue.tags', 3],
  ['companyName', 2],
  ['description', 1]
];

function stem(word) {
  for (const suffix of ['ings', 'ing', 'ers', 'er', 'es', 's', 'e']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 4) return word.slice(0, -suffix.length);
  }
  return word;
}

function synonymsOf(word) {
  const group = SYNONYM_GROUPS.find(words => words.includes(word) || words.some(w => stem(w) === stem(word)));
  return group || [];
}

/** Each entry is one query word with its alternative stems, e.g. ['furnitur', 'carpentry', 'wood', ...]. */
function buildSearchTerms(...texts) {
  const words = texts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .replace(/fit-out/g, 'fitout')
    .split(/[^a-z]+/)
    .filter(word => word.length >= 3 && !STOPWORDS.has(word));

  const seen = new Set();
  const groups = [];
  for (const word of words) {
    const alternatives = [...new Set([word, ...synonymsOf(word)].map(stem))];
    const key = [...alternatives].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push(alternatives);
  }
  return groups;
}

function termRegex(alternatives) {
  return new RegExp(alternatives.map(escapeRegex).join('|'), 'i');
}

/** Mongo filter: listing mentions at least one query word (or its synonym) somewhere relevant. */
function searchTermsFilter(groups) {
  if (!groups.length) return null;
  const regex = termRegex(groups.flat());
  return { $or: FIELD_WEIGHTS.map(([field]) => ({ [field]: regex })) };
}

function fieldValues(artisan, field) {
  if (field.startsWith('catalogue.')) {
    const key = field.split('.')[1];
    return (artisan.catalogue || []).flatMap(item => item[key] || []);
  }
  const value = artisan[field];
  return Array.isArray(value) ? value : [value];
}

/** { score, matchedWords }: words matched and how strongly (best field weight per word). */
function scoreSearchTerms(artisan, groups) {
  let score = 0;
  let matchedWords = 0;
  for (const alternatives of groups) {
    const regex = termRegex(alternatives);
    let best = 0;
    for (const [field, weight] of FIELD_WEIGHTS) {
      if (weight > best && fieldValues(artisan, field).some(value => value && regex.test(String(value)))) best = weight;
    }
    if (best) {
      score += best;
      matchedWords += 1;
    }
  }
  return { score, matchedWords };
}

module.exports = { buildSearchTerms, searchTermsFilter, scoreSearchTerms, escapeRegex };
