const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const User = require('../models/User');
const Artisan = require('../models/Artisan');
const { requireAuth, requireRole } = require('../middleware/auth');
const { PUBLIC_STATUS_FILTER } = require('../constants/artisan');

// Try initializing Gemini if key is provided
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Sourcing boards belong to client accounts only.
router.use(requireAuth, requireRole('client'));

// 1. Get all boards for the logged in user
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('boards.vendors');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    res.json({ boards: user.boards || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error retrieving boards.' });
  }
});

// 2. Create a new board
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Board name is required.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    // Check if board name already exists
    const nameExists = user.boards.some(b => b.name.toLowerCase() === name.trim().toLowerCase());
    if (nameExists) {
      return res.status(400).json({ message: 'A project board with this name already exists.' });
    }

    user.boards.push({ name: name.trim(), vendors: [] });
    await user.save();

    // Return populated boards so frontend has full vendor objects
    const populated = await User.findById(req.user._id).populate('boards.vendors');
    res.status(201).json({ message: 'Project board created successfully.', boards: populated.boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating project board.' });
  }
});

// 3. Add a vendor to a board
router.post('/:boardId/vendors', async (req, res) => {
  try {
    const { vendorId } = req.body;
    if (!vendorId) return res.status(400).json({ message: 'Vendor ID is required.' });

    const artisan = await Artisan.findById(vendorId);
    if (!artisan) return res.status(404).json({ message: 'Artisan not found.' });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const board = user.boards.id(req.params.boardId);
    if (!board) return res.status(404).json({ message: 'Project board not found.' });

    // Check if vendor already added
    if (board.vendors.includes(vendorId)) {
      return res.status(400).json({ message: 'Artisan is already saved in this board.' });
    }

    board.vendors.push(vendorId);
    await user.save();

    // Return populated boards so frontend has full vendor objects
    const populated = await User.findById(req.user._id).populate('boards.vendors');
    res.json({ message: 'Artisan saved to project board.', boards: populated.boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error saving artisan to board.' });
  }
});

// 4. Remove a vendor from a board
router.delete('/:boardId/vendors/:vendorId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const board = user.boards.id(req.params.boardId);
    if (!board) return res.status(404).json({ message: 'Project board not found.' });

    board.vendors = board.vendors.filter(v => v.toString() !== req.params.vendorId);
    await user.save();

    // Populate vendors before returning updated boards to sync frontend state correctly
    const populatedUser = await User.findById(req.user._id).populate('boards.vendors');

    res.json({ message: 'Artisan removed from board.', boards: populatedUser.boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error removing artisan from board.' });
  }
});

// 5. Delete a board
router.delete('/:boardId', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    user.boards = user.boards.filter(b => b._id.toString() !== req.params.boardId);
    await user.save();

    // Return populated boards so frontend has full vendor objects
    const populated = await User.findById(req.user._id).populate('boards.vendors');
    res.json({ message: 'Project board deleted.', boards: populated.boards });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting project board.' });
  }
});

// 6. Get board suggestions/recommendations via Gemini
router.get('/:boardId/recommendations', async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const board = user.boards.id(req.params.boardId);
    if (!board) return res.status(404).json({ message: 'Board not found.' });

    // Populate vendors manually via user parent document
    await user.populate({
      path: 'boards.vendors',
      model: 'Artisan'
    });
    const populatedBoard = user.boards.id(req.params.boardId);
    const savedVendors = populatedBoard.vendors;


    // Default simulation recommendations if board is empty
    if (savedVendors.length === 0) {
      const recommendations = await Artisan.find({
        ...PUBLIC_STATUS_FILTER,
        specialization: { $regex: 'Architectural', $options: 'i' }
      }).limit(2);
      return res.json({
        rationale: "This board is empty. We recommend starting with verified local Architectural planners to layout your project design parameters.",
        recommendations,
        simulated: true
      });
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

          return res.json({
            rationale: parsed.rationale || "Complementary vendors suggested based on your board's content.",
            recommendations,
            simulated: false
          });
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

    res.json({
      rationale: rationaleText,
      recommendations,
      simulated: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error generating board recommendations.' });
  }
});

module.exports = router;

