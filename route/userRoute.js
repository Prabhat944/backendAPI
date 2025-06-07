const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const contestController = require('../controllers/contestController');


router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/update', authMiddleware, authController.updateUser);
router.post('/join', authMiddleware, contestController.joinContest);
router.post('/multi-join', authMiddleware, contestController.joinMultipleContests);
router.get(
    '/match/:matchId', 
    contestController.getContestsByMatchId
);


module.exports = router;
