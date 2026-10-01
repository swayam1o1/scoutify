const mongoose = require('mongoose');

const DEFAULT_MONGO_URI = 'mongodb://127.0.0.1:27017/scoutify';

async function connectDatabase() {
  await mongoose.connect(process.env.MONGO_URI || DEFAULT_MONGO_URI);
  console.log('Connected to MongoDB database.');
}

module.exports = { connectDatabase, DEFAULT_MONGO_URI };
