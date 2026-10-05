const express = require('express');
const aiSearchController = require('../controllers/aiSearchController');

const router = express.Router();

router.post('/', aiSearchController.textSearch);
// Photo search: client uploads a picture of the item they want; the photo is
// analysed in memory (never stored) and matched against vendor catalogues.
router.post('/image', aiSearchController.imageSearch);

module.exports = router;
