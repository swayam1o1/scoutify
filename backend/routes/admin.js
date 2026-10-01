const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

const router = express.Router();

// 1. ADMIN LOGIN — admin-role accounts only, separate from the consumer login.
router.post('/login', adminController.login);

// Everything below requires an admin token.
router.use(requireAuth, requireAdmin);

// 2. DASHBOARD STATS
router.get('/stats', adminController.stats);

// 3. VENDOR LISTINGS
router.get('/vendors', adminController.listVendors);

// 3b. VENDOR DETAIL — full listing, owner account, and what changed since the last approval.
router.get('/vendors/:id', adminController.getVendor);

// 4. APPROVE / REJECT / RESET A VENDOR LISTING
router.patch('/vendors/:id/status', adminController.updateVendorStatus);

// 5. MANUALLY CREATE A VENDOR LISTING
router.post('/vendors', adminController.createVendor);

// 6. DELETE A VENDOR LISTING
router.delete('/vendors/:id', adminController.deleteVendor);

// 7. CONSUMER (CLIENT) ACCOUNTS
router.get('/consumers', adminController.listConsumers);

// 8. SUSPEND / REINSTATE A CONSUMER
router.patch('/consumers/:id', adminController.updateConsumer);

// 9. SOFT DELETE A CONSUMER
router.delete('/consumers/:id', adminController.deleteConsumer);

// 10. RECENT AUDIT LOGS
router.get('/audit-logs', adminController.auditLogs);

module.exports = router;
