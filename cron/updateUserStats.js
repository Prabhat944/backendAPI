// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const ContestParticipation = require('../models/ContestParticipation');
// const UserStats = require('../models/userStatsModel');

// // =================================================================================
// //  PART 1: ONE-TIME LOGIC (Runs only when the server starts)
// //  This function processes all data that was missed while the server was offline.
// // =================================================================================
// const processMissedData = async () => {
//     console.log('[STARTUP] Checking for any old or missed stats data to process...');

//     try {
//         // Find all participation records that have NOT been processed yet.
//         const unprocessedEntries = await ContestParticipation.find({
//             $or: [
//                 { statsProcessed: false },
//                 { statsProcessed: { $exists: false } }
//             ]
//         }).lean();

//         if (unprocessedEntries.length === 0) {
//             console.log('[STARTUP] No unprocessed data found. Everything is up-to-date.');
//             return;
//         }

//         console.log(`[STARTUP] Found ${unprocessedEntries.length} unprocessed records. Updating stats now...`);

//         // Get a unique list of users who need an update.
//         const userIdsToUpdate = [...new Set(unprocessedEntries.map(entry => entry.user.toString()))];

//         for (const userId of userIdsToUpdate) {
//             await recalculateAndSaveStats(new mongoose.Types.ObjectId(userId));
//             console.log(`[STARTUP SUCCESS] Processed stats for user: ${userId}`);
//         }

//         // Mark all those records as "done".
//         const entryIds = unprocessedEntries.map(entry => entry._id);
//         await ContestParticipation.updateMany(
//             { _id: { $in: entryIds } },
//             { $set: { statsProcessed: true } }
//         );

//         console.log(`[STARTUP] Finished processing all ${entryIds.length} missed records.`);

//     } catch (error) {
//         console.error('[STARTUP ERROR] Could not process missed stats data:', error);
//     }
// };


// // =================================================================================
// //  PART 2: RECURRING JOB (Runs every 2 minutes)
// //  This is the ongoing cron job.
// // =================================================================================
// cron.schedule('*/2 * * * *', async () => {
//   console.log(`[CRON] --- Running 2-Minute Stats Update Job ---`);
//   // This job will now find any new data created since the server started.
//   await processMissedData();
// });


// /**
//  * HELPER FUNCTION: This calculates and saves stats for a single user.
//  * It's used by both the startup logic and the cron job.
//  * @param {mongoose.Types.ObjectId} userId
//  */
// const recalculateAndSaveStats = async (userId) => {
//     // 1. Calculate lifetime stats by reading from ContestParticipation
//     const uniqueMatchesPlayedResult = await ContestParticipation.aggregate([ { $match: { user: userId } }, { $group: { _id: '$matchId' } }, { $count: 'totalMatches' } ]);
//     const totalMatchesPlayed = uniqueMatchesPlayedResult.length > 0 ? uniqueMatchesPlayedResult[0].totalMatches : 0;
//     const statsResult = await ContestParticipation.aggregate([ { $match: { user: userId } }, { $group: { _id: null, totalContestsParticipated: { $sum: 1 }, totalWins: { $sum: { $cond: ['$isWinner', 1, 0] } }, totalLosses: { $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] } }, totalWinning: { $sum: { $cond: ['$isWinner', '$prizeWon', 0] } } } } ]);
//     const stats = statsResult[0] || { totalContestsParticipated: 0, totalWins: 0, totalLosses: 0, totalWinning: 0 };
//     let winningPercentage = 0;
//     if (stats.totalContestsParticipated > 0) { winningPercentage = parseFloat(((stats.totalWins / stats.totalContestsParticipated) * 100).toFixed(2)); }
//     const statsData = { totalContestsParticipated: stats.totalContestsParticipated, totalMatchesPlayed, totalWins: stats.totalWins, totalLosses: stats.totalLosses, totalWinning: stats.totalWinning, winningPercentage, lastCalculated: new Date() };

//     // 2. Save the result to the UserStats model
//     await UserStats.findOneAndUpdate(
//         { user: userId },
//         statsData,
//         { upsert: true }
//     );
// };


// // =================================================================================
// //  KICK-OFF
// //  Immediately run the process once when the server starts.
// // =================================================================================
// (async () => {
//     // A small delay to ensure DB connection is established
//     setTimeout(processMissedData, 5000); 
// })();

// console.log('✅ Smart stats job is scheduled. It will process old data on startup and run every 2 minutes.');