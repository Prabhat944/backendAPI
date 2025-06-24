// // jobs/contestSettlementCron.js

// const cron = require('node-cron');
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');
// const Team = require('../models/TeamSchema');
// const PlayerPerformance = require('../models/PlayerPerformanceSchema');
// const RecentMatch = require('../models/RecentMatch');

// /**
//  * Calculates the final points for a given team based on player performances.
//  * This is a crucial helper function.
//  * @param {object} team - The team object containing players, captain, viceCaptain.
//  * @param {Map} performancesMap - A Map of { playerId: performanceDoc }.
//  * @returns {number} - The total points for the team.
//  */
// const calculateFinalTeamPoints = (team, performancesMap) => {
//     let totalPoints = 0;
//     if (!team || !team.players) return 0;

//     team.players.forEach(playerId => {
//         const performance = performancesMap.get(playerId.toString());
//         let currentPoints = performance ? (performance.points || 0) : 0;
        
//         if (team.captain.toString() === playerId.toString()) { currentPoints *= 2; }
//         if (team.viceCaptain.toString() === playerId.toString()) { currentPoints *= 1.5; }
        
//         totalPoints += currentPoints;
//     });

//     return parseFloat(totalPoints.toFixed(2));
// };

// /**
//  * This job finds completed contests, calculates ranks, and distributes prizes.
//  */
// const settleContestsJob = async () => {
//     console.log(`---[CONTEST SETTLEMENT CRON START]---`);
//     try {
//         // 1. Find matches that have ended but whose contests are not yet settled.
//         const finishedMatches = await RecentMatch.find({ 
//             matchEnded: true,
//             // Add a check here if you add a 'settled' flag to matches later
//         }).select('_id').lean();

//         if (finishedMatches.length === 0) {
//             console.log('[SETTLEMENT] No recently finished matches found to process.');
//             return;
//         }
        
//         const finishedMatchIds = finishedMatches.map(m => m._id.toString());

//         // 2. Find all contests for these matches that are still marked as 'live'.
//         const contestsToSettle = await Contest.find({
//             matchId: { $in: finishedMatchIds },
//             status: 'live' // Only settle contests that are currently live
//         }).lean();

//         if (contestsToSettle.length === 0) {
//             console.log('[SETTLEMENT] No live contests found for finished matches.');
//             return;
//         }
//         console.log(`[SETTLEMENT] Found ${contestsToSettle.length} contests to settle.`);

//         for (const contest of contestsToSettle) {
//             console.log(`[SETTLEMENT] Processing contest: ${contest._id} for match: ${contest.matchId}`);

//             // 3. Get all participations for this contest.
//             const participations = await ContestParticipation.find({ contestId: contest._id }).lean();
//             if (participations.length === 0) {
//                 await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//                 console.log(`[SETTLEMENT] Contest ${contest._id} had no participants. Marked as completed.`);
//                 continue;
//             }

//             // 4. Get all unique teams and player performances for this match.
//             const teamIds = participations.map(p => p.teamId);
//             const teams = await Team.find({ _id: { $in: teamIds } }).lean();
//             const performances = await PlayerPerformance.find({ matchId: contest.matchId }).lean();
            
//             const teamsMap = new Map(teams.map(t => [t._id.toString(), t]));
//             const performancesMap = new Map(performances.map(p => [p.playerId.toString(), p]));

//             // 5. Calculate final points for every participant.
//             const leaderboard = participations.map(p => {
//                 const team = teamsMap.get(p.teamId.toString());
//                 const totalPoints = calculateFinalTeamPoints(team, performancesMap);
//                 return {
//                     participationId: p._id,
//                     userId: p.user,
//                     totalPoints
//                 };
//             });

//             // 6. Sort the leaderboard to determine ranks.
//             leaderboard.sort((a, b) => b.totalPoints - a.totalPoints);
            
//             // 7. Prepare bulk update operations with ranks and prizes.
//             const bulkOps = [];
//             const prizeDistribution = contest.prizeDistribution || [];

//             leaderboard.forEach((entry, index) => {
//                 const rank = index + 1;
//                 let prizeWon = 0;
                
//                 const prizeInfo = prizeDistribution.find(p => rank >= p.from && rank <= p.to);
//                 if (prizeInfo) {
//                     prizeWon = prizeInfo.prize;
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

//             // 8. Execute all updates and finalize the contest.
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
//     // Run every 5 minutes.
//     cron.schedule('*/5 * * * *', settleContestsJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Contest Settlement cron job scheduled to run every 5 minutes.');
// };

// scheduleSettlementJob();

// module.exports = { scheduleSettlementJob };

