// controllers/playerStatsController.js

const PlayerSeasonStats = require('../models/PlayerSeasonStats');

const getSeasonLeaderboard = async (req, res) => {
  // Change 'seasonId' to 'seriesId' to match your route
  const { seriesId } = req.params;
  console.log('check season id', seriesId); // This will now log the ID

  try {
    // Also, update the variable in your database query
    const stats = await PlayerSeasonStats.find({ seasonId: seriesId }) // Assuming your DB field is 'seasonId'
      .sort({ totalPoints: -1 })
      .lean();

    return res.status(200).json(stats);
  } catch (err) {
    console.error('[Player Stats] Error fetching season leaderboard:', err);
    return res.status(500).json({ message: 'Something went wrong' });
  }
};

module.exports = {
  getSeasonLeaderboard,
};