const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const artisanController = require('../controllers/artisanController');
const catalogueController = require('../controllers/catalogueController');

// Every route here is for the signed-in vendor managing their own listing.
router.use(requireAuth, requireRole('artisan'));

// 1. GET PROFILE
router.get('/profile', artisanController.getProfile);

// 2. UPDATE PROFILE & SYNC WITH PUBLIC ARTISAN ENTRY
router.post('/profile', artisanController.saveProfile);

// 3. PRODUCT CATALOGUE — photos clients can be matched against via image search.
router.get('/catalogue', catalogueController.list);
router.post('/catalogue', catalogueController.add);
router.delete('/catalogue/:itemId', catalogueController.remove);

module.exports = router;
