const express = require('express');
const router = express.Router();
const controller = require('../controllers/cricketController');
const authMiddleware = require('../middleware/authMiddleware');


router.get('/cricket/up-coming-matches', controller.getUpcomingMatches);
router.get('/cricket/match/:matchId', controller.getMatchDetails);
router.get('/cricket/recent-matches', controller.getRecentMatches);
console.log('Cricket routes loaded');
router.get('/my-matches', authMiddleware, controller.getMyMatches);

module.exports = router;
