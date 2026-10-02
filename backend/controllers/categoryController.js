const { VENDOR_CATEGORIES } = require('../constants/categories');

function list(req, res) {
  res.json({ categories: VENDOR_CATEGORIES });
}

module.exports = { list };
