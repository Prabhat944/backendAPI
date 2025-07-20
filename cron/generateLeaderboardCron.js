// const cron = require('node-cron');
// const PlayerPerformance = require('../models/PlayerPerformanceSchema');
// const Squad = require('../models/Squad');
// const RecentMatch = require('../models/RecentMatch');
// const MatchLeaderboard = require('../models/matchLeaderboardSchema');

// /**
//  * This cron job finds completed matches that haven't had a leaderboard generated,
//  * creates the leaderboard, and saves it to the new collection.
//  */
// const generateLeaderboardJob = async () => {
//     console.log('---[LEADERBOARD CRON START]---');
//     try {
//         // 1. Find all matches that are completed but don't have a leaderboard yet.
//         const matchesToProcess = await RecentMatch.find({
//             matchEnded: true,
//             leaderboardGenerated: { $ne: true }
//         }).lean();

//         if (matchesToProcess.length === 0) {
//             console.log('[LEADERBOARD CRON] No new completed matches to generate leaderboards for.');
//             console.log('---[LEADERBOARD CRON END]---');
//             return;
//         }

//         console.log(`[LEADERBOARD CRON] Found ${matchesToProcess.length} matches to process.`);

//         for (const match of matchesToProcess) {
//             const matchId = match._id.toString(); // The unique ID for the match
//             console.log(`[LEADERBOARD CRON] Generating leaderboard for match: ${matchId}`);

//             // 2. Fetch all player performances for this match.
//             const performances = await PlayerPerformance.find({ matchId: matchId }).lean();
//             if (performances.length === 0) {
//                 console.warn(`[LEADERBOARD CRON] No performance data for match ${matchId}. Skipping.`);
//                 continue;
//             }

//             // 3. Fetch the squad data to get player roles and images.
//             const squadDoc = await Squad.findById(matchId).lean();
//             if (!squadDoc || !squadDoc.squad) {
//                 console.warn(`[LEADERBOARD CRON] No squad data for match ${matchId}. Skipping.`);
//                 continue;
//             }

//             // 4. Create a quick-lookup map for player images and roles from the squad data.
//             const allPlayers = squadDoc.squad.flatMap(team => team.players);
            
//             const playerDetailsMap = new Map(
//                 allPlayers
//                     .filter(p => p && p.id) // Safety check for players missing an 'id'
//                     .map(p => [
//                         p.id.toString(),      // Use 'id' for the map key
//                         {
//                             image: p.playerImg, // Use 'playerImg' for the image
//                             role: p.role
//                         }
//                     ])
//             );

//             // 5. Combine performance data with squad details to build the leaderboard.
//             const leaderboard = performances
//                 .filter(perf => perf && perf.playerId) // Safety check for performances missing a 'playerId'
//                 .map(perf => {
//                     const details = playerDetailsMap.get(perf.playerId.toString()) || {};
//                     return {
//                         playerId: perf.playerId,
//                         name: perf.name,
//                         points: perf.points,
//                         playerImage: details.image || '',
//                         role: details.role || '',
//                     };
//                 })
//                 .sort((a, b) => b.points - a.points); // Sort by points descending

//             // 6. Save the new leaderboard document.
//             await MatchLeaderboard.updateOne(
//                 { matchId: matchId },
//                 { $set: { leaderboard: leaderboard, lastUpdated: new Date() } },
//                 { upsert: true }
//             );
//             console.log(`[LEADERBOARD CRON] Successfully created/updated leaderboard for match ${matchId}.`);

//             // 7. Mark the match as processed so we don't run it again.
//             await RecentMatch.updateOne({ _id: matchId }, { $set: { leaderboardGenerated: true } });
//         }
//     } catch (err) {
//         console.error('[LEADERBOARD CRON] A critical error occurred:', err.message, err.stack);
//     } finally {
//         console.log('---[LEADERBOARD CRON END]---');
//     }
// };

// /**
//  * Schedules the cron job to run. Every 5 minutes is a good interval for this job.
//  */
// const scheduleLeaderboardJob = () => {
//     generateLeaderboardJob(); // Run once on startup
//     cron.schedule('*/5 * * * *', generateLeaderboardJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Match Leaderboard cron job scheduled to run every 5 minutes.');
// };

// // This line starts the scheduling process as soon as the file is loaded.
// scheduleLeaderboardJob();

// module.exports = { scheduleLeaderboardJob, generateLeaderboardJob };