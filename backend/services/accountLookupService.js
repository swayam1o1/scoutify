/**
 * Accounts live in two collections: clients/admins in `users`, vendors in `artisans`
 * (hasAccount: true). Every login identity (email, phone) is unique across both.
 */
const mongoose = require('mongoose');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { ARTISAN_ACCOUNT_SELECT } = require('../constants/artisan');

function artisanAccounts(filter) {
  return Artisan.findOne({ ...filter, hasAccount: true }).select(ARTISAN_ACCOUNT_SELECT);
}

async function findAccountByEmail(email) {
  if (!email) return null;
  return (await User.findOne({ email })) || artisanAccounts({ email });
}

// `role` comes from the JWT and decides which collection holds the account.
async function findAccountById(id, role) {
  if (!mongoose.isValidObjectId(id)) return null;
  if (role === 'artisan') return artisanAccounts({ _id: id });
  return User.findById(id);
}

function excluding(excludeId) {
  return excludeId ? { _id: { $ne: excludeId } } : {};
}

async function isEmailTaken(email, { excludeId, includeDeleted = false } = {}) {
  const deletedFilter = includeDeleted ? {} : { isDeleted: { $ne: true } };
  const filter = { email, ...deletedFilter, ...excluding(excludeId) };
  const [user, artisan] = await Promise.all([
    User.exists(filter),
    Artisan.exists({ ...filter, hasAccount: true })
  ]);
  return Boolean(user || artisan);
}

async function isPhoneTaken(phone, { excludeId } = {}) {
  const filter = { phoneNumber: phone, isDeleted: { $ne: true }, ...excluding(excludeId) };
  const [user, artisan] = await Promise.all([
    User.exists(filter),
    Artisan.exists({ ...filter, hasAccount: true })
  ]);
  return Boolean(user || artisan);
}

module.exports = { findAccountByEmail, findAccountById, isEmailTaken, isPhoneTaken };
