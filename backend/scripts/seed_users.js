require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { buildSearchText } = require('../utils/artisanFields');

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

async function run() {
  await mongoose.connect(MONGO_URI);
  for (const entry of users) {
    const passwordHash = await bcrypt.hash(entry.password, 10);
    const $set = {
      name: entry.name,
      passwordHash,
      role: entry.role,
      subscriptionPlan: entry.subscriptionPlan,
      isVerified: true,
      isSuspended: false,
      isDeleted: false,
      tokenVersion: 0,
      onboardingCompleted: true
    };
    if (entry.artisanProfile) {
      $set.artisanProfile = entry.artisanProfile;
    }
    await User.updateOne(
      { email: entry.email },
      {
        $set,
        $unset: { deletedAt: '' }
      },
      { upsert: true }
    );
    console.log(`${entry.email} / ${entry.password} (${entry.role})`);

    // Public search uses the Artisan collection — create a pending listing for demo vendor.
    if (entry.role === 'artisan' && entry.artisanProfile) {
      const user = await User.findOne({ email: entry.email });
      const profile = entry.artisanProfile;
      await Artisan.findOneAndUpdate(
        { userId: user._id },
        {
          $set: {
            ...profile,
            userId: user._id,
            contactStatus: 'pending',
            searchText: buildSearchText(profile),
            description: profile.description || ''
          }
        },
        { upsert: true, new: true }
      );
      console.log(`  → Artisan listing pending: ${profile.companyName}`);
    }
  }
}

run().then(() => mongoose.disconnect()).catch(async error => {
  console.error(error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
