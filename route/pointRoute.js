const express = require('express');
const router = express.Router();

const { getTeamWithLivePoints } = require('../controllers/pointController');
const fantasyConfigController = require('../controllers/fantasPointSendController'); // Adjust path

router.get('/team/:teamId', getTeamWithLivePoints);

router.get('/point-rules', fantasyConfigController.getPointRules);

module.exports = router;