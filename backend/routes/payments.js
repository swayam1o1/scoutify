const express = require('express');
const { requireAuth } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

// 1. CREATE RAZORPAY ORDER — requires re-auth (SRS 3.2)
router.post('/create-order', requireAuth, paymentController.createOrder);

// 2. VERIFY PAYMENT & UPGRADE PLAN
router.post('/verify-payment', requireAuth, paymentController.verifyPayment);

module.exports = router;
