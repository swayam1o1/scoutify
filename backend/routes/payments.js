const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const { requireAuth } = require('../middleware/auth');
const { assertReauth, clearReauthChallenge } = require('../utils/reauth');

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

function planAmount(plan) {
  if (plan === 'pro') return 999;
  if (plan === 'enterprise') return 4999;
  return null;
}

// 1. CREATE RAZORPAY ORDER — requires re-auth (SRS 3.2)
router.post('/create-order', requireAuth, async (req, res) => {
  try {
    const { plan, currentPassword, totpCode, emailOtp } = req.body;
    const amount = planAmount(plan);
    if (amount == null) return res.status(400).json({ message: 'Invalid plan selected.' });

    const reauthErr = await assertReauth(req.user, { currentPassword, totpCode, emailOtp });
    if (reauthErr) return res.status(reauthErr.status).json(reauthErr);
    clearReauthChallenge(req.user);
    await req.user.save();

    // Try creating real Razorpay order if SDK is initialized
    if (rzp) {
      try {
        const order = await rzp.orders.create({
          amount: amount * 100, // in paise
          currency: 'INR',
          receipt: `receipt_${req.user._id}_${Date.now()}`
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
// Re-auth already enforced on create-order; payment signature (or simulation flag) gates the upgrade.
router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const { paymentId, orderId, signature, plan, simulated } = req.body;
    const user = req.user;

    const publicUserPayload = () => ({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscriptionPlan: user.subscriptionPlan,
      twoFactorEnabled: user.twoFactorEnabled,
      hasPassword: !!user.passwordHash,
      mustEnable2FA: user.role === 'admin' && !user.twoFactorEnabled,
      phoneNumber: user.phoneNumber || null,
      phoneVerified: !!user.phoneVerified
    });

    if (simulated && simulationEnabled) {
      user.subscriptionPlan = plan;
      await user.save();
      return res.json({
        message: 'Subscription upgraded successfully (Simulated Payment).',
        user: publicUserPayload()
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
          user: publicUserPayload()
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
