// // require('dotenv').config();
// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const axios = require('axios');

// const RecentMatch = require('../models/RecentMatch');
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');

// const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL;
// const INTERNAL_WALLET_SERVICE_TOKEN = process.env.INTERNAL_WALLET_SERVICE_TOKEN;
// const GRACE_PERIOD_MINUTES = process.env.GRACE_PERIOD_MINUTES || 5;

// const cancelContestAndRefund = async (contest) => {
//   try {
//     console.log(`🚫 Cancelling contest: ${contest._id}`);
    
//     const participations = await ContestParticipation.find({ contestId: contest._id });
    
//     await Contest.updateOne({ _id: contest._id }, {
//       $set: {
//         status: 'cancelled',
//         cancellationReason: 'Not enough participants when match started',
//       }
//     });

//     for (const p of participations) {
//       if (p.isRefunded) continue;

//       await axios.post(`${WALLET_SERVICE_URL}/api/wallet/refund`, {
//         userId: p.user,
//         breakdown: p.deductionBreakdown,
//         reason: `Contest Cancelled - ${contest.title || 'Unnamed'}`,
//         refundedTransactionId: p.transactionId || null
//       }, {
//         headers: {
//           Authorization: `Bearer ${INTERNAL_WALLET_SERVICE_TOKEN}`
//         }
//       });

//       await ContestParticipation.updateOne({ _id: p._id }, {
//         $set: { isRefunded: true, status: 'cancelled' }
//       });

//       console.log(`💸 Refunded user ${p.user} for participation ${p._id}`);
//     }
//   } catch (error) {
//     console.error(`❌ Error cancelling contest ${contest._id}:`, error.message);
//   }
// };

// // 🕐 Matches that just started
// const handleMatchStarts = async () => {
//   const now = new Date();
//   console.log(`⏱️ Running handleMatchStarts at ${now.toISOString()}`);

//   const matches = await RecentMatch.find({
//     matchStarted: true,
//     matchEnded: false,
//     contestCancellationCompleted: { $ne: true }
//   });

//   for (const match of matches) {
//     const contests = await Contest.find({
//       matchId: match._id,
//       status: { $nin: ['cancelled', 'live', 'cancellation_failed'] },
//     });

//     for (const contest of contests) {
//       if (contest.filledSpots < contest.totalSpots) {
//         await cancelContestAndRefund(contest);
//       } else {
//         await Contest.updateOne({ _id: contest._id }, { $set: { status: 'live', liveAt: now } });
//         console.log(`✅ Contest ${contest._id} is full and marked live`);
//       }
//     }

//     await RecentMatch.updateOne({ _id: match._id }, { $set: { contestCancellationCompleted: true } });
//   }
// };

// // 🏁 Matches that already ended
// const handleCompletedMatchCancellations = async () => {
//   const now = new Date();
//   console.log(`⏱️ Running handleCompletedMatchCancellations at ${now.toISOString()}`);

//   const matches = await RecentMatch.find({
//     matchEnded: true,
//     contestCancellationCompleted: { $ne: true }
//   });

//   for (const match of matches) {
//     const contests = await Contest.find({
//       matchId: match._id,
//       status: { $nin: ['cancelled', 'cancellation_failed'] },
//     });

//     for (const contest of contests) {
//       if (contest.filledSpots < contest.totalSpots) {
//         await cancelContestAndRefund(contest);
//       }
//     }

//     await RecentMatch.updateOne({ _id: match._id }, { $set: { contestCancellationCompleted: true } });
//     console.log(`✅ Marked match ${match._id} as contestCancellationCompleted`);
//   }
// };

// // 🕒 Start Scheduled Jobs
// const startCronJobs = () => {
//   mongoose.connection.once('open', () => {
//     cron.schedule('* * * * *', handleMatchStarts);
//     console.log('✅ Cron: Match Starts - every minute');

//     cron.schedule('*/2 * * * *', handleCompletedMatchCancellations);
//     console.log('✅ Cron: Completed Match Cancellations - every 5 mins');
//   });

//   mongoose.connection.on('error', err => {
//     console.error('❌ MongoDB connection error:', err);
//   });
// };

// startCronJobs();
// module.exports = { startCronJobs };

// if (require.main === module) startCronJobs();
