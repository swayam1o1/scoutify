const handle = require('../utils/handle');
const boardService = require('../services/boardService');

const list = handle(async (req, res) => {
  res.json({ boards: await boardService.listBoards(req.user._id) });
}, 'Server error retrieving boards.');

const create = handle(async (req, res) => {
  const boards = await boardService.createBoard(req.user._id, req.body.name);
  res.status(201).json({ message: 'Project board created successfully.', boards });
}, 'Server error creating project board.');

const addVendor = handle(async (req, res) => {
  const boards = await boardService.addVendor(req.user._id, req.params.boardId, req.body.vendorId);
  res.json({ message: 'Artisan saved to project board.', boards });
}, 'Server error saving artisan to board.');

const removeVendor = handle(async (req, res) => {
  const boards = await boardService.removeVendor(req.user._id, req.params.boardId, req.params.vendorId);
  res.json({ message: 'Artisan removed from board.', boards });
}, 'Server error removing artisan from board.');

const remove = handle(async (req, res) => {
  const boards = await boardService.deleteBoard(req.user._id, req.params.boardId);
  res.json({ message: 'Project board deleted.', boards });
}, 'Server error deleting project board.');

const recommendations = handle(async (req, res) => {
  res.json(await boardService.getRecommendations(req.user._id, req.params.boardId));
}, 'Server error generating board recommendations.');

module.exports = { list, create, addVendor, removeVendor, remove, recommendations };
