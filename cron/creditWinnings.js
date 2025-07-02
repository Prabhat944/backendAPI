// // File: jobs/creditWinningsCron.js

// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const axios = require('axios');
// const ContestParticipation = require('../models/ContestParticipation');
// const Contest = require('../models/Contest');

// const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL;
// const INTERNAL_WALLET_SERVICE_TOKEN = process.env.INTERNAL_WALLET_SERVICE_TOKEN; // This must be the JWT with system user ID

// // Essential check for the token
// if (!INTERNAL_WALLET_SERVICE_TOKEN) {
//     console.error('❌ INTERNAL_WALLET_SERVICE_TOKEN not set in environment variables. Winnings credit might fail!');
// }

// const creditWinnings = async () => {
//     console.log('===========================================');
//     console.log(`[${new Date().toLocaleString()}] 🔄 Starting winnings credit cron...`);

//     try {
//         // Step 1: Find all winning participations that haven't been credited
//         // `isWinningCredited: { $ne: true }` correctly picks up false or undefined
//         const participationsEligibleForCredit = await ContestParticipation.find({
//             isWinner: true,
//             isWinningCredited: { $ne: true } 
//         })
//         .select('user prizeWon matchId _id contestId') // Ensure contestId and matchId are selected
//         .lean();

//         if (participationsEligibleForCredit.length === 0) {
//             console.log('✅ No winnings to credit. Exiting.');
//             return;
//         }

//         console.log(`🔍 Found ${participationsEligibleForCredit.length} winning participations initially.`);

//         // Step 2: Get all unique contest IDs from these participations
//         const contestIds = [...new Set(participationsEligibleForCredit.map(p => p.contestId.toString()))];

//         // Step 3: Fetch the status of all these related contests
//         // Only need status to filter out cancelled/uncompleted ones
//         const contests = await Contest.find({
//             _id: { $in: contestIds }
//         })
//         .select('status')
//         .lean();

//         // Create a map for quick lookup of contest statuses
//         const contestStatusMap = new Map(contests.map(c => [c._id.toString(), c.status]));

//         // Step 4: Filter participations based on contest status
//         const participationsToCreditFiltered = participationsEligibleForCredit.filter(p => {
//             const contestStatus = contestStatusMap.get(p.contestId.toString());
//             // Only proceed if the contest is 'completed'. 'live' is usually too early for final winnings.
//             // If the status in your Contest model includes values like 'Team A Won' or 'Draw',
//             // you might adjust this condition. For simplicity, 'completed' is robust.
//             if (contestStatus === 'completed') { 
//                 return true;
//             } else {
//                 console.log(`ℹ️ Skipping credit for participation ${p._id}: Associated contest ${p.contestId} has status '${contestStatus}' (must be 'completed').`);
//                 // If a contest is cancelled but still marked isWinner:true in participation,
//                 // this also correctly skips it. This ideally should be handled in contest cancellation cron.
//                 return false;
//             }
//         });

//         if (participationsToCreditFiltered.length === 0) {
//             console.log('✅ No eligible winnings to credit after filtering by contest status. Exiting.');
//             return;
//         }

//         console.log(`✨ Found ${participationsToCreditFiltered.length} eligible winning participations after filtering.`);

//         for (const participation of participationsToCreditFiltered) {
//             const { user: userId, prizeWon, matchId, _id: participationId, contestId } = participation; // Destructure contestId too

//             console.log(`Attempting to credit ₹${prizeWon} to user ${userId} for participation ${participationId} (Match: ${matchId}, Contest: ${contestId})`);

//             try {
//                 // This axios call needs the INTERNAL_WALLET_SERVICE_TOKEN in the Authorization header
//                 const response = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/win`, {
//                     userId,      // The actual user ID to credit winnings to
//                     amount: prizeWon,
//                     matchId,
//                     contestId    // Pass contestId for better transaction history
//                 }, {
//                     headers: {
//                         // The Bearer token generated from your system user ID
//                         Authorization: `Bearer ${INTERNAL_WALLET_SERVICE_TOKEN}` 
//                     }
//                 });

//                 if (response.status === 200) {
//                     // Only mark as credited if the wallet service successfully processed it
//                     await ContestParticipation.updateOne(
//                         { _id: participationId },
//                         { $set: { isWinningCredited: true } }
//                     );
//                     console.log(`🟢 Successfully credited ₹${prizeWon} to user ${userId} for participation ${participationId}`);
//                 } else {
//                     // Log detailed error from wallet service if available
//                     if (response.data) { 
//                         console.error(`🔴 Failed to credit ₹${prizeWon} to user ${userId} (HTTP ${response.status}):`, response.data);
//                     } else {
//                         console.error(`🔴 Failed to credit ₹${prizeWon} to user ${userId} (HTTP ${response.status}): No response data.`);
//                     }
//                 }
//             } catch (err) {
//                 // Catch network errors or errors thrown by axios before a response is received
//                 if (err.response) {
//                     console.error(`❌ Error crediting ₹${prizeWon} to user ${userId} (HTTP ${err.response.status}):`, err.response.data);
//                 } else {
//                     console.error(`❌ Error crediting ₹${prizeWon} to user ${userId}:`, err.message);
//                 }
//                 // Important: Do NOT mark as credited if there was an error. It will be retried.
//             }
//         }

//     } catch (err) {
//         console.error('🔥 Critical error in winnings cron:', err.message, err.stack); // Log stack for critical errors
//     }

//     console.log(`[${new Date().toLocaleString()}] ✅ Winnings credit cron finished.`);
//     console.log('===========================================');
// };

// const scheduleCreditWinnings = () => {
//     // Ensure Mongoose connection is open before scheduling
//     mongoose.connection.once('open', () => {
//         creditWinnings(); // Run once on startup for immediate processing
//         // Schedule to run every 5 minutes
//         cron.schedule('*/5 * * * *', creditWinnings, {
//             scheduled: true,
//             timezone: 'Asia/Kolkata' // Specify timezone if needed for precise scheduling
//         });
//         console.log('✅ Winnings credit cron job scheduled every 5 minutes.');
//     });

//     mongoose.connection.on('error', err => {
//         console.error('❌ MongoDB connection error in winnings cron:', err);
//     });
// };

// scheduleCreditWinnings(); // Call the scheduling function

// module.exports = { scheduleCreditWinnings };