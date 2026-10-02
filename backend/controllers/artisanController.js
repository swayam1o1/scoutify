const handle = require('../utils/handle');
const artisanService = require('../services/artisanService');

const getProfile = handle(async (req, res) => {
  res.json(await artisanService.getProfile(req.user));
}, 'Error loading artisan profile.');

const saveProfile = handle(async (req, res) => {
  res.json(await artisanService.saveProfile(req.user, req.body));
}, 'Error updating artisan profile.');

module.exports = { getProfile, saveProfile };
