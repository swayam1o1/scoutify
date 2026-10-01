const crypto = require('crypto');
const Razorpay = require('razorpay');
const HttpError = require('../utils/httpError');
const { assertReauth, clearReauthChallenge } = require('./reauthService');

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

function publicUserPayload(user) {
  return {
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
  };
}

// Re-auth required (SRS 3.2)
async function createOrder(user, { plan, currentPassword, totpCode, emailOtp }) {
  const amount = planAmount(plan);
  if (amount == null) throw new HttpError(400, 'Invalid plan selected.');

  const reauthErr = await assertReauth(user, { currentPassword, totpCode, emailOtp });
  if (reauthErr) {
    const { message, ...extra } = reauthErr;
    throw new HttpError(reauthErr.status, message, extra);
  }
  clearReauthChallenge(user);
  await user.save();

  // Try creating real Razorpay order if SDK is initialized
  if (rzp) {
    try {
      const order = await rzp.orders.create({
        amount: amount * 100, // in paise
        currency: 'INR',
        receipt: `receipt_${user._id}_${Date.now()}`
      });
      return {
        simulated: false,
        keyId: keyId,
        orderId: order.id,
        amount: order.amount,
        plan
      };
    } catch (err) {
      console.warn('Razorpay order creation failed, falling back to simulation:', err.message);
    }
  }

  if (!simulationEnabled) {
    throw new HttpError(503, 'Razorpay is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }

  // Fallback: Simulated Order
  return {
    simulated: true,
    orderId: `order_sim_${Math.random().toString(36).substr(2, 9)}`,
    amount: amount * 100,
    plan
  };
}

// Re-auth already enforced on create-order; payment signature (or simulation flag) gates the upgrade.
async function verifyPayment(user, { paymentId, orderId, signature, plan, simulated }) {
  if (simulated && simulationEnabled) {
    user.subscriptionPlan = plan;
    await user.save();
    return {
      message: 'Subscription upgraded successfully (Simulated Payment).',
      user: publicUserPayload(user)
    };
  } else if (simulated) {
    throw new HttpError(400, 'Simulated payments are disabled.');
  }

  // Real Signature Verification
  if (!keySecret) {
    throw new HttpError(400, 'Payment verification failed: Razorpay configuration missing.');
  }

  const hmac = crypto.createHmac('sha256', keySecret);
  hmac.update(orderId + '|' + paymentId);
  const generatedSignature = hmac.digest('hex');

  if (generatedSignature !== signature) {
    throw new HttpError(400, 'Razorpay signature verification failed.');
  }

  user.subscriptionPlan = plan;
  await user.save();
  return {
    message: 'Subscription upgraded successfully via Razorpay.',
    user: publicUserPayload(user)
  };
}

module.exports = { createOrder, verifyPayment };
