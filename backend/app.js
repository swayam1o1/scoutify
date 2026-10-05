const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const { isLocalStorage, LOCAL_UPLOAD_DIR, LOCAL_URL_PREFIX } = require('./services/storageService');

function createApp() {
  const app = express();

  app.use(requestLogger);
  app.use(cors());
  // Photo uploads arrive as base64 data URLs (5 MB image ≈ 6.7 MB encoded).
  app.use(express.json({ limit: '8mb' }));

  if (isLocalStorage()) {
    app.use(LOCAL_URL_PREFIX, express.static(LOCAL_UPLOAD_DIR, { maxAge: '7d', index: false }));
  }

  app.use('/api', apiRoutes);

  app.get('/', (req, res) => {
    res.json({
      name: 'Scoutify API',
      status: 'OK',
      frontend: 'http://127.0.0.1:5173/',
      health: '/api/health'
    });
  });

  return app;
}

module.exports = createApp;
