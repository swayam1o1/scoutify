const express = require('express');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

// Public list of vendor category tags used by registration and profile pickers.
router.get('/', categoryController.list);

module.exports = router;
