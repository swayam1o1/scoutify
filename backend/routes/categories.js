const express = require('express');
const router = express.Router();
const { VENDOR_CATEGORIES } = require('../constants/categories');

// Public list of vendor category tags used by registration and profile pickers.
router.get('/', (req, res) => {
  res.json({ categories: VENDOR_CATEGORIES });
});

module.exports = router;
