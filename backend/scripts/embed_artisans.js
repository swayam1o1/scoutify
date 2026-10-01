/**
 * Rebuilds vendor profile embeddings (and any missing catalogue item embeddings).
 *   npm run embed:artisans              -> every listing
 *   npm run embed:artisans -- --missing -> only listings without a profile embedding
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Artisan = require('../models/Artisan');
const { buildSearchText, buildEmbeddingText } = require('../utils/artisanFields');
const { catalogueItemText } = require('../utils/visualSearch');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required to generate artisan embeddings.');
}

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 3072;
const ONLY_MISSING = process.argv.includes('--missing');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

async function embed(text, label) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await embeddingModel.embedContent(text);
      const embedding = response.embedding.values;
      if (!Array.isArray(embedding) || embedding.length !== EMBEDDING_DIMENSIONS) {
        throw new Error(`Unexpected embedding dimensions (${embedding?.length}) for ${label}. Expected ${EMBEDDING_DIMENSIONS}.`);
      }
      return embedding;
    } catch (err) {
      const transient = /\b(429|500|503)\b|overloaded|high demand|quota/i.test(err.message);
      if (!transient || attempt >= 5) throw err;
      const waitMs = 2000 * (attempt + 1);
      console.warn(`  retrying ${label} in ${waitMs / 1000}s (${err.message.slice(0, 80)})`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const filter = ONLY_MISSING ? { $or: [{ embedding: { $exists: false } }, { embedding: { $size: 0 } }] } : {};
  const artisans = await Artisan.find(filter);
  console.log(`Embedding ${artisans.length} listing(s)${ONLY_MISSING ? ' without a profile embedding' : ''}...`);
  let embedded = 0;
  let failed = 0;

  for (const artisan of artisans) {
    try {
      const embedding = await embed(buildEmbeddingText(artisan), artisan.companyName);
      await Artisan.updateOne({ _id: artisan._id }, { $set: { searchText: buildSearchText(artisan), embedding } });
      embedded++;
      console.log(`Embedded ${embedded}/${artisans.length}: ${artisan.companyName}`);

      const pendingItems = (artisan.catalogue || []).filter(item => !item.embedding?.length);
      for (const item of pendingItems) {
        item.embedding = await embed(catalogueItemText(item), `${artisan.companyName} / ${item.title}`);
      }
      if (pendingItems.length) {
        await Artisan.updateOne({ _id: artisan._id }, { $set: { catalogue: artisan.catalogue } });
        console.log(`  + ${pendingItems.length} catalogue item(s)`);
      }
    } catch (err) {
      failed++;
      console.error(`Failed: ${artisan.companyName} — ${err.message}`);
    }
  }

  console.log(`Done. ${embedded} embedded, ${failed} failed.`);
}

run()
  .then(() => mongoose.disconnect())
  .catch(async error => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
