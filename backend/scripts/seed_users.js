require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { newArtisanAccount } = require('../services/artisanService');
const { ARTISAN_ACCOUNT_SELECT } = require('../constants/artisan');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';
const users = [
  { name: 'Demo Client', email: 'client@example.com', password: 'ClientPass123!', role: 'client', subscriptionPlan: 'basic' },
  { name: 'Demo Pro Client', email: 'pro@example.com', password: 'ProPass123!', role: 'client', subscriptionPlan: 'pro' },
  {
    name: 'Demo Artisan',
    email: 'artisan@example.com',
    password: 'ArtisanPass123!',
    role: 'artisan',
    subscriptionPlan: 'basic',
    artisanProfile: {
      companyName: 'Demo Artisan Studio',
      personOfContact: 'Demo Artisan',
      email: 'artisan@example.com',
      city: 'Bangalore',
      phoneNumber: '9876501234',
      specialization: ['Architectural services'],
      products: [],
      customTags: [],
      portfolio: []
    }
  },
  { name: 'Scoutify Admin', email: 'admin@example.com', password: 'AdminPass123!', role: 'admin', subscriptionPlan: 'basic' }
];

// Vendors live only in the artisans collection; the listing is also the login account.
async function seedArtisan(entry, passwordHash) {
  const { artisanProfile: listing } = entry;
  const account = {
    name: entry.name,
    passwordHash,
    subscriptionPlan: entry.subscriptionPlan,
    isVerified: true,
    isSuspended: false,
    isDeleted: false,
    deletedAt: undefined,
    tokenVersion: 0
  };

  const existing = await Artisan.findOne({ email: entry.email, hasAccount: true }).select(ARTISAN_ACCOUNT_SELECT);
  if (existing) {
    existing.set(account);
    await existing.save();
  } else {
    await newArtisanAccount({ ...account, listing, email: entry.email, phoneNumber: listing.phoneNumber }).save();
  }
  console.log(`  → Artisan account (${existing ? 'updated' : 'created, listing pending'}): ${listing.companyName}`);
}

async function run() {
  await mongoose.connect(MONGO_URI);
  for (const entry of users) {
    const passwordHash = await bcrypt.hash(entry.password, 10);
    console.log(`${entry.email} / ${entry.password} (${entry.role})`);

    if (entry.role === 'artisan') {
      await seedArtisan(entry, passwordHash);
      continue;
    }

    await User.updateOne(
      { email: entry.email },
      {
        $set: {
          name: entry.name,
          passwordHash,
          role: entry.role,
          subscriptionPlan: entry.subscriptionPlan,
          isVerified: true,
          isSuspended: false,
          isDeleted: false,
          tokenVersion: 0,
          onboardingCompleted: true
        },
        $unset: { deletedAt: '' }
      },
      { upsert: true }
    );
  }
}

run().then(() => mongoose.disconnect()).catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
