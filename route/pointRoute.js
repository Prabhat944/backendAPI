const express = require('express');
const router = express.Router();

const { getTeamWithLivePoints } = require('../controllers/pointController');

router.get('/team/:teamId', getTeamWithLivePoints);

module.exports = router;