const express = require('express');
const router = express.Router();
const controller = require('../controllers/cricketController');
const authMiddleware = require('../middleware/authMiddleware');


router.get('/cricket/up-coming-matches', controller.upcomingMatches);
router.get('/cricket/match/:matchId', controller.getMatchDetails);
router.get('/cricket/recent-matches', controller.getRecentMatches);
router.get('/my-matches', authMiddleware, controller.getMyMatches);

module.exports = router;
