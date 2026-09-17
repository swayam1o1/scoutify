const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
}

function readBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  return parts.length > 1 ? parts[1] : parts[0];
}

// Loads the JWT owner onto req.user. Soft-deleted and suspended accounts are
// rejected here so an already-issued token stops working immediately.
async function requireAuth(req, res, next) {
  const token = readBearerToken(req);
  if (!token) return res.status(401).json({ message: 'No token provided.' });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token.' });
  }

  try {
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isDeleted) return res.status(401).json({ message: 'This account has been deleted.' });
    if (user.isSuspended) return res.status(403).json({ message: 'This account is suspended. Contact Scoutify support.' });

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error during authentication.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'No token provided.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access denied. Allowed roles: ${roles.join(', ')}.` });
    }
    next();
  };
}

const requireAdmin = requireRole('admin');

module.exports = {
  JWT_SECRET,
  signToken,
  requireAuth,
  requireRole,
  requireAdmin
};
