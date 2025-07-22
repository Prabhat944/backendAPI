const express = require('express');
const router = express.Router();
const controller = require('../controllers/cricketController');
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter } = require('../middleware/rateLimiters');

router.get('/cricket/up-coming-matches', generalLimiter, controller.getUpcomingMatches);
router.get('/cricket/match/:matchId', generalLimiter, controller.getMatchDetails);
router.get('/cricket/recent-matches', generalLimiter, controller.getRecentMatches);
console.log('Cricket routes loaded');
router.get('/my-matches', authMiddleware, generalLimiter, controller.getMyMatches);
router.get(
    '/matches/my-contests/:matchId', 
    authMiddleware,
    generalLimiter,
    controller.getUserContestsForMatch
);
module.exports = router;
