const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const contestController = require('../controllers/contestController');
const User = require('../models/userModel')


router.get('/me', authMiddleware, authController.getCurrentUser);
router.put('/update', authMiddleware, authController.updateUser);
router.post('/join', authMiddleware, contestController.joinContest);
router.post('/multi-join', authMiddleware, contestController.joinMultipleContests);
router.post('/switch-team', authMiddleware, contestController.switchTeam);
router.get(
    '/match/:matchId', 
    contestController.getContestsByMatchId
);
// In User Service
router.get('/by-id/:userId', async (req, res) => {
    console.log('Incoming user lookup for:', req.params.userId);
    try {
      const user = await User.findById(req.params.userId);
      console.log('Found user:', user ? user._id : 'none');
      
      if (!user) {
        console.warn('User not found');
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (err) {
      console.error('User lookup error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });
router.post('/contests/join-team-contest', authMiddleware, contestController.joinTeamContest); // Add this line
router.delete('/teams/:teamId', authMiddleware, contestController.deleteTeam);
router.get(
    '/internal/participations-by-user-match',
    authMiddleware.protectInternal, // Secure this endpoint
    contestController.getParticipationsForBackfill
);
router.get(
    '/internal/participants-by-match/:matchId',
    authMiddleware.protectInternal, // Secure this endpoint
    contestController.getUniqueParticipantsByMatch
);
module.exports = router;
