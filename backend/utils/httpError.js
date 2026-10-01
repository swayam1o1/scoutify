/**
 * Error with an HTTP status, thrown by services for expected failures (validation,
 * not found, forbidden). `extra` fields are merged into the JSON response body,
 * e.g. new HttpError(401, 'Session expired.', { code: 'SESSION_REVOKED' }).
 */
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.extra = extra;
  }
}

module.exports = HttpError;
