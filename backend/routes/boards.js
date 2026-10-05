const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const boardController = require('../controllers/boardController');

// Sourcing boards belong to client accounts only.
router.use(requireAuth, requireRole('client'));

// 1. Get all boards for the logged in user
router.get('/', boardController.list);

// 2. Create a new board
router.post('/', boardController.create);

// 3. Add a vendor to a board
router.post('/:boardId/vendors', boardController.addVendor);

// 4. Remove a vendor from a board
router.delete('/:boardId/vendors/:vendorId', boardController.removeVendor);

// 5. Delete a board
router.delete('/:boardId', boardController.remove);

// 6. Get board suggestions/recommendations via Gemini
router.get('/:boardId/recommendations', boardController.recommendations);

module.exports = router;
