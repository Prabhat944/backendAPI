// const cron = require('node-cron');
// const Match = require('../models/UpcomingMatches');
// const RecentMatch = require('../models/RecentMatch');
// const Squad = require('../models/Squad');
// const cricketDataService = require('../services/cricketService');

// const updateAllSquadsJob = async () => {
//     console.log('----------------------------------------------------');
//     console.log(`[${new Date().toLocaleTimeString()}] Running SQUAD update cron job...`);

//     try {
//         const upcomingMatches = await Match.find({ dateTimeGMT: { $gt: new Date() } }, '_id').lean();
//         const liveMatches = await RecentMatch.find({ matchEnded: false }, '_id').lean();

//         const allMatchIdsToProcess = [...new Set([
//             ...upcomingMatches.map(m => m._id.toString()),
//             ...liveMatches.map(m => m._id.toString())
//         ])];
        
//         if (allMatchIdsToProcess.length === 0) {
//             console.log('[SQUAD CRON] No upcoming or live matches found to fetch squads for.');
//             return;
//         }

//         console.log(`[SQUAD CRON] Found ${allMatchIdsToProcess.length} matches to check for squads.`);

//         for (const matchId of allMatchIdsToProcess) {
//             try {
//                 const squadResponse = await cricketDataService.matchSquad(matchId);
//                 const squadData = squadResponse?.data;

//                 console.log(`\n[SQUAD DEBUG] Raw squad data for match ${matchId}:`);
//                 console.log(JSON.stringify(squadData, null, 2));

//                 if (!Array.isArray(squadData)) {
//                     console.warn(`[SQUAD CRON] Invalid squad format for match ${matchId}. Skipping.`);
//                     continue;
//                 }

//                 console.log(`[SQUAD DEBUG] Match ${matchId} - Team Count: ${squadData.length}`);
//                 squadData.forEach((team, index) => {
//                     console.log(` → Team ${index + 1}: ${team?.teamName} | Players: ${team?.players?.length}`);
//                 });

//                 if (squadData.length < 2) {
//                     console.warn(`[SQUAD CRON] Incomplete squad (only ${squadData.length} team) for match ${matchId}. Skipping.`);
//                     continue;
//                 }

//                 const enrichedSquadData = squadData.map(team => ({
//                     ...team,
//                     players: team.players.map(player => ({
//                         ...player,
//                         teamName: team.teamName
//                     }))
//                 }));

//                 const saved = await Squad.findOneAndUpdate(
//                     { _id: matchId },
//                     { $set: { squad: enrichedSquadData } },
//                     { upsert: true, new: true }
//                 );

//                 console.log(`[SQUAD CRON] ✅ Saved squad for match ${matchId}. Total Teams: ${enrichedSquadData.length}`);

//                 // Optional: Also update the hasSquad flag
//                 await Match.updateOne({ _id: matchId }, { $set: { hasSquad: true } });
//                 await RecentMatch.updateOne({ _id: matchId }, { $set: { hasSquad: true } });
//             } catch (error) {
//                 console.error(`[SQUAD CRON] ❌ Error fetching/saving squad for match ${matchId}: ${error.message}`);
//             }
//         }
        
//     } catch (error) {
//         console.error('❌ Critical error in updateAllSquadsJob:', error.message);
//     } finally {
//         console.log(`SQUAD update job finished at ${new Date().toLocaleTimeString()}.`);
//     }
// };

// const scheduleSquadsJob = () => {
//     updateAllSquadsJob(); // run immediately on start

//     cron.schedule('* * * * *', updateAllSquadsJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });

//     console.log('✅ Match Squads cron job (for upcoming & live) scheduled to run every minute.');
// };

// scheduleSquadsJob();

// module.exports = { scheduleSquadsJob, updateAllSquadsJob };
