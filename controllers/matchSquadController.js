const Squad = require('../models/Squad');
const Match = require('../models/UpcomingMatches');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const redisClient = require('../utils/redisClient');
const { getPlayerSelectionStats } = require('./statsController');

exports.getMatchSquad = async (req, res) => {
    try {
        const { id: matchId } = req.query;
        if (!matchId) {
            return res.status(400).json({ message: 'A match ID is required.' });
        }
        
        const redisKey = `view:squad:${matchId}`;

        // 1. Check Redis for the fully enriched squad
        let cachedData = await redisClient.get(redisKey);

        if (cachedData) {
            console.log(`[getMatchSquad] Cache HIT for enriched squad: ${matchId}`);
            const finalSquad = JSON.parse(cachedData);
            
            let stats = await redisClient.get(`stats:${matchId}`);
            stats = stats ? JSON.parse(stats) : await getPlayerSelectionStats(matchId);

            return res.json({ squad: finalSquad, stats });

        } else {
            console.log(`[getMatchSquad] Cache MISS for enriched squad: ${matchId}`);
            
            // --- CACHE MISS LOGIC ---
            // 2. Get all required data from MongoDB
            const [squadDoc, matchDoc] = await Promise.all([
                Squad.findById(matchId).lean(),
                Match.findById(matchId).lean()
            ]);
            
            if (!squadDoc || !matchDoc) {
                return res.status(404).json({ message: 'Squad or Match details not found.' });
            }

            // 3. Get the player points using the seriesId
            const seasonStats = await PlayerSeasonStats.find({ seasonId: matchDoc.seriesId }).lean();
            
            // 4. Create a fast lookup Map for the ENTIRE stats object per player
            const statsMap = new Map(seasonStats.map(stat => [stat.playerId, stat]));

            // 5. Enrich the squad data with all required stats fields
            const enrichedSquad = squadDoc.squad.map(team => ({
              ...team,
              players: team.players.map(player => {
                const playerStats = statsMap.get(player.id);
                return {
                  ...player,
                  // Use the stats object to get all required fields, defaulting to 0
                  points: playerStats?.totalPoints ?? 0,
                  totalMatchesPlayed: playerStats?.totalMatchesPlayed ?? 0,
                  averagePoints: playerStats?.averagePoints ?? 0,
                };
              }),
            }));

            // 6. Cache the NEW, fully enriched squad data in Redis
            await redisClient.setEx(redisKey, 300, JSON.stringify(enrichedSquad));

            // 7. Fetch the separate selection stats
            let stats = await redisClient.get(`stats:${matchId}`);
            stats = stats ? JSON.parse(stats) : await getPlayerSelectionStats(matchId);
            
            // 8. Send the response
            return res.json({ squad: enrichedSquad, stats });
        }
    } catch (err) {
        console.error('❌ Error fetching match squad:', err);
        res.status(500).json({ message: 'Failed to fetch match squad', error: err.message });
    }
};