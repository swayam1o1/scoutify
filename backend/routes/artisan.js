const express = require('express');
const router = express.Router();
const Artisan = require('../models/Artisan');
const { requireAuth, requireRole } = require('../middleware/auth');
const { toList, buildSearchText } = require('../utils/artisanFields');
const { assertReauth, clearReauthChallenge, companyNameChanged } = require('../utils/reauth');
const { sanitizeCatalogue } = require('../utils/sanitizeArtisan');
const { parseImageDataUrl, ImageUploadError } = require('../utils/imageUpload');
const { saveImage, deleteImage } = require('../utils/storage');
const { getGenerativeModel, generateWithRetry, embedText } = require('../utils/gemini');
const {
  asString,
  asTags,
  buildCatalogueImagePrompt,
  parseCatalogueImageJson,
  catalogueItemText,
  imagePart
} = require('../utils/visualSearch');

// Every route here is for the signed-in vendor managing their own listing.
router.use(requireAuth, requireRole('artisan'));

// 1. GET PROFILE
router.get('/profile', async (req, res) => {
  try {
    const listing = await Artisan.findOne({ userId: req.user._id }).select('contactStatus updatedAt');
    res.json({
      profile: req.user.artisanProfile,
      contactStatus: listing?.contactStatus || null,
      approvalPending: listing ? listing.contactStatus === 'pending' : false
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading artisan profile.' });
  }
});

// 2. UPDATE PROFILE & SYNC WITH PUBLIC ARTISAN ENTRY
// Any edit re-enters admin moderation, so the listing goes back to 'pending'.
// Company name changes require re-authentication (SRS 3.2).
router.post('/profile', async (req, res) => {
  try {
    const {
      companyName,
      phoneNumber,
      email,
      instagram,
      city,
      personOfContact,
      website,
      serviceArea,
      description,
      currentPassword,
      totpCode,
      emailOtp
    } = req.body;

    if (!companyName?.trim()) {
      return res.status(400).json({ message: 'Company name is required.' });
    }

    const existing = req.user.artisanProfile?.toObject?.() || req.user.artisanProfile || {};
    if (companyNameChanged(existing.companyName, companyName)) {
      const reauthErr = await assertReauth(req.user, { currentPassword, totpCode, emailOtp });
      if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
      clearReauthChallenge(req.user);
    }

    const specialization = toList(req.body.specialization);
    const products = toList(req.body.products);
    const customTags = toList(req.body.customTags);

    const profile = {
      companyName: companyName.trim(),
      phoneNumber,
      email,
      instagram,
      city,
      personOfContact,
      website,
      serviceArea,
      description,
      specialization,
      products,
      customTags,
      portfolio: toList(req.body.portfolio)
    };

    req.user.artisanProfile = profile;
    await req.user.save();

    const listing = await Artisan.findOneAndUpdate(
      { userId: req.user._id },
      {
        ...profile,
        contactStatus: 'pending',
        searchText: buildSearchText(profile),
        userId: req.user._id
      },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Listing saved. A Scoutify admin will review it before it appears in search.',
      profile: req.user.artisanProfile,
      contactStatus: listing.contactStatus,
      approvalPending: listing.contactStatus === 'pending'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating artisan profile.' });
  }
});

// 3. PRODUCT CATALOGUE — photos clients can be matched against via image search.
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

router.get('/catalogue', async (req, res) => {
  try {
    const listing = await Artisan.findOne({ userId: req.user._id }).select('catalogue');
    res.json({ catalogue: sanitizeCatalogue(listing?.catalogue), maxItems: MAX_CATALOGUE_ITEMS });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error loading catalogue.' });
  }
});

router.post('/catalogue', async (req, res) => {
  try {
    const listing = await Artisan.findOne({ userId: req.user._id }).select('catalogue');
    if (!listing) {
      return res.status(400).json({ message: 'Save your listing details first, then add catalogue products.' });
    }
    if (listing.catalogue.length >= MAX_CATALOGUE_ITEMS) {
      return res.status(400).json({ message: `You can add up to ${MAX_CATALOGUE_ITEMS} catalogue products.` });
    }

    const image = parseImageDataUrl(req.body.image);
    const provided = {
      title: asString(req.body.title, 120),
      category: asString(req.body.category, 80),
      material: asString(req.body.material, 80),
      description: asString(req.body.description, 600)
    };

    const ai = await describeCatalogueImage(image, provided);
    const title = provided.title || ai?.title;
    if (!title) {
      return res.status(400).json({ message: 'Please add a product name for this photo.' });
    }

    const stored = await saveImage(image, `catalogue/${listing._id}`);
    const item = {
      title,
      category: provided.category || ai?.category || '',
      material: provided.material || ai?.material || '',
      style: ai?.style || '',
      description: provided.description,
      tags: asTags([...asTags(req.body.tags), ...(ai?.tags || [])]),
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

    res.status(201).json({
      message: 'Product added to your catalogue.',
      item: sanitizeCatalogue([listing.catalogue[listing.catalogue.length - 1]])[0],
      catalogue: sanitizeCatalogue(listing.catalogue)
    });
  } catch (err) {
    if (err instanceof ImageUploadError) return res.status(err.status).json({ message: err.message });
    console.error(err);
    res.status(500).json({ message: 'Error adding catalogue product.' });
  }
});

router.delete('/catalogue/:itemId', async (req, res) => {
  try {
    const listing = await Artisan.findOne({ userId: req.user._id }).select('catalogue');
    const item = listing?.catalogue.id(req.params.itemId);
    if (!item) return res.status(404).json({ message: 'Catalogue product not found.' });

    const { imageKey } = item;
    item.deleteOne();
    await listing.save();
    await deleteImage(imageKey);

    res.json({ message: 'Product removed from your catalogue.', catalogue: sanitizeCatalogue(listing.catalogue) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error removing catalogue product.' });
  }
});

module.exports = router;
