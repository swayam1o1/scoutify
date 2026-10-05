const SLOW_REQUEST_MS = 2000;

// One line per request once the response is sent, e.g.
//   [2026-10-05 18:16:02] POST /api/search/ai 200 3214ms SLOW user=client:64f0...
// Query strings and bodies are left out: they can carry OTPs, passwords, contact details or photos.
function requestLogger(req, res, next) {
  if (req.method === 'OPTIONS' || process.env.LOG_REQUESTS === 'false') return next();

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6);
    const time = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
    const path = req.originalUrl.split('?')[0];
    const user = req.user ? ` user=${req.user.role || 'user'}:${req.user._id}` : '';
    console.log(`[${time}] ${req.method} ${path} ${res.statusCode} ${ms}ms${ms >= SLOW_REQUEST_MS ? ' SLOW' : ''}${user}`);
  });
  next();
}

module.exports = requestLogger;
