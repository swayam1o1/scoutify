const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { sanitizeCatalogue } = require('../utils/sanitizeArtisan');
const { parseImageDataUrl } = require('../utils/imageUpload');
const { saveImage, deleteImage } = require('./storageService');
const { getGenerativeModel, generateWithRetry, embedText } = require('./geminiService');
const { refreshListingEmbedding } = require('./listingEmbeddingService');
const {
  asString,
  asTags,
  buildCatalogueImagePrompt,
  parseCatalogueImageJson,
  catalogueItemText,
  imagePart
} = require('../utils/visualSearch');

// PRODUCT CATALOGUE — photos clients can be matched against via image search.
const MAX_CATALOGUE_ITEMS = 30;

async function describeCatalogueImage(image, item) {
  const model = getGenerativeModel();
  if (!model) return null;
  try {
    const result = await generateWithRetry(model, [buildCatalogueImagePrompt(item), imagePart(image)]);
    return parseCatalogueImageJson(result.response.text().trim());
  } catch (err) {
    console.warn('Catalogue image description skipped:', err.message);
    return null;
  }
}

// A vendor account is its own listing, so the account id is the listing id.
function findOwnListing(artisanId) {
  return Artisan.findOne({ _id: artisanId, hasAccount: true }).select('catalogue');
}

async function listCatalogue(artisanId) {
  const listing = await findOwnListing(artisanId);
  return { catalogue: sanitizeCatalogue(listing?.catalogue), maxItems: MAX_CATALOGUE_ITEMS };
}

async function addCatalogueItem(artisanId, body) {
  const listing = await findOwnListing(artisanId);
  if (!listing) {
    throw new HttpError(400, 'Save your listing details first, then add catalogue products.');
  }
  if (listing.catalogue.length >= MAX_CATALOGUE_ITEMS) {
    throw new HttpError(400, `You can add up to ${MAX_CATALOGUE_ITEMS} catalogue products.`);
  }

  const image = parseImageDataUrl(body.image);
  const provided = {
    title: asString(body.title, 120),
    category: asString(body.category, 80),
    material: asString(body.material, 80),
    description: asString(body.description, 600)
  };

  const ai = await describeCatalogueImage(image, provided);
  const title = provided.title || ai?.title;
  if (!title) {
    throw new HttpError(400, 'Please add a product name for this photo.');
  }

  const stored = await saveImage(image, `catalogue/${listing._id}`);
  const item = {
    title,
    category: provided.category || ai?.category || '',
    material: provided.material || ai?.material || '',
    style: ai?.style || '',
    description: provided.description,
    tags: asTags([...asTags(body.tags), ...(ai?.tags || [])]),
    imageUrl: stored.url,
    imageKey: stored.key,
    aiDescription: ai?.visualDescription || ''
  };

  try {
    item.embedding = (await embedText(catalogueItemText(item))) || undefined;
  } catch (err) {
    console.warn('Catalogue embedding skipped:', err.message);
  }

  listing.catalogue.push(item);
  await listing.save();
  refreshListingEmbedding(listing._id);

  return {
    message: 'Product added to your catalogue.',
    item: sanitizeCatalogue([listing.catalogue[listing.catalogue.length - 1]])[0],
    catalogue: sanitizeCatalogue(listing.catalogue)
  };
}

async function removeCatalogueItem(artisanId, itemId) {
  const listing = await findOwnListing(artisanId);
  const item = listing?.catalogue.id(itemId);
  if (!item) throw new HttpError(404, 'Catalogue product not found.');

  const { imageKey } = item;
  item.deleteOne();
  await listing.save();
  await deleteImage(imageKey);
  refreshListingEmbedding(listing._id);

  return { message: 'Product removed from your catalogue.', catalogue: sanitizeCatalogue(listing.catalogue) };
}

module.exports = { MAX_CATALOGUE_ITEMS, listCatalogue, addCatalogueItem, removeCatalogueItem };
