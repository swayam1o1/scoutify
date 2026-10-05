const jwt = require('jsonwebtoken');
const { findAccountById } = require('../services/accountLookupService');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

function tokenVersionOf(user) {
  return Number(user?.tokenVersion || 0);
}

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, tv: tokenVersionOf(user) },
    JWT_SECRET,
    { expiresIn: '1d' }
  );
}

function bumpTokenVersion(user) {
  user.tokenVersion = tokenVersionOf(user) + 1;
}

function isSessionValid(decoded, user) {
  if (!decoded || !user) return false;
  return Number(decoded.tv || 0) === tokenVersionOf(user);
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
    const user = await findAccountById(decoded.id, decoded.role);
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.isDeleted) return res.status(401).json({ message: 'This account has been deleted.' });
    if (user.isSuspended) return res.status(403).json({ message: 'This account is suspended. Contact Scoutify support.' });
    if (!isSessionValid(decoded, user)) {
      return res.status(401).json({
        message: 'Session expired. Please sign in again.',
        code: 'SESSION_REVOKED'
      });
    }

    req.user = user;
    req.userId = user._id;
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error during authentication.' });
  }
}

// Sets req.user when a valid Bearer token is present; guests continue with req.user = null.
async function optionalAuth(req, res, next) {
  req.user = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
      const user = await findAccountById(decoded.id, decoded.role);
      if (user && isSessionValid(decoded, user) && !user.isDeleted && !user.isSuspended) {
        req.user = user;
        req.userId = user._id;
      }
    } catch (err) {
      // Expired or invalid token: treat as guest.
    }
  }
  next();
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

// Admins must have Google Authenticator enabled before using admin APIs (SRS 3.2).
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'No token provided.' });
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  if (!req.user.twoFactorEnabled) {
    return res.status(403).json({
      message: 'Administrators must enable Google Authenticator before using admin tools.',
      code: 'ADMIN_2FA_REQUIRED'
    });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  signToken,
  bumpTokenVersion,
  tokenVersionOf,
  isSessionValid,
  requireAuth,
  optionalAuth,
  requireRole,
  requireAdmin
};
