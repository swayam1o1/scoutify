const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const HttpError = require('../utils/httpError');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');

const BOARD_VENDORS = { path: 'boards.vendors', select: '-embedding -catalogue.embedding' };

// Try initializing Gemini if key is provided
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function findUser(userId) {
  const user = await User.findById(userId);
  if (!user) throw new HttpError(404, 'User not found.');
  return user;
}

async function populatedBoards(userId) {
  const populated = await User.findById(userId).populate(BOARD_VENDORS);
  return populated.boards;
}

async function listBoards(userId) {
  const user = await User.findById(userId).populate(BOARD_VENDORS);
  if (!user) throw new HttpError(404, 'User not found.');
  return user.boards || [];
}

async function createBoard(userId, name) {
  if (!name || !name.trim()) {
    throw new HttpError(400, 'Board name is required.');
  }

  const user = await findUser(userId);

  // Check if board name already exists
  const nameExists = user.boards.some(b => b.name.toLowerCase() === name.trim().toLowerCase());
  if (nameExists) {
    throw new HttpError(400, 'A project board with this name already exists.');
  }

  user.boards.push({ name: name.trim(), vendors: [] });
  await user.save();

  // Return populated boards so frontend has full vendor objects
  return populatedBoards(userId);
}

async function addVendor(userId, boardId, vendorId) {
  if (!vendorId) throw new HttpError(400, 'Vendor ID is required.');

  const artisan = await Artisan.findById(vendorId);
  if (!artisan) throw new HttpError(404, 'Artisan not found.');

  const user = await findUser(userId);

  const board = user.boards.id(boardId);
  if (!board) throw new HttpError(404, 'Project board not found.');

  // Check if vendor already added
  if (board.vendors.includes(vendorId)) {
    throw new HttpError(400, 'Artisan is already saved in this board.');
  }

  board.vendors.push(vendorId);
  await user.save();

  // Return populated boards so frontend has full vendor objects
  return populatedBoards(userId);
}

async function removeVendor(userId, boardId, vendorId) {
  const user = await findUser(userId);

  const board = user.boards.id(boardId);
  if (!board) throw new HttpError(404, 'Project board not found.');

  board.vendors = board.vendors.filter(v => v.toString() !== vendorId);
  await user.save();

  // Populate vendors before returning updated boards to sync frontend state correctly
  return populatedBoards(userId);
}

async function deleteBoard(userId, boardId) {
  const user = await findUser(userId);

  user.boards = user.boards.filter(b => b._id.toString() !== boardId);
  await user.save();

  // Return populated boards so frontend has full vendor objects
  return populatedBoards(userId);
}

// Board suggestions/recommendations via Gemini, with a rule-based simulation fallback.
async function getRecommendations(userId, boardId) {
  const user = await findUser(userId);

  const board = user.boards.id(boardId);
  if (!board) throw new HttpError(404, 'Board not found.');

  // Populate vendors manually via user parent document
  await user.populate({
    path: 'boards.vendors',
    model: 'Artisan'
  });
  const populatedBoard = user.boards.id(boardId);
  const savedVendors = populatedBoard.vendors;

  // Default simulation recommendations if board is empty
  if (savedVendors.length === 0) {
    const recommendations = await Artisan.find({
      ...PUBLIC_STATUS_FILTER,
      specialization: { $regex: 'Architectural', $options: 'i' }
    }).limit(2);
    return {
      rationale: "This board is empty. We recommend starting with verified local Architectural planners to layout your project design parameters.",
      recommendations,
      simulated: true
    };
  }

  // If Gemini key is set, use AI to generate recommendations
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
      const savedMeta = savedVendors.map(v => ({
        name: v.companyName,
        specializations: v.specialization,
        city: v.city
      }));

      const prompt = `Based on the following list of verified vendors saved to a client's sourcing project board:
${JSON.stringify(savedMeta)}

Analyze what other complementary specialties, trades, or services are needed to successfully execute this project (e.g. if they saved a false ceiling installer, they need painters and designers. If they saved an architect, they need builders/contractors).

Return a JSON object containing:
1. "rationale": A clear, professional 2-sentence explanation of what is recommended and why.
2. "suggestions": An array of up to 2 objects with:
   - "specialization": A key search term (e.g., 'Painting Services', 'Interior Designing Services', 'Full Contracting Services', etc.)
   - "city": The target city (use the same city as the saved vendors if possible, e.g. '${savedVendors[0].city}')

Return the response ONLY as a JSON object, e.g. { "rationale": "Since you have...", "suggestions": [{"specialization": "...", "city": "..."}] }. Do not add markdown code blocks, backticks, or any conversational text.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      let parsed = { rationale: '', suggestions: [] };
      try {
        const cleanJsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanJsonStr);
      } catch (e) {
        console.warn('Gemini recommendation JSON parse failed, falling back:', text);
      }

      if (parsed.suggestions && parsed.suggestions.length > 0) {
        const queryConditions = parsed.suggestions.map(s => ({
          $and: [
            { specialization: { $regex: s.specialization.trim(), $options: 'i' } },
            { city: { $regex: s.city.trim(), $options: 'i' } }
          ]
        }));

        let recommendations = await Artisan.find({ ...PUBLIC_STATUS_FILTER, $or: queryConditions }).limit(4);

        if (recommendations.length === 0) {
          const fallbackSpecs = parsed.suggestions.map(s => s.specialization);
          recommendations = await Artisan.find({
            ...PUBLIC_STATUS_FILTER,
            specialization: { $in: fallbackSpecs }
          }).limit(2);
        }

        // Filter out vendors already on the board
        const savedIds = savedVendors.map(v => v._id.toString());
        recommendations = recommendations.filter(r => !savedIds.includes(r._id.toString()));

        return {
          rationale: parsed.rationale || "Complementary vendors suggested based on your board's content.",
          recommendations,
          simulated: false
        };
      }
    } catch (err) {
      console.error('Gemini recommendations pipeline failed, running simulation fallback:', err.message);
    }
  }

  // --- SIMULATED AI RECOMMENDATIONS (FALLBACK) ---
  const citiesList = savedVendors.map(v => v.city);
  const primaryCity = citiesList[0] || 'Tirupati';
  const specLower = savedVendors[0].specialization[0].toLowerCase();

  let recommendedSpec = 'Painting Services';
  let rationaleText = `Since you saved ${savedVendors[0].companyName} for specialized services, we recommend adding a verified Painting Contractor in ${primaryCity} to handle color finishes and layer detailing.`;

  if (specLower.includes('ceiling')) {
    recommendedSpec = 'Interior Designing';
    rationaleText = `Since you saved a False Ceiling specialist, we recommend hiring a local Interior Designer in ${primaryCity} to coordinate room acoustics, lighting placements, and structural themes.`;
  } else if (specLower.includes('architect') || specLower.includes('design')) {
    recommendedSpec = 'Full Contracting';
    rationaleText = `With design layouts saved, we recommend adding a Full Contracting vendor in ${primaryCity} to translate planning drafts into execution schedules.`;
  }

  let recommendations = await Artisan.find({
    $and: [
      PUBLIC_STATUS_FILTER,
      { specialization: { $regex: recommendedSpec, $options: 'i' } },
      { city: { $regex: primaryCity, $options: 'i' } }
    ]
  }).limit(2);

  if (recommendations.length === 0) {
    recommendations = await Artisan.find({ ...PUBLIC_STATUS_FILTER, city: primaryCity }).limit(2);
  }

  // Filter out already saved
  const savedIds = savedVendors.map(v => v._id.toString());
  recommendations = recommendations.filter(r => !savedIds.includes(r._id.toString()));

  return {
    rationale: rationaleText,
    recommendations,
    simulated: true
  };
}

module.exports = { listBoards, createBoard, addVendor, removeVendor, deleteBoard, getRecommendations };
