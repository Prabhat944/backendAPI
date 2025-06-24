// // In a new file: jobs/updateContestStatusCron.js

// const cron = require('node-cron');
// const Contest = require('../models/Contest');
// const RecentMatch = require('../models/RecentMatch'); // Our source of truth for live matches

// /**
//  * This job transitions contests from 'upcoming' to 'live' when their match starts.
//  */
// const updateContestStatusJob = async () => {
//     console.log(`---[CONTEST STATUS UPDATE CRON START]---`);
//     try {
//         // 1. Find all contests that are still in the 'upcoming' state.
//         const upcomingContests = await Contest.find({ status: 'upcoming' }).select('_id matchId').lean();

//         if (upcomingContests.length === 0) {
//             // This is normal and means there's nothing to update right now.
//             // console.log('[CONTEST_STATUS] No upcoming contests to check.');
//             return;
//         }

//         const upcomingMatchIds = [...new Set(upcomingContests.map(c => c.matchId.toString()))];

//         // 2. Check which of these matches have now started.
//         // We look in our RecentMatch collection for any matches that have started.
//         const startedMatchIds = await RecentMatch.find({
//             _id: { $in: upcomingMatchIds },
//             matchStarted: true
//         }).select('_id').lean();

//         const startedMatchIdSet = new Set(startedMatchIds.map(m => m._id.toString()));

//         if (startedMatchIdSet.size === 0) {
//             // This is also normal. It means none of the upcoming contests have started yet.
//             // console.log('[CONTEST_STATUS] No matches have started yet for the upcoming contests.');
//             return;
//         }

//         // 3. Filter down to only the contests whose matches have started.
//         const contestsToUpdate = upcomingContests.filter(c => startedMatchIdSet.has(c.matchId.toString()));
        
//         if (contestsToUpdate.length > 0) {
//             const contestIdsToUpdate = contestsToUpdate.map(c => c._id);
            
//             // 4. Update the status of these contests to 'live'.
//             const result = await Contest.updateMany(
//                 { _id: { $in: contestIdsToUpdate } },
//                 { $set: { status: 'live' } }
//             );

//             console.log(`[CONTEST_STATUS] Successfully transitioned ${result.modifiedCount} contests from 'upcoming' to 'live'.`);
//         }

//     } catch (error) {
//         console.error('[CONTEST_STATUS] A critical error occurred:', error.message, error.stack);
//     } finally {
//         // console.log(`---[CONTEST STATUS UPDATE CRON END]---`);
//     }
// };


// const scheduleContestStatusJob = () => {
//     updateContestStatusJob();
//     // Run every minute to quickly catch when matches start.
//     cron.schedule('* * * * *', updateContestStatusJob, {
//         scheduled: true,
//         timezone: "Asia/Kolkata"
//     });
//     console.log('✅ Contest Status Update cron job scheduled to run every minute.');
// };

// scheduleContestStatusJob();

// module.exports = { scheduleContestStatusJob };
