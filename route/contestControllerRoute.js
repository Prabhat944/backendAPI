// In your routes/debugRoutes.js (or similar)
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const contestController = require('../controllers/contestController');
const internalAuth = require('../middleware/internalAuth'); 
const { generalLimiter, sensitiveActionLimiter } = require('../middleware/rateLimiters');
// Assuming your controller is named debugController or contestController
const { getContestsForMatchCheck } = require('../controllers/contestCheckController'); // Adjust path

router.get(
    '/match/:matchId', generalLimiter, contestController.getContestsByMatchId);
router.get('/check-contests', generalLimiter, getContestsForMatchCheck); // Or with auth middleware
router.post('/join', authMiddleware, sensitiveActionLimiter, contestController.joinContest);
router.post('/multi-join', authMiddleware, sensitiveActionLimiter, contestController.joinMultipleContests);
router.post('/switch-team', authMiddleware, sensitiveActionLimiter,  contestController.switchTeam);
router.post('/contests/join-team-contest', authMiddleware, sensitiveActionLimiter, contestController.joinTeamContest); // Add this line
router.delete('/teams/:teamId', authMiddleware, sensitiveActionLimiter, contestController.deleteTeam);
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
router.get('/internal/for-chat-cleanup', internalAuth, contestController.getContestsForChatCleanup);
router.patch('/internal/mark-chat-deleted', internalAuth, contestController.markContestsChatDeleted);
router.post('/internal/by-ids', internalAuth, contestController.getContestsByIds);
module.exports = router;