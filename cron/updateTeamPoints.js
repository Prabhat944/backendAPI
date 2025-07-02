// const cron = require('node-cron');
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');
// const Team = require('../models/TeamSchema');
// const PlayerPerformance = require('../models/PlayerPerformanceSchema');
// const RecentMatch = require('../models/RecentMatch');

// const calculateFinalTeamPoints = (team, performancesMap) => {
//     let totalPoints = 0;
//     if (!team || !team.players) return 0;

//     team.players.forEach(playerId => {
//         const performance = performancesMap.get(playerId.toString());
//         let currentPoints = performance ? (performance.points || 0) : 0;

//         if (team.captain?.toString() === playerId.toString()) {
//             currentPoints *= 2;
//         }
//         if (team.viceCaptain?.toString() === playerId.toString()) {
//             currentPoints *= 1.5;
//         }

//         totalPoints += currentPoints;
//     });

//     return parseFloat(totalPoints.toFixed(2));
// };

// const settleContestsJob = async () => {
//     console.log(`---[CONTEST SETTLEMENT CRON START]---`);

//     try {
//         const finishedMatches = await RecentMatch.find({
//             matchEnded: true
//         }).select('_id').lean();

//         if (finishedMatches.length === 0) {
//             console.log('[SETTLEMENT] No recently finished matches found to process.');
//             return;
//         }

//         const finishedMatchIds = finishedMatches.map(m => m._id.toString());

//         const contestsToSettle = await Contest.find({
//             matchId: { $in: finishedMatchIds },
//             status: { $ne: 'completed' } // process any contest not already marked completed
//         }).lean();
        

//         if (contestsToSettle.length === 0) {
//             console.log('[SETTLEMENT] No live contests found for finished matches.');
//             return;
//         }

//         console.log(`[SETTLEMENT] Found ${contestsToSettle.length} contests to settle.`);

//         for (const contest of contestsToSettle) {
//             console.log(`[SETTLEMENT] Processing contest: ${contest._id} for match: ${contest.matchId}`);

//             const participations = await ContestParticipation.find({ contestId: contest._id }).lean();

//             if (participations.length === 0) {
//                 await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//                 console.log(`[SETTLEMENT] Contest ${contest._id} had no participants. Marked as completed.`);
//                 continue;
//             }

//             const teamIds = participations.map(p => p.teamId);
//             const teams = await Team.find({ _id: { $in: teamIds } }).lean();
//             const performances = await PlayerPerformance.find({ matchId: contest.matchId }).lean();

//             const teamsMap = new Map(teams.map(t => [t._id.toString(), t]));
//             const performancesMap = new Map(performances.map(p => [p.playerId.toString(), p]));

//             const leaderboard = participations.map(p => {
//                 const team = teamsMap.get(p.teamId.toString());
//                 const totalPoints = calculateFinalTeamPoints(team, performancesMap);
//                 return {
//                     participationId: p._id,
//                     userId: p.user,
//                     totalPoints
//                 };
//             });

//             leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);

//             // ⬇️ Fallback prize logic
//             let prizeDistribution = contest.prizeDistribution || contest.prizeBreakdown || [];

//             if (
//                 (!prizeDistribution || prizeDistribution.length === 0) &&
//                 contest.prize > 0 &&
//                 contest.totalSpots > 0
//             ) {
//                 prizeDistribution = [{ from: 1, to: 1, prize: contest.prize }];
//                 console.warn(`[SETTLEMENT] ⚠️ prizeDistribution missing for contest ${contest._id}, applying winner-takes-all fallback.`);
//             }

//             const bulkOps = [];

//             leaderboard.forEach((entry, index) => {
//                 const rank = index + 1;
//                 let prizeWon = 0;

//                 const prizeInfo = prizeDistribution.find(p => {
//                     if (p.rank !== undefined) return p.rank === rank;
//                     if (p.from !== undefined && p.to !== undefined) return rank >= p.from && rank <= p.to;
//                     return false;
//                 });

//                 if (!prizeInfo) {
//                     console.log(`[DEBUG] No prize for rank ${rank} in contest ${contest._id}`);
//                 } else {
//                     prizeWon = prizeInfo.prize || 0;
//                 }

//                 bulkOps.push({
//                     updateOne: {
//                         filter: { _id: entry.participationId },
//                         update: {
//                             $set: {
//                                 totalPoints: entry.totalPoints,
//                                 rank: rank,
//                                 prizeWon: prizeWon,
//                                 isWinner: prizeWon > 0
//                             }
//                         }
//                     }
//                 });
//             });

//             if (bulkOps.length > 0) {
//                 await ContestParticipation.bulkWrite(bulkOps);
//             }

//             await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//             console.log(`[SETTLEMENT] Successfully settled contest ${contest._id}. Updated ${bulkOps.length} participations.`);
//         }

//     } catch (error) {
//         console.error('[SETTLEMENT] A critical error occurred:', error.message, error.stack);
//     } finally {
//         console.log(`---[CONTEST SETTLEMENT CRON END]---`);
//     }
// };

// const scheduleSettlementJob = () => {
//     settleContestsJob();
//     cron.schedule('*/5 * * * *', settleContestsJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Contest Settlement cron job scheduled to run every 5 minutes.');
// };

// scheduleSettlementJob();

// module.exports = { scheduleSettlementJob };
