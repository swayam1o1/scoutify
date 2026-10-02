const handle = require('../utils/handle');
const catalogueService = require('../services/catalogueService');

const list = handle(async (req, res) => {
  res.json(await catalogueService.listCatalogue(req.user._id));
}, 'Error loading catalogue.');

const add = handle(async (req, res) => {
  res.status(201).json(await catalogueService.addCatalogueItem(req.user._id, req.body));
}, 'Error adding catalogue product.');

const remove = handle(async (req, res) => {
  res.json(await catalogueService.removeCatalogueItem(req.user._id, req.params.itemId));
}, 'Error removing catalogue product.');

module.exports = { list, add, remove };
