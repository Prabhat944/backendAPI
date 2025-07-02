const express = require('express');
const router = express.Router();
const { getSeasonLeaderboard} = require('../controllers/playerStatsController');

// router.post('/update-season-stats/:matchId', updatePlayerSeasonStatsController);
router.get('/season-leaderboard/:seriesId', getSeasonLeaderboard);

module.exports = router;
