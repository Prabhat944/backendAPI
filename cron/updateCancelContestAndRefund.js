// // contestCancellationCron.js (or a new file like matchCompletionCron.js)

// require('dotenv').config();
// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const axios = require('axios');

// const RecentMatch = require('../models/RecentMatch');
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');

// const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL;
// const INTERNAL_WALLET_SERVICE_TOKEN = process.env.INTERNAL_WALLET_SERVICE_TOKEN;

// // (Keep cancelContestAndRefund function as is - it's reusable)
// const cancelContestAndRefund = async (contest) => {
//     try {
//       console.log(`🚫 Cancelling contest ID: ${contest._id} (Match ID: ${contest.matchId})`);
  
//       const participations = await ContestParticipation.find({ contestId: contest._id })
//         .select('user deductionBreakdown isRefunded transactionId');
  
//       // Update the Contest status first
//       await Contest.updateOne({ _id: contest._id }, { $set: { status: 'cancelled' } });
//       console.log(`✅ Contest ${contest._id} status set to 'cancelled'.`);
  
//       if (participations.length === 0) {
//         console.log(`ℹ️ No participants for contest ${contest._id}. Skipping refund.`);
//         return; // Contest status is already updated
//       }
  
//       let successfulRefunds = 0;
//       let failedRefunds = 0;
//       const refundErrors = [];
  
//       for (const participation of participations) {
//         const userId = participation.user.toString();
//         const breakdown = participation.deductionBreakdown;
  
//         // Update the status of ContestParticipation here
//         await ContestParticipation.updateOne(
//           { _id: participation._id },
//           { $set: { status: 'cancelled' } } // <-- ADD THIS LINE
//         );
//         console.log(`✅ Participation ${participation._id} status set to 'cancelled'.`);
  
//         if (participation.isRefunded) {
//           console.log(`🔁 Already refunded user ${userId}, skipping.`);
//           continue;
//         }
  
//         const isEmptyBreakdown = !breakdown || typeof breakdown !== 'object' || Object.keys(breakdown).length === 0;
//         const isZeroAmount = ['deposit_balance', 'cashback_balance', 'withdrawal_balance', 'signup_bonus_balance']
//           .every(key => !breakdown[key]);
  
//         if (isEmptyBreakdown || isZeroAmount) {
//           console.warn(`⚠️ Invalid or empty breakdown for participation ${participation._id}. Skipping refund.`);
//           failedRefunds++;
//           refundErrors.push({ userId, message: 'Invalid breakdown.' });
//           continue;
//         }
  
//         try {
//           const refundResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/refund`, {
//             userId,
//             breakdown,
//             reason: `Contest Cancellation: ${contest.title || 'Untitled Contest'} (${contest._id})`,
//             refundedTransactionId: participation.transactionId || null
//           }, {
//             headers: {
//               Authorization: `Bearer ${INTERNAL_WALLET_SERVICE_TOKEN}`
//             }
//           });
  
//           if (refundResponse.status === 200) {
//             successfulRefunds++;
//             await ContestParticipation.updateOne(
//               { _id: participation._id },
//               { $set: { isRefunded: true } } // This line already existed
//             );
//             console.log(`💸 Refund success: user ${userId} for participation ${participation._id}`);
//           } else {
//             failedRefunds++;
//             console.error(`❌ Refund failed for user ${userId}: ${refundResponse.data.message}`);
//             refundErrors.push({ userId, message: refundResponse.data.message });
//           }
//         } catch (refundError) {
//           failedRefunds++;
//           console.error(`❌ Refund error for user ${userId}:`, refundError.message);
//           refundErrors.push({ userId, message: refundError.message });
//         }
//       }
  
//       console.log(`✅ Contest ${contest._id} refund summary: ${successfulRefunds} success, ${failedRefunds} failed.`);
//       if (refundErrors.length > 0) {
//         console.error('Refund errors:', refundErrors);
//       }
  
//     } catch (error) {
//       console.error(`💥 Critical error cancelling contest ${contest._id}:`, error.message);
//       await Contest.updateOne({ _id: contest._id }, { $set: { status: 'cancellation_failed' } });
//     }
//   };

// // Your existing handleMatchStarts - I'll keep the modified one from our last turn
// const handleMatchStarts = async () => {
//     const currentTime = new Date();
//     console.log(`⏱️ Running match start cron at ${currentTime.toISOString()}`);
  
//     try {
//       const matchesToProcess = await RecentMatch.find({
//         dateTimeGMT: { $lte: currentTime },
//         matchStarted: { $ne: true }
//       }).lean();
  
//       console.log(`🔍 Found ${matchesToProcess.length} matches to process.`);
//       if (matchesToProcess.length === 0) return;
  
//       for (const match of matchesToProcess) {
//         console.log(`⚙️ Processing match ID: ${match._id}`);
  
//         const contests = await Contest.find({
//           matchId: match._id,
//           status: { $ne: 'cancelled' } // Fetch all except cancelled
//         });
  
//         if (contests.length === 0) {
//           console.log(`ℹ️ No contests found for match ${match._id}`);
//           await RecentMatch.updateOne({ _id: match._id }, { $set: { matchStarted: true } });
//           continue;
//         }
  
//         const anyContestIsLive = contests.some(contest => contest.filledSpots >= contest.totalSpots);
  
//         for (const contest of contests) {
//           if (contest.filledSpots >= contest.totalSpots) {
//             if (contest.status !== 'live') {
//               await Contest.updateOne({ _id: contest._id }, { $set: { status: 'live' } });
//               console.log(`✅ Contest ${contest._id} is full, marked as live.`);
//             } else {
//               console.log(`ℹ️ Contest ${contest._id} already live.`);
//             }
//           } else if (anyContestIsLive) {
//             console.log(`⚠️ Contest ${contest._id} not full (${contest.filledSpots}/${contest.totalSpots}) and another contest is live for this match. Cancelling.`);
//             await cancelContestAndRefund(contest);
//           } else {
//             console.log(`ℹ️ Contest ${contest._id} not full, and no other contest is live yet. Remaining as is.`);
//           }
//         }
  
//         await RecentMatch.updateOne({ _id: match._id }, { $set: { matchStarted: true } });
//         console.log(`✅ Finished processing match ${match._id}.`);
//       }
//     } catch (error) {
//       console.error('💥 Cron error in handleMatchStarts:', error);
//     }
// };


// // New function to handle contests in completed matches
// const handleCompletedMatchCancellations = async () => {
//     const currentTime = new Date();
//     console.log(`⏱️ Running completed match cancellation cron at ${currentTime.toISOString()}`);

//     try {
//         const completedMatchesToProcess = await RecentMatch.find({
//             matchEnded: true,
//             // Assuming you've added this flag to your RecentMatch schema
//             // contestCancellationCompleted: { $ne: true }
//         }).lean();

//         console.log(`🔍 Found ${completedMatchesToProcess.length} completed matches to re-check for cancellations.`);
//         if (completedMatchesToProcess.length === 0) return;

//         for (const match of completedMatchesToProcess) {
//             console.log(`⚙️ Re-checking cancellations for completed match ID: ${match._id}`);

//             // 1. Fetch all contests for this completed match that are NOT already cancelled
//             const contestsToCheck = await Contest.find({
//                 matchId: match._id,
//                 status: { $nin: ['cancelled', 'cancellation_failed'] }
//             }).lean(); // Use .lean() for performance if you're not modifying them directly here

//             // 2. Filter these contests in memory to find ones that are not full
//             const contestsToCancel = contestsToCheck.filter(contest =>
//                 contest.filledSpots < contest.totalSpots
//             );

//             if (contestsToCancel.length === 0) {
//                 console.log(`ℹ️ No pending cancellations for completed match ${match._id}.`);
//                 // IMPORTANT: Set your flag here if using it
//                 // await RecentMatch.updateOne({ _id: match._id }, { $set: { contestCancellationCompleted: true } });
//                 continue;
//             }

//             console.log(`⚠️ Found ${contestsToCancel.length} contests to cancel in completed match ${match._id}.`);

//             for (const contest of contestsToCancel) {
//                 console.log(`➡️ Attempting late cancellation for contest ${contest._id} in completed match.`);
//                 // Pass the full contest object if cancelContestAndRefund expects it, which it does.
//                 await cancelContestAndRefund(contest);
//             }

//             // IMPORTANT: Set your flag here after all relevant contests for this match have been processed
//             // await RecentMatch.updateOne({ _id: match._id }, { $set: { contestCancellationCompleted: true } });
//             console.log(`✅ Finished re-checking cancellations for completed match ${match._id}.`);
//         }
//     } catch (error) {
//         console.error('💥 Cron error in handleCompletedMatchCancellations:', error);
//     }
// };

// const start = () => {
//   mongoose.connection.once('open', () => {
//     cron.schedule('* * * * *', handleMatchStarts); // Runs every minute
//     console.log('⏳ Cron scheduled: Match start processing every minute.');

//     // Schedule the new cron for completed match cancellations
//     // This could also run every minute, or less frequently (e.g., every 5 minutes, hourly)
//     // depending on how quickly you need late cancellations to happen.
//     cron.schedule('*/2 * * * *', handleCompletedMatchCancellations); // Runs every 5 minutes
//     console.log('⏳ Cron scheduled: Completed match cancellation re-check every 5 minutes.');
//   });

//   mongoose.connection.on('error', err => {
//     console.error('❌ MongoDB connection error in cron:', err);
//   });
// };

// module.exports = { start };

// start();