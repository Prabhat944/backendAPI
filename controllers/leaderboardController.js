const MatchLeaderboard = require('../models/matchLeaderboardSchema');

/**
 * @desc    Get the final leaderboard for a specific match
 * @route   GET /api/leaderboards/:matchId
 * @access  Private (or Public, depending on your app's auth)
 */
exports.getMatchLeaderboard = async (req, res) => {
    try {
        const { matchId } = req.params;

        if (!matchId) {
            return res.status(400).json({ message: 'Match ID is required.' });
        }

        // Find the leaderboard document using the matchId
        const matchLeaderboard = await MatchLeaderboard.findOne({ matchId: matchId }).lean();

        // If no leaderboard is found (e.g., match not completed or cron hasn't run)
        if (!matchLeaderboard) {
            return res.status(404).json({ message: 'Leaderboard not found for this match. It may still be in progress or under calculation.' });
        }

        // Successfully found, return the leaderboard data
        res.status(200).json(matchLeaderboard);

    } catch (error) {
        console.error('Error fetching match leaderboard:', error);
        res.status(500).json({ message: 'Server error while fetching leaderboard.' });
    }
};