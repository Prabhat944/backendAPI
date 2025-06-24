// // File: jobs/contest-scheduler.js

// const cron = require('node-cron');
// const mongoose = require('mongoose');

// // Import your Mongoose models
// const UpcomingMatch = require('../models/UpcomingMatches'); // Using the schema you provided
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');
// const User = require('../models/userModel'); // We need this to refund the user's wallet

// /**
//  * @description A robust helper function to cancel a single contest and refund all participants.
//  * @param {object} contest - The Mongoose document for the contest to be cancelled.
//  */
// const cancelContestAndRefund = async (contest) => {
//   try {
//     console.log(`Cancelling contest ID: ${contest._id} for match ID: ${contest.matchId}`);

//     // 1. Find all participants in this contest
//     const participations = await ContestParticipation.find({ contestId: contest._id }).lean();
//     if (participations.length === 0) {
//       // If no one joined, just mark it as cancelled
//       await Contest.updateOne({ _id: contest._id }, { $set: { status: 'cancelled' } });
//       console.log(`Contest ${contest._id} had no participants. Marked as cancelled.`);
//       return;
//     }

//     // 2. Create an array of promises for all the refund operations
//     const refundPromises = participations.map(p => {
//       // Use $inc for an atomic operation to prevent race conditions
//       // This adds the entryFee back to the user's walletBalance
//       return User.updateOne(
//         { _id: p.user },
//         { $inc: { walletBalance: contest.entryFee } } // IMPORTANT: Assumes your user model has a 'walletBalance' field
//       );
//     });

//     // 3. Execute all refunds in parallel
//     await Promise.all(refundPromises);
//     console.log(`Refunded ${participations.length} users for contest ${contest._id}.`);

//     // 4. After all refunds are successful, update the contest status
//     await Contest.updateOne({ _id: contest._id }, { $set: { status: 'cancelled' } });
//     console.log(`Successfully cancelled and settled contest ${contest._id}.`);
    
//     // Optional: Here you could add logic to send notifications to the refunded users.

//   } catch (error) {
//     // Log the error but don't stop the whole cron job
//     console.error(`Failed to cancel contest ${contest._id}. Error: ${error.message}`);
//     // You might want to add more robust error handling here, like marking the contest as 'cancellation_failed'
//   }
// };


// /**
//  * @description This is the main cron job function that runs every minute.
//  * It finds matches that are starting and processes their contests.
//  */
// const handleMatchStarts = async () => {
//   console.log('Cron Job: Running handleMatchStarts at', new Date().toISOString());
  
//   try {
//     // Find all matches where the start time has passed but we haven't processed them yet
//     const matchesToStart = await UpcomingMatch.find({
//       dateTimeGMT: { $lte: new Date() },
//       matchStarted: false
//     }).lean();

//     if (matchesToStart.length === 0) {
//       console.log('Cron Job: No matches starting right now.');
//       return;
//     }

//     // Process each starting match one by one
//     for (const match of matchesToStart) {
//       console.log(`Processing starting match ID: ${match._id}`);

//       // Find all "upcoming" contests for this match
//       const contests = await Contest.find({ matchId: match._id, status: 'upcoming' }).lean();

//       for (const contest of contests) {
//         // Core Logic: If the contest is not full, cancel it.
//         if (contest.filledSpots < contest.totalSpots) {
//           await cancelContestAndRefund(contest);
//         }
//       }

//       // After processing all contests for the match, update its status
//       await UpcomingMatch.updateOne({ _id: match._id }, { $set: { matchStarted: true } });
//       console.log(`Successfully marked match ${match._id} as started.`);
//     }
//   } catch (error) {
//     console.error('Cron Job: A critical error occurred in handleMatchStarts:', error);
//   }
// };


// /**
//  * @description Initializes and starts the cron job scheduler.
//  * This should be called once when your application starts.
//  */
// const start = () => {
//   // Schedule the job to run every minute.
//   // This is a good balance for being responsive without overloading the server.
//   cron.schedule('* * * * *', handleMatchStarts);

//   console.log('✅ Contest cancellation cron job scheduled to run every minute.');
// };
// start();
// module.exports = { start };
