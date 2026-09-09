require('dotenv').config();
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Artisan = require('../models/Artisan');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is required to generate artisan embeddings.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

function buildSearchText(artisan) {
  return [artisan.companyName, artisan.personOfContact, artisan.city, artisan.specialization?.join(', ')]
    .filter(Boolean)
    .join(' | ');
}

async function run() {
  await mongoose.connect(MONGO_URI);
  const artisans = await Artisan.find({}).select('+embedding');
  let embedded = 0;

  for (const artisan of artisans) {
    const searchText = buildSearchText(artisan);
    const response = await embeddingModel.embedContent(searchText);
    const embedding = response.embedding.values;
    if (!Array.isArray(embedding) || embedding.length !== 768) {
      throw new Error(`Unexpected embedding dimensions for ${artisan.companyName}`);
    }
    await Artisan.updateOne({ _id: artisan._id }, { $set: { searchText, embedding } });
    embedded++;
    console.log(`Embedded ${embedded}/${artisans.length}: ${artisan.companyName}`);
  }
}

run()
  .then(() => mongoose.disconnect())
  .catch(async error => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });