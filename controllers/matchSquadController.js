const Squad = require('../models/Squad');
const UpcomingMatches = require('../models/UpcomingMatches');
const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const redisClient = require('../utils/redisClient');
const { getPlayerSelectionStats } = require('./statsController');
const RecentMatches = require('../models/RecentMatch');

exports.getMatchSquad = async (req, res) => {
    try {
        const matchId = (req.query.id || '').trim();
        console.log('check matchId', matchId);
        if (!matchId) {
            return res.status(400).json({ message: 'A match ID is required.' });
        }

        console.log({ matchId, typeofMatchId: typeof matchId });

        const redisKey = `view:squad:${matchId}`;
        let cachedData = await redisClient.get(redisKey);

        if (cachedData) {
            console.log(`[getMatchSquad] Cache HIT for enriched squad: ${matchId}`);
            const finalSquad = JSON.parse(cachedData);
            let stats = await redisClient.get(`stats:${matchId}`);
            stats = stats ? JSON.parse(stats) : await getPlayerSelectionStats(matchId);
            return res.json({ squad: finalSquad, stats });
        } else {
            console.log(`[getMatchSquad] Cache MISS for enriched squad: ${matchId}`);

            const squadDoc = await Squad.findById(matchId).lean();
            console.log('Squad Found:', !!squadDoc);

            let matchDoc = await UpcomingMatches.findOne({ _id: matchId }).lean();
            console.log('Full matchDoc object----->>..:', matchDoc); 
            if (!matchDoc) {
                matchDoc = await RecentMatches.findOne({ _id: matchId }).lean();
            }
            console.log('Match Found:', !!matchDoc);

            if (!squadDoc || !matchDoc) {
                return res.status(404).json({ message: 'Squad or Match details not found.' });
            }
            console.log('Attempting to fetch stats for seasonId:', matchDoc.seriesId);
            const seasonStats = await PlayerSeasonStats.find({ seasonId: matchDoc.seriesId }).lean();
            console.log('Player stats found:', seasonStats);
            const statsMap = new Map(seasonStats.map(stat => [stat.playerId, stat]));

            const enrichedSquad = squadDoc.squad.map(team => ({
                ...team,
                players: team.players.map(player => {
                    const playerStats = statsMap.get(player.id);
                    return {
                        ...player,
                        points: playerStats?.totalPoints ?? 0,
                        totalMatchesPlayed: playerStats?.totalMatchesPlayed ?? 0,
                        averagePoints: playerStats?.averagePoints ?? 0,
                    };
                }),
            }));

            await redisClient.setEx(redisKey, 300, JSON.stringify(enrichedSquad));
            let stats = await redisClient.get(`stats:${matchId}`);
            stats = stats ? JSON.parse(stats) : await getPlayerSelectionStats(matchId);
            return res.json({ squad: enrichedSquad, stats });
        }
    } catch (err) {
        console.error('❌ Error fetching match squad:', err);
        res.status(500).json({ message: 'Failed to fetch match squad', error: err.message });
    }
};
