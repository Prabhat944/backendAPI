const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchSquadController');
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, sensitiveActionLimiter } = require('../middleware/rateLimiters');
const internalAuth = require('../middleware/internalAuth'); 

router.post('/team/create', authMiddleware, sensitiveActionLimiter, teamController.createTeam);

router.get('/team/user', authMiddleware, generalLimiter, teamController.getUserTeams);

router.get('/match/squad', authMiddleware, generalLimiter, matchController.getMatchSquad);

router.put('/teams/:teamId', authMiddleware, sensitiveActionLimiter, teamController.updateUserTeam);

router.post('/team/clone/:teamId', authMiddleware, sensitiveActionLimiter, teamController.cloneTeam);

router.post('/internal/by-ids', internalAuth, teamController.getTeamsByIds);

module.exports = router;