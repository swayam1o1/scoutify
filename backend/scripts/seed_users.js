require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';
const users = [
  { name: 'Demo Client', email: 'client@example.com', password: 'ClientPass123!', role: 'client', subscriptionPlan: 'basic' },
  { name: 'Demo Pro Client', email: 'pro@example.com', password: 'ProPass123!', role: 'client', subscriptionPlan: 'pro' },
  { name: 'Demo Artisan', email: 'artisan@example.com', password: 'ArtisanPass123!', role: 'artisan', subscriptionPlan: 'basic' }
];

async function run() {
  await mongoose.connect(MONGO_URI);
  for (const entry of users) {
    const passwordHash = await bcrypt.hash(entry.password, 10);
    await User.updateOne(
      { email: entry.email },
      { $set: { name: entry.name, passwordHash, role: entry.role, subscriptionPlan: entry.subscriptionPlan, isVerified: true } },
      { upsert: true }
    );
    console.log(`${entry.email} / ${entry.password}`);
  }
}

run().then(() => mongoose.disconnect()).catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
