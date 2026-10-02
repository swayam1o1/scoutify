require('dotenv').config();
const loadSecrets = require('./config/loadSecrets');
const { connectDatabase } = require('./config/database');

async function startServer() {
  // Secrets must be in process.env before route modules read them at require time.
  await loadSecrets();
  const createApp = require('./app');

  const app = createApp();
  const PORT = process.env.PORT || 5001;

  try {
    await connectDatabase();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Scoutify Server is running on port ${PORT}`);
  });
}

startServer();
