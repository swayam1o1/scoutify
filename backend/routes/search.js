const express = require('express');
const { optionalAuth } = require('../middleware/auth');
const searchController = require('../controllers/searchController');

const router = express.Router();

router.get('/', optionalAuth, searchController.standardSearch);

module.exports = router;
