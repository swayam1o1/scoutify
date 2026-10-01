const handle = require('../utils/handle');
const adminService = require('../services/adminService');

const login = handle(async (req, res) => {
  res.json(await adminService.login(req.body.email, req.body.password));
}, 'Server error during admin login.');

const stats = handle(async (req, res) => {
  res.json(await adminService.getStats());
}, 'Server error loading admin stats.');

const listVendors = handle(async (req, res) => {
  const { status, search, limit } = req.query;
  res.json(await adminService.listVendors({ status, search, limit }));
}, 'Server error loading vendors.');

const getVendor = handle(async (req, res) => {
  res.json(await adminService.getVendorDetail(req.params.id));
}, 'Server error loading vendor details.');

const updateVendorStatus = handle(async (req, res) => {
  res.json(await adminService.updateVendorStatus(req.user, req.params.id, req.body.status));
}, 'Server error updating vendor status.');

const createVendor = handle(async (req, res) => {
  res.status(201).json(await adminService.createVendor(req.user, req.body));
}, 'Server error creating vendor.');

const deleteVendor = handle(async (req, res) => {
  await adminService.deleteVendor(req.user, req.params.id);
  res.json({ message: 'Vendor listing deleted.' });
}, 'Server error deleting vendor.');

const listConsumers = handle(async (req, res) => {
  const { includeDeleted, search, limit } = req.query;
  res.json(await adminService.listConsumers({ includeDeleted, search, limit }));
}, 'Server error loading consumers.');

const updateConsumer = handle(async (req, res) => {
  res.json(await adminService.setConsumerSuspended(req.user, req.params.id, req.body.isSuspended));
}, 'Server error updating consumer.');

const deleteConsumer = handle(async (req, res) => {
  await adminService.softDeleteConsumer(req.user, req.params.id);
  res.json({ message: 'Consumer account deleted.' });
}, 'Server error deleting consumer.');

const auditLogs = handle(async (req, res) => {
  res.json(await adminService.listAuditLogs({ limit: req.query.limit }));
}, 'Server error loading audit logs.');

module.exports = {
  login,
  stats,
  listVendors,
  getVendor,
  updateVendorStatus,
  createVendor,
  deleteVendor,
  listConsumers,
  updateConsumer,
  deleteConsumer,
  auditLogs
};
