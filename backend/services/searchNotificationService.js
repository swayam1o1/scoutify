/**
 * Logs AI searches and alerts matched vendors in-app. Runs after the search
 * response is sent, so failures here never affect the client's results.
 */
const crypto = require('crypto');
const mongoose = require('mongoose');
const Artisan = require('../models/Artisan');
const SearchLog = require('../models/SearchLog');
const Notification = require('../models/Notification');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');

const MIN_MATCH_PERCENTAGE = 60;
const MAX_VENDORS_PER_SEARCH = 5;
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const DAILY_CAP_PER_VENDOR = 20;

function clean(value, max = 80) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function searchTopic(extracted = {}, query = '') {
  const topic = extracted.productType || extracted.service || query.split(/\s+/).slice(0, 6).join(' ');
  return clean(topic, 120).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

function dedupeKey(clientId, topic) {
  return crypto.createHash('sha256').update(`${clientId}:${topic}`).digest('hex').slice(0, 32);
}

function buildNotification({ searchType, extracted, result }) {
  const label = clean(extracted.productType || extracted.service) || 'products or services like yours';
  const city = clean(extracted.city || extracted.location, 60);
  const quantity = clean(extracted.quantity, 40);
  const matchedProduct = clean(result.matchedItems?.[0]?.title, 80);
  const matchPercentage = Math.round(Number(result.matchPercentage) || 0);

  let message = `A client searched for ${label}${city ? ` in ${city}` : ''}${quantity ? ` (quantity: ${quantity})` : ''}. Your listing matched ${matchPercentage}%.`;
  if (matchedProduct) message += ` Closest catalogue product: "${matchedProduct}".`;

  return {
    type: 'search_match',
    title: searchType === 'ai_image' ? 'A client searched with a photo matching your products' : 'A client searched for what you offer',
    message,
    data: {
      searchType,
      productType: clean(extracted.productType),
      service: clean(extracted.service),
      material: clean(extracted.material),
      useCase: clean(extracted.useCase),
      quantity,
      city,
      matchPercentage,
      matchedProduct
    }
  };
}

async function notifyMatchedVendors({ searcherId, searchType, query, extracted, results }) {
  const top = (results || [])
    .filter(result => result?._id && Number(result.matchPercentage) >= MIN_MATCH_PERCENTAGE)
    .sort((left, right) => right.matchPercentage - left.matchPercentage)
    .slice(0, MAX_VENDORS_PER_SEARCH);
  if (top.length === 0) return 0;

  // Only listings that are also active vendor accounts can receive in-app alerts.
  const vendorAccounts = await Artisan.find({
    ...PUBLIC_STATUS_FILTER,
    _id: { $in: top.map(result => result._id) },
    hasAccount: true,
    isDeleted: { $ne: true },
    isSuspended: { $ne: true }
  }).select('_id').lean();
  const activeVendorIds = new Set(vendorAccounts.map(vendor => String(vendor._id)));

  const topic = searchTopic(extracted, query);
  const key = dedupeKey(searcherId, topic);
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS);
  const docs = [];

  for (const result of top) {
    const vendorId = String(result._id);
    if (!activeVendorIds.has(vendorId) || vendorId === String(searcherId)) continue;

    const [alreadyNotified, sentToday] = await Promise.all([
      Notification.exists({ userId: vendorId, dedupeKey: key, createdAt: { $gte: since } }),
      Notification.countDocuments({ userId: vendorId, type: 'search_match', createdAt: { $gte: since } })
    ]);
    if (alreadyNotified || sentToday >= DAILY_CAP_PER_VENDOR) continue;

    docs.push({ userId: vendorId, dedupeKey: key, ...buildNotification({ searchType, extracted: extracted || {}, result }) });
  }

  if (docs.length) await Notification.insertMany(docs);
  return docs.length;
}

async function recordSearchAndNotify({ user, searchType, query, extracted, results, simulated = false }) {
  if (!user || mongoose.connection.readyState !== 1) return;
  try {
    const log = await SearchLog.create({
      userId: user._id,
      searchType,
      query: clean(query, 1000),
      extracted: extracted || null,
      resultCount: (results || []).length,
      resultVendorIds: (results || []).map(result => result._id).filter(Boolean).slice(0, 20),
      simulated
    });

    const notified = await notifyMatchedVendors({ searcherId: user._id, searchType, query, extracted, results });
    if (notified) await SearchLog.updateOne({ _id: log._id }, { $set: { notifiedVendorCount: notified } });
  } catch (err) {
    console.warn('Search log / vendor notification skipped:', err.message);
  }
}

module.exports = { recordSearchAndNotify, MIN_MATCH_PERCENTAGE, MAX_VENDORS_PER_SEARCH };
