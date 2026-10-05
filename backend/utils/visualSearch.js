/**
 * Image-based matching: Gemini describes a photo into attributes, which are
 * embedded as text and compared against vendor catalogue item embeddings.
 */
const { cleanJsonText, normalizeExtracted, cleanSuggestions, SUGGESTIONS_FIELD } = require('./searchIntent');

function asString(value, max = 200) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function asTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(item => asString(item, 40)).filter(Boolean))].slice(0, 10);
}

function buildClientImagePrompt(note) {
  return `You are Scoutify's visual sourcing assistant for Indian artisan / vendor discovery.
A client uploaded a photo of an item they want to buy or get made. Identify the item so we can match vendors who make or supply the same product or service.
${note ? `\nClient's note: """${note}"""\n` : ''}
Return ONLY a JSON object (empty string or null when unknown):
{
  "productType": "specific item, e.g. cane armchair, brass pendant light, terrazzo floor tiles",
  "service": "best vendor category, e.g. furniture, lighting, flooring, woodwork",
  "material": "primary material(s)",
  "designPreference": "style, e.g. mid-century, traditional, minimal, handcrafted",
  "useCase": "residential | hospitality | commercial | retail | other short phrase",
  "city": "city only if the client's note mentions one",
  "location": "same as city",
  "colors": ["dominant colours"],
  "synonyms": ["related product and vendor category terms"],
  "visualDescription": "2 sentences describing the item: shape, construction, finish, notable details",
  "expandedQuery": "single string combining the item, material, style, category and synonyms",
  ${SUGGESTIONS_FIELD}
}
Do not wrap in markdown. No commentary.`;
}

function buildCatalogueImagePrompt(item) {
  return `You are cataloguing a product photo uploaded by an Indian artisan / vendor on Scoutify.
Vendor-provided details (may be empty): ${JSON.stringify({
    title: item.title || '',
    category: item.category || '',
    material: item.material || '',
    description: item.description || ''
  })}

Return ONLY a JSON object:
{
  "title": "short product name, e.g. Handwoven cane armchair",
  "category": "product category, e.g. furniture, lighting, flooring, decor",
  "material": "primary material(s)",
  "style": "design style",
  "tags": ["up to 8 search keywords"],
  "visualDescription": "2 sentences describing what the product looks like"
}
Prefer the vendor's details when they are provided. Do not wrap in markdown.`;
}

/** Photo analysis response: { extracted, suggestions }. */
function parseClientImageJson(text) {
  const raw = JSON.parse(cleanJsonText(text));
  const extracted = normalizeExtracted(raw);
  extracted.colors = asTags(raw.colors).slice(0, 5);
  extracted.visualDescription = asString(raw.visualDescription, 600);
  if (extracted.visualDescription) {
    extracted.expandedQuery = `${extracted.expandedQuery} ${extracted.visualDescription}`.trim();
  }
  return { extracted, suggestions: cleanSuggestions(raw.suggestions) };
}

function parseCatalogueImageJson(text) {
  const raw = JSON.parse(cleanJsonText(text));
  return {
    title: asString(raw.title, 120),
    category: asString(raw.category, 80),
    material: asString(raw.material, 80),
    style: asString(raw.style, 80),
    tags: asTags(raw.tags),
    visualDescription: asString(raw.visualDescription, 600)
  };
}

function catalogueItemText(item) {
  return [
    item.title,
    item.category,
    item.material,
    item.style,
    (item.tags || []).join(', '),
    item.description,
    item.aiDescription
  ].filter(Boolean).join(' | ');
}

function imagePart({ base64, mimeType }) {
  return { inlineData: { data: base64, mimeType } };
}

module.exports = {
  asString,
  asTags,
  buildClientImagePrompt,
  buildCatalogueImagePrompt,
  parseClientImageJson,
  parseCatalogueImageJson,
  catalogueItemText,
  imagePart
};
