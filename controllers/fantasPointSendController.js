// controllers/fantasyConfigController.js

const pointRules = require('../utils/pointRules'); // Adjust path to your pointRules.js file

/**
 * @desc Get all fantasy point rules
 * @route GET /api/config/point-rules
 * @access Public (or private, depending on your app's needs)
 */
exports.getPointRules = (req, res) => {
    try {
        res.status(200).json(pointRules);
    } catch (error) {
        console.error('Error fetching point rules:', error);
        res.status(500).json({ message: 'Failed to retrieve fantasy point rules.' });
    }
};

// You could add other config-related functions here later, e.g.,
// exports.getGameSettings = (req, res) => { /* ... */ };