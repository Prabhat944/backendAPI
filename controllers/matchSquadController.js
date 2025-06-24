// your controller file

const Squad = require('../models/Squad'); // Import the new Squad model
const redisClient = require('../utils/redisClient');
const { getPlayerSelectionStats } = require('./statsController'); // This remains

exports.getMatchSquad = async (req, res) => {
    try {
        const { id: matchId } = req.query;
        const redisKey = `view:squad:${matchId}`; // A good key for caching the final view

        // 1. Check Redis for the cached squad
        let squadData = await redisClient.get(redisKey);

        if (squadData) {
            console.log(`[getMatchSquad] Cache HIT for squad: ${matchId}`);
            squadData = JSON.parse(squadData);
        } else {
            console.log(`[getMatchSquad] Cache MISS for squad: ${matchId}`);
            // 2. If not in cache, get from our MongoDB
            const squadDoc = await Squad.findById(matchId).lean();
            
            if (squadDoc) {
                squadData = squadDoc.squad; // The actual array of teams is in the .squad property
                // 3. Save the result to Redis for the next request
                await redisClient.setEx(redisKey, 300, JSON.stringify(squadData)); // Cache for 5 minutes
            } else {
                squadData = []; // No squad found
            }
        }
      
        // The logic for fetching stats can remain the same
        let stats = await redisClient.get(`stats:${matchId}`);
        if (!stats) {
            stats = await getPlayerSelectionStats(matchId);
        } else {
            stats = JSON.parse(stats);
        }

        // The property 'squad' from the original response is now 'squadData'
        res.json({ squad: squadData, stats });

    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch match squad', error: err.message });
    }
};