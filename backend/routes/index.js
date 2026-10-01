const express = require('express');

const router = express.Router();

router.use('/auth', require('./auth'));
router.use('/search', require('./search'));
router.use('/search/ai', require('./aiSearch'));
router.use('/payments', require('./payments'));
router.use('/artisan', require('./artisan'));
router.use('/boards', require('./boards'));
router.use('/admin', require('./admin'));
router.use('/categories', require('./categories'));
router.use('/notifications', require('./notifications'));

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Scoutify backend is running.' });
});

module.exports = router;
