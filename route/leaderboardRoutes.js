const express = require('express');
const router = express.Router();
const { getMatchLeaderboard } = require('../controllers/leaderboardController');
const authMiddleware = require('../middleware/authMiddleware'); // Your authentication middleware

// The route to get a leaderboard by its matchId
router.get('/:matchId', authMiddleware, getMatchLeaderboard);

module.exports = router;