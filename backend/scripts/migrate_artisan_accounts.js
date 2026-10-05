/**
 * Moves vendor login accounts out of `users` into `artisans`.
 *
 * For every users doc with role 'artisan':
 *   - finds its listing (artisans.userId === user._id) or creates one from user.artisanProfile
 *   - copies the login/account fields onto the listing and sets hasAccount: true
 *   - re-points notifications and search logs to the listing _id
 *   - deletes the users doc
 * Old vendor JWTs stop working (tokenVersion is bumped); vendors sign in again.
 *
 * Dry run by default. Usage:
 *   node scripts/migrate_artisan_accounts.js            # report only
 *   node scripts/migrate_artisan_accounts.js --apply    # write changes
 *   node scripts/migrate_artisan_accounts.js --apply --lock-users
 *       also adds a users collection validator rejecting role 'artisan'
 */
require('dotenv').config();
const mongoose = require('mongoose');
const loadSecrets = require('../config/loadSecrets');
const Artisan = require('../models/Artisan');
const { buildSearchText, toList } = require('../utils/artisanFields');

const APPLY = process.argv.includes('--apply');
const LOCK_USERS = process.argv.includes('--lock-users');

const ACCOUNT_FIELDS = [
  'passwordHash', 'googleId', 'isVerified', 'otp', 'otpExpires',
  'phoneVerified', 'phoneOtp', 'phoneOtpExpires', 'subscriptionPlan',
  'twoFactorSecret', 'twoFactorEnabled', 'passwordResetOtp', 'passwordResetExpires',
  'reauthOtp', 'reauthOtpExpires', 'pendingEmail', 'pendingEmailOtp', 'pendingEmailExpires',
  'pendingPhone', 'pendingPhoneOtp', 'pendingPhoneExpires', 'isSuspended', 'isDeleted', 'deletedAt'
];

function accountFieldsOf(user) {
  const fields = {};
  for (const key of ACCOUNT_FIELDS) {
    if (user[key] !== undefined && user[key] !== null) fields[key] = user[key];
  }
  return {
    ...fields,
    hasAccount: true,
    name: user.name,
    email: user.email,
    tokenVersion: Number(user.tokenVersion || 0) + 1,
    subscriptionPlan: user.subscriptionPlan || 'basic',
    onboardingCompleted: true
  };
}

function listingFromProfile(user) {
  const profile = user.artisanProfile || {};
  const listing = {
    companyName: String(profile.companyName || user.name || 'Unnamed Studio').trim(),
    instagram: profile.instagram,
    city: profile.city,
    personOfContact: profile.personOfContact || user.name,
    website: profile.website,
    serviceArea: profile.serviceArea,
    description: profile.description || '',
    specialization: toList(profile.specialization),
    products: toList(profile.products),
    customTags: toList(profile.customTags),
    portfolio: toList(profile.portfolio),
    catalogue: [],
    contactStatus: user.isDeleted ? 'rejected' : 'pending',
    changeRequestedAt: new Date(),
    createdAt: user.createdAt || new Date(),
    updatedAt: new Date()
  };
  listing.searchText = buildSearchText(listing);
  return listing;
}

async function phoneOwnedByOther(db, phone, userId, listingId) {
  if (!phone) return null;
  const [user, artisan] = await Promise.all([
    db.collection('users').findOne({ phoneNumber: phone, _id: { $ne: userId } }, { projection: { email: 1 } }),
    db.collection('artisans').findOne(
      { phoneNumber: phone, hasAccount: true, ...(listingId ? { _id: { $ne: listingId } } : {}) },
      { projection: { email: 1 } }
    )
  ]);
  return user || artisan;
}

async function migrateUser(db, user, report) {
  const artisans = db.collection('artisans');
  // userId link (pre-migration) or a half-finished earlier run (account already copied).
  const listing = await artisans.findOne(
    { $or: [{ userId: user._id }, { hasAccount: true, email: user.email }] },
    { projection: { _id: 1, phoneNumber: 1, email: 1, hasAccount: 1, userId: 1 } }
  );

  const emailClash = await artisans.findOne(
    { hasAccount: true, email: user.email, ...(listing ? { _id: { $ne: listing._id } } : {}) },
    { projection: { _id: 1 } }
  );
  if (emailClash) {
    report.skipped.push({ email: user.email, reason: `email already used by vendor account ${emailClash._id}` });
    return;
  }

  const account = accountFieldsOf(user);
  const phone = user.phoneNumber || listing?.phoneNumber || user.artisanProfile?.phoneNumber;
  if (phone) {
    const owner = await phoneOwnedByOther(db, phone, user._id, listing?._id);
    if (owner) {
      report.skipped.push({ email: user.email, reason: `phone ${phone} already used by ${owner.email || owner._id}` });
      return;
    }
    account.phoneNumber = phone;
  }

  report.planned.push({
    email: user.email,
    listing: listing ? String(listing._id) : 'new (from artisanProfile)',
    deleted: !!user.isDeleted
  });
  if (!APPLY) return;

  let artisanId = listing?._id;
  if (listing) {
    await artisans.updateOne(
      { _id: listing._id },
      { $set: { ...account, updatedAt: new Date() }, $unset: { userId: '' } }
    );
  } else {
    const inserted = await artisans.insertOne({ ...listingFromProfile(user), ...account });
    artisanId = inserted.insertedId;
  }

  await Promise.all([
    db.collection('notifications').updateMany({ userId: user._id }, { $set: { userId: artisanId } }),
    db.collection('searchlogs').updateMany({ userId: user._id }, { $set: { userId: artisanId } })
  ]);
  await db.collection('users').deleteOne({ _id: user._id });
  report.migrated.push({ email: user.email, artisanId: String(artisanId) });
}

async function lockUsersCollection(db) {
  try {
    await db.command({
      collMod: 'users',
      validator: { role: { $in: ['client', 'admin'] } },
      validationLevel: 'strict',
      validationAction: 'error'
    });
    console.log('users collection validator added: role must be client or admin.');
  } catch (err) {
    console.warn('Could not add users validator (needs collMod privilege):', err.message);
  }
}

async function run() {
  await loadSecrets();
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';
  await mongoose.connect(uri);
  const { db } = mongoose.connection;
  console.log(APPLY ? 'APPLY mode: writing changes.' : 'DRY RUN: no changes written (pass --apply to migrate).');

  // Partial unique indexes on artisans email/phone for vendor accounts.
  if (APPLY) await Artisan.createIndexes();

  const vendorUsers = await db.collection('users').find({ role: 'artisan' }).toArray();
  const report = { planned: [], migrated: [], skipped: [] };
  for (const user of vendorUsers) {
    await migrateUser(db, user, report);
  }

  const orphanLinks = await db.collection('artisans').countDocuments({ userId: { $exists: true } });

  console.log(`\nVendor accounts in users: ${vendorUsers.length}`);
  console.table(report.planned);
  if (report.skipped.length) {
    console.log('\nSkipped (fix manually, then re-run):');
    console.table(report.skipped);
  }
  if (APPLY) console.log(`Migrated: ${report.migrated.length}`);
  console.log(`Artisan listings still carrying a userId link: ${orphanLinks}`);

  if (APPLY && LOCK_USERS) {
    if (report.skipped.length) {
      console.warn('Not locking users collection while vendor accounts remain there.');
    } else {
      await lockUsersCollection(db);
    }
  }
}

run()
  .then(() => mongoose.disconnect())
  .catch(async error => {
    console.error(error);
    await mongoose.disconnect();
    process.exitCode = 1;
  });
