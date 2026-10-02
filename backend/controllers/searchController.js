const handle = require('../utils/handle');
const searchService = require('../services/searchService');

const standardSearch = handle(async (req, res) => {
  const { service, location } = req.query;
  res.json(await searchService.standardSearch({ service, location }, req.user));
}, 'Error performing search.');

module.exports = { standardSearch };
