const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');
const matchController = require('../controllers/matchSquadController');
const authMiddleware = require('../middleware/authMiddleware');
const internalAuth = require('../middleware/internalAuth'); 

router.post('/team/create', authMiddleware, teamController.createTeam);

router.get('/team/user', authMiddleware, teamController.getUserTeams);

router.get('/match/squad', authMiddleware, matchController.getMatchSquad);

router.put('/teams/:teamId', authMiddleware, teamController.updateUserTeam);

router.post('/team/clone/:teamId', authMiddleware, teamController.cloneTeam);

router.post('/internal/by-ids', internalAuth, teamController.getTeamsByIds);

module.exports = router;
