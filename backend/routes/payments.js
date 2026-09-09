const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Razorpay = require('razorpay');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretscoutifykey12345';

// Razorpay SDK configuration
let rzp;
const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;
const simulationEnabled = process.env.ENABLE_PAYMENT_SIMULATION === 'true';

if (keyId && keySecret) {
  rzp = new Razorpay({
    key_id: keyId,
    key_secret: keySecret
  });
}

// 1. CREATE RAZORPAY ORDER
router.post('/create-order', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized. Log in to upgrade.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { plan } = req.body;
    let amount = 0;
    if (plan === 'pro') amount = 999;
    else if (plan === 'enterprise') amount = 4999;
    else return res.status(400).json({ message: 'Invalid plan selected.' });

    // Try creating real Razorpay order if SDK is initialized
    if (rzp) {
      try {
        const order = await rzp.orders.create({
          amount: amount * 100, // in paise
          currency: 'INR',
          receipt: `receipt_${decoded.id}_${Date.now()}`
        });
        return res.json({
          simulated: false,
          keyId: keyId,
          orderId: order.id,
          amount: order.amount,
          plan
        });
      } catch (err) {
        console.warn('Razorpay order creation failed, falling back to simulation:', err.message);
      }
    }

    if (!simulationEnabled) {
      return res.status(503).json({ message: 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' });
    }

    // Fallback: Simulated Order
    res.json({
      simulated: true,
      orderId: `order_sim_${Math.random().toString(36).substr(2, 9)}`,
      amount: amount * 100,
      plan
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error initiating payment order.' });
  }
});

// 2. VERIFY PAYMENT & UPGRADE PLAN
router.post('/verify-payment', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Unauthorized.' });

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const { paymentId, orderId, signature, plan, simulated } = req.body;

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (simulated && simulationEnabled) {
      user.subscriptionPlan = plan;
      await user.save();
      return res.json({
        message: 'Subscription upgraded successfully (Simulated Payment).',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          subscriptionPlan: user.subscriptionPlan,
          twoFactorEnabled: user.twoFactorEnabled
        }
      });
    } else if (simulated) {
      return res.status(400).json({ message: 'Simulated payments are disabled.' });
    }

    // Real Signature Verification
    if (keySecret) {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', keySecret);
      hmac.update(orderId + '|' + paymentId);
      const generatedSignature = hmac.digest('hex');

      if (generatedSignature === signature) {
        user.subscriptionPlan = plan;
        await user.save();
        res.json({
          message: 'Subscription upgraded successfully via Razorpay.',
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            subscriptionPlan: user.subscriptionPlan,
            twoFactorEnabled: user.twoFactorEnabled
          }
        });
      } else {
        res.status(400).json({ message: 'Razorpay signature verification failed.' });
      }
    } else {
      res.status(400).json({ message: 'Payment verification failed: Razorpay configuration missing.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error verifying payment.' });
  }
});

module.exports = router;
