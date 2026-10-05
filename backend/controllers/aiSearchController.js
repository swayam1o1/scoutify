const handle = require('../utils/handle');
const aiSearchService = require('../services/aiSearchService');
const { recordSearchAndNotify } = require('../services/searchNotificationService');

// The response is sent first; search logging / vendor notifications run fire-and-forget afterwards.
const textSearch = handle(async (req, res) => {
  const { query } = req.body;
  aiSearchService.validateTextQuery(query);
  const user = await aiSearchService.authenticateClient(req.headers.authorization);
  req.user = user;

  const { payload, search } = await aiSearchService.textSearch(query, user);
  res.json(payload);
  recordSearchAndNotify({ user, ...search });
}, 'Error processing AI Matchmaker search.');

const imageSearch = handle(async (req, res) => {
  const user = await aiSearchService.authenticateClient(req.headers.authorization);
  req.user = user;

  const { payload, search } = await aiSearchService.imageSearch({ image: req.body.image, note: req.body.note }, user);
  res.json(payload);
  recordSearchAndNotify({ user, ...search });
}, 'Error processing photo search.');

module.exports = { textSearch, imageSearch };
