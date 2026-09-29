require('dotenv').config();
const loadSecrets = require('./loadSecrets');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const searchRoutes = require('./routes/search');
const paymentsRoutes = require('./routes/payments');
const artisanRoutes = require('./routes/artisan');
const aiSearchRoutes = require('./routes/aiSearch');
const boardsRoutes = require('./routes/boards');
const adminRoutes = require('./routes/admin');
const categoriesRoutes = require('./routes/categories');
const { isLocalStorage, LOCAL_UPLOAD_DIR, LOCAL_URL_PREFIX } = require('./utils/storage');

async function startServer() {
  await loadSecrets();

  const app = express();
  const PORT = process.env.PORT || 5001;
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/scoutify';

  // Middlewares
  app.use(cors());
  // Photo uploads arrive as base64 data URLs (5 MB image ≈ 6.7 MB encoded).
  app.use(express.json({ limit: '8mb' }));

  if (isLocalStorage()) {
    app.use(LOCAL_URL_PREFIX, express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', index: false }));
  }

  // Routes mapping
  app.use('/api/auth', authRoutes);
  app.use('/api/search', searchRoutes);
  app.use('/api/search/ai', aiSearchRoutes);
  app.use('/api/payments', paymentsRoutes);
  app.use('/api/artisan', artisanRoutes);
  app.use('/api/boards', boardsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/categories', categoriesRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Scoutify backend is running.' });
  });

  app.get('/', (req, res) => {
    res.json({
      name: 'Scoutify API',
      status: 'OK',
      frontend: 'http://127.0.0.1:5173/',
      health: '/api/health'
    });
  });

  // Database Connection & Server Listener
  mongoose.connect(MONGO_URI)
    .then(() => {
      console.log('Connected to MongoDB database.');
      app.listen(PORT, () => {
        console.log(`Scoutify Server is running on port ${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err);
      process.exit(1);
    });
}

startServer();
