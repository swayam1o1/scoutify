const handle = require('../utils/handle');
const paymentService = require('../services/paymentService');

const createOrder = handle(async (req, res) => {
  const { plan, currentPassword, totpCode, emailOtp } = req.body;
  res.json(await paymentService.createOrder(req.user, { plan, currentPassword, totpCode, emailOtp }));
}, 'Error initiating payment order.');

const verifyPayment = handle(async (req, res) => {
  const { paymentId, orderId, signature, plan, simulated } = req.body;
  res.json(await paymentService.verifyPayment(req.user, { paymentId, orderId, signature, plan, simulated }));
}, 'Error verifying payment.');

module.exports = { createOrder, verifyPayment };
