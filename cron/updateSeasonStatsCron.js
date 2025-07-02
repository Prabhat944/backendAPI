// const cron = require('node-cron');
// const PlayerPerformance = require('../models/PlayerPerformanceSchema');
// const RecentMatch = require('../models/RecentMatch');
// const { updatePlayerSeasonStats } = require('../utils/playerStatsService');

// const updateSeasonStatsJob = async () => {
//   console.log('---[SEASON STATS CRON START]---');

//   try {
//     const completedMatches = await RecentMatch.find({ matchEnded: true }).lean();

//     for (const match of completedMatches) {
//       const matchId = match._id.toString();

//       const isFinalized = await PlayerPerformance.findOne({ matchId, matchStatus: 'COMPLETED' }).lean();
//       if (!isFinalized) continue;

//       const allPerformances = await PlayerPerformance.find({ matchId }).lean();

//       const players = allPerformances.map(p => ({
//         playerId: p.playerId,
//         name: p.name,
//         playerImg: '', // Optional
//         basePoints: p.points || 0,
//         role: 'All-Rounder' // You can fetch actual role if stored
//       }));

//       if (players.length === 0) continue;

//       await updatePlayerSeasonStats(matchId, players);
//       console.log(`[✔️ SEASON STATS] Updated stats for match: ${match.name}`);
//     }

//   } catch (err) {
//     console.error('[SEASON STATS CRON ❌] Error:', err.message);
//   }

//   console.log('---[SEASON STATS CRON END]---');
// };

// const scheduleSeasonStatsJob = () => {
//   updateSeasonStatsJob();
//   cron.schedule('* * * * *', updateSeasonStatsJob, {
//     timezone: 'Asia/Kolkata'
//   });
//   console.log('✅ Cron scheduled: Update season stats every 1 min');
// };

// scheduleSeasonStatsJob();

// module.exports = { scheduleSeasonStatsJob };
