/**
 * SRS §5.1 / §5.2 — normalize Gemini (or regex) extraction from NL search prompts.
 */

function cleanJsonText(text = '') {
  return String(text).replace(/```json/gi, '').replace(/```/g, '').trim();
}

function asString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function asNumber(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(asString).filter(Boolean).slice(0, 12);
}

function buildExpandedQuery(extracted) {
  const parts = [
    extracted.service,
    extracted.productType,
    extracted.material,
    extracted.designPreference,
    extracted.useCase,
    extracted.city,
    ...(extracted.synonyms || [])
  ].filter(Boolean);
  return [...new Set(parts.map(p => p.toLowerCase()))].join(' ');
}

/** Map Gemini JSON into a stable shape used by filters + UI. */
function normalizeExtracted(raw = {}) {
  const city = asString(raw.city || raw.location);
  const location = asString(raw.location || raw.city);
  const service = asString(raw.service || raw.productType || raw.category);
  const synonyms = asStringArray(raw.synonyms);

  const extracted = {
    useCase: asString(raw.useCase),
    productType: asString(raw.productType),
    material: asString(raw.material),
    designPreference: asString(raw.designPreference),
    location: location || city,
    city: city || location,
    distanceKm: asNumber(raw.distanceKm),
    quantity: asString(raw.quantity),
    projectSize: asString(raw.projectSize),
    budgetMin: asNumber(raw.budgetMin),
    budgetMax: asNumber(raw.budgetMax),
    budgetCurrency: asString(raw.budgetCurrency) || 'INR',
    service,
    synonyms,
    expandedQuery: asString(raw.expandedQuery)
  };

  if (!extracted.expandedQuery) {
    extracted.expandedQuery = buildExpandedQuery(extracted);
  }

  return extracted;
}

function parseExtractedJson(text) {
  return normalizeExtracted(JSON.parse(cleanJsonText(text)));
}

/** Lightweight offline fallback when Gemini is unavailable. */
function regexExtract(query) {
  const q = String(query || '');
  const lower = q.toLowerCase();

  let service = '';
  const serviceMatch = q.match(
    /(architectural|false ceiling|interior\s*design(?:ing)?|painting|contracting|furniture|woodwork|carpentry|marble|tiling|electrical|plumbing)/i
  );
  if (serviceMatch) service = serviceMatch[0];
  else if (lower.includes('ceiling')) service = 'False Ceiling';
  else if (lower.includes('paint')) service = 'Painting';
  else if (lower.includes('interior')) service = 'Interior Designing';
  else if (lower.includes('furniture') || lower.includes('wooden')) service = 'Furniture';

  let city = '';
  const cityMatch = q.match(
    /(bangalore|bengaluru|tirupati|delhi|mumbai|pune|lucknow|kanpur|ghaziabad|noida|hyderabad|chennai|kolkata|jaipur|ahmedabad)/i
  );
  if (cityMatch) {
    city = cityMatch[0];
    if (/bengaluru/i.test(city)) city = 'Bangalore';
  }

  let material = '';
  const materialMatch = q.match(/(wood(?:en)?|teak|oak|marble|granite|brass|steel|glass|fabric|concrete)/i);
  if (materialMatch) material = materialMatch[0];

  let useCase = '';
  if (/hospitality|hotel|resort/i.test(q)) useCase = 'hospitality';
  else if (/residential|home|apartment/i.test(q)) useCase = 'residential';
  else if (/office|commercial/i.test(q)) useCase = 'commercial';
  else if (/retail|showroom/i.test(q)) useCase = 'retail';

  let designPreference = '';
  const designMatch = q.match(/(modern|minimal(?:ist)?|traditional|industrial|contemporary|handcrafted|luxury)/i);
  if (designMatch) designPreference = designMatch[0];

  let distanceKm = null;
  const distMatch = q.match(/within\s+(\d+)\s*(?:km|kilometers?)/i)
    || q.match(/(\d+)\s*(?:km|kilometers?)\s*(?:radius|of|from|near)/i);
  if (distMatch) distanceKm = Number(distMatch[1]);

  let budgetMin = null;
  let budgetMax = null;
  const underLakh = q.match(/under\s+(\d+(?:\.\d+)?)\s*lakh/i);
  const rangeLakh = q.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)\s*lakh/i);
  if (underLakh) budgetMax = Number(underLakh[1]) * 100000;
  else if (rangeLakh) {
    budgetMin = Number(rangeLakh[1]) * 100000;
    budgetMax = Number(rangeLakh[2]) * 100000;
  }

  const synonyms = [];
  if (/wood|furniture|carpentry/i.test(lower)) {
    synonyms.push('carpentry', 'woodwork', 'furniture manufacturer');
  }
  if (/interior/i.test(lower)) synonyms.push('interior designer', 'fit-out');

  return normalizeExtracted({
    useCase,
    productType: service,
    material,
    designPreference,
    city,
    location: city,
    distanceKm,
    budgetMin,
    budgetMax,
    service,
    synonyms,
    quantity: '',
    projectSize: useCase || ''
  });
}

function buildIntentPrompt(query) {
  return `You are Scoutify's search interpreter for Indian artisan / vendor discovery (SRS §5).

From this natural-language project brief, extract structured search attributes.
Also expand the query with useful synonyms for semantic matching (e.g. wooden furniture → carpentry, woodwork, furniture manufacturer).

Brief: """${query}"""

Return ONLY a JSON object with these keys (use empty string or null when unknown):
{
  "useCase": "hospitality | residential | commercial | retail | other short phrase",
  "productType": "e.g. wooden furniture, false ceiling",
  "material": "e.g. wood, marble, brass",
  "designPreference": "e.g. handcrafted, modern, minimal",
  "location": "city or area text",
  "city": "primary city name if any",
  "distanceKm": null or number (preferred radius in km),
  "quantity": "quantity or units if mentioned",
  "projectSize": "small | medium | large | or free text",
  "budgetMin": null or number in INR,
  "budgetMax": null or number in INR,
  "budgetCurrency": "INR",
  "service": "best matching vendor category/service keyword for DB filter",
  "synonyms": ["related category terms"],
  "expandedQuery": "single string combining key terms + synonyms for embedding search"
}

Do not wrap in markdown. No commentary.`;
}

function buildSummaryPrompt(query, extracted, resultCount) {
  return `Write one short paragraph (max 2 sentences) summarizing this Scoutify vendor search for the client.
Mention location, category/use-case, and any budget/material if present. State that ${resultCount} matching vendor(s) were found (or none).
Be factual; do not invent vendor names.

Brief: """${query}"""
Extracted: ${JSON.stringify(extracted)}

Return plain text only.`;
}

function serviceOrConditions(extracted) {
  const terms = [
    extracted.service,
    extracted.productType,
    extracted.material,
    ...(extracted.synonyms || [])
  ].map(asString).filter(Boolean);

  const unique = [...new Set(terms.map(t => t.toLowerCase()))];
  if (unique.length === 0) return null;

  return {
    $or: unique.flatMap(term => ([
      { specialization: { $regex: term, $options: 'i' } },
      { products: { $regex: term, $options: 'i' } },
      { customTags: { $regex: term, $options: 'i' } },
      { searchText: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
      { companyName: { $regex: term, $options: 'i' } }
    ]))
  };
}

module.exports = {
  normalizeExtracted,
  parseExtractedJson,
  regexExtract,
  buildIntentPrompt,
  buildSummaryPrompt,
  buildExpandedQuery,
  serviceOrConditions,
  cleanJsonText
};
