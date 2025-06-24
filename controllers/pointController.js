const Team = require('../models/TeamSchema');
const PlayerPerformance = require('../models/PlayerPerformanceSchema');
const redisClient = require('../utils/redisClient');
const { calculateTeamPoints } = require('../utils/pointUpdate'); // <-- Import the new helper

const getTeamWithLivePoints = async (req, res) => {
  try {
    const { teamId } = req.params;
    const cacheKey = `team_points:${teamId}`;

    // --- Caching logic remains the same ---
    const cachedData = await redisClient.get(cacheKey);
    if (cachedData) {
      console.log(`[CACHE HIT] Serving points for teamId: ${teamId}`);
      return res.status(200).json(JSON.parse(cachedData));
    }
    console.log(`[CACHE MISS] Fetching points from DB for teamId: ${teamId}`);
    
    // --- Database fetching remains the same ---
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Team not found.' });
    }
    const { matchId, players: playerIds } = team;
    const playerPerformances = await PlayerPerformance.find({ matchId: matchId, playerId: { $in: playerIds } });

    // ✨ --- POINT CALCULATION IS NOW ONE CLEAN LINE --- ✨
    const { totalPoints, playersWithPoints } = calculateTeamPoints(team, playerPerformances);

    // --- Building the final response ---
    const matchStatus = playerPerformances.length > 0 ? playerPerformances[0].matchStatus : 'PENDING';
    const finalResponse = {
      teamId: team._id,
      matchId: team.matchId,
      matchStatus: matchStatus,
      totalPoints: totalPoints,
      players: playersWithPoints, // The detailed list comes from the helper
    };

    // --- Caching logic remains the same ---
    let ttlInSeconds;
    if (matchStatus === 'COMPLETED') {
      ttlInSeconds = 60 * 60 * 24;
    } else {
      ttlInSeconds = 20;
    }
    await redisClient.setEx(cacheKey, ttlInSeconds, JSON.stringify(finalResponse));
    console.log(`[CACHE SET] Stored points for teamId: ${teamId} with TTL: ${ttlInSeconds}s`);

    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Error fetching team points:', error);
    res.status(500).json({ message: 'Server error while fetching team points.' });
  }
};

module.exports = { getTeamWithLivePoints };