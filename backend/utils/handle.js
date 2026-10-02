const HttpError = require('./httpError');

/**
 * Wraps an async controller. HttpErrors become their status + JSON body; anything
 * else is logged and answered with a 500 carrying the endpoint's fallback message.
 */
function handle(controller, fallbackMessage = 'Server error.') {
  return async (req, res, next) => {
    try {
      await controller(req, res, next);
    } catch (err) {
      if (res.headersSent) {
        console.error(err);
        return;
      }
      if (err instanceof HttpError) {
        return res.status(err.status).json({ message: err.message, ...err.extra });
      }
      console.error(err);
      res.status(500).json({ message: fallbackMessage });
    }
  };
}

module.exports = handle;
