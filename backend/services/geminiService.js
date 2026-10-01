const { GoogleGenerativeAI } = require('@google/generative-ai');

const GENERATION_MODEL = 'gemini-3.6-flash';
const EMBEDDING_MODEL = 'gemini-embedding-001';

// Resolved lazily: GEMINI_API_KEY may arrive from Secrets Manager after routes are required.
let cachedKey = null;
let cachedClient = null;

function getGenAI() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedClient = new GoogleGenerativeAI(key);
  }
  return cachedClient;
}

function getGenerativeModel() {
  const genAI = getGenAI();
  return genAI ? genAI.getGenerativeModel({ model: GENERATION_MODEL }) : null;
}

function isTransientError(err) {
  return /\b(429|500|503)\b|overloaded|high demand/i.test(String(err?.message || ''));
}

async function generateWithRetry(model, content, { retries = 2, delayMs = 1200 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await model.generateContent(content);
    } catch (err) {
      if (attempt >= retries || !isTransientError(err)) throw err;
      await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }
}

async function embedText(text) {
  const genAI = getGenAI();
  if (!genAI || !String(text || '').trim()) return null;
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent(String(text));
  return result.embedding.values;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length || left.length === 0) return 0;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index++) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator ? dot / denominator : 0;
}

module.exports = {
  GENERATION_MODEL,
  EMBEDDING_MODEL,
  getGenAI,
  getGenerativeModel,
  generateWithRetry,
  embedText,
  cosineSimilarity
};
