// // File: path/to/your/contestCreationCron.js

// const cron = require('node-cron');
// const Match = require('../models/UpcomingMatches'); // CORRECTED: Using the 'Match' model. Ensure 'Match.js' is the correct filename in your models folder.
// const Contest = require('../models/Contest');
// const ContestTemplate = require('../models/ContestTemplate');

// // Helper function to run the job
// const createContestsJob = async () => {
//   console.log(`[${new Date().toISOString()}] 🔁 Cron Job: Starting auto-creation of contests...`);
//   const now = new Date();
//   // We'll look for matches starting between now and 24 hours from now.
//   const lookAheadWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

//   try {
//     // 1. Get upcoming matches within the defined window from our local DB.
//     const upcomingMatches = await Match.find({
//       dateTimeGMT: { $gte: now, $lte: lookAheadWindow }
//     }).lean();

//     if (upcomingMatches.length === 0) {
//       console.log(`[${new Date().toISOString()}] ℹ️ No upcoming matches found in the next 24-hour window.`);
//       return;
//     }
//     console.log(`[${new Date().toISOString()}] Found ${upcomingMatches.length} upcoming matches to process.`);

//     // 2. Get all active contest templates.
//     const activeTemplates = await ContestTemplate.find({ isActive: true }).lean();
//     if (activeTemplates.length === 0) {
//       console.log(`[${new Date().toISOString()}] ℹ️ No active contest templates found.`);
//       return;
//     }
//     console.log(`[${new Date().toISOString()}] Found ${activeTemplates.length} active contest templates.`);

//     for (const match of upcomingMatches) {
//       console.log(`[${new Date().toISOString()}]  Processing match: "${match.name}" (ID: ${match._id})`);

//       // 3. Filter templates applicable to the current match's type.
//       const applicableTemplates = activeTemplates.filter(template =>
//         template.matchType === 'ALL' || template.matchType === match.matchType
//       );

//       if (applicableTemplates.length === 0) {
//         continue; // No applicable templates for this match type
//       }

//       for (const template of applicableTemplates) {
//         // 4. Find existing contests for this specific match AND template.
//         const existingContestsFromTemplate = await Contest.find({
//           matchId: match._id.toString(), // CORRECTED: Using match._id to link the contest.
//           contestTemplateId: template._id,
//         }).sort({ createdAt: 1 });

//         const version = existingContestsFromTemplate.length + 1;
        
//         // Data for the new contest
//         const newContestData = {
//             title: `${template.title}`,
//             matchId: match._id.toString(),
//             contestTemplateId: template._id,
//             baseContestId: existingContestsFromTemplate[0]?._id || null,
          
//             type: template.type,
//             entryFee: template.entryFee,
//             totalSpots: template.totalSpots,
//             prize: template.prize,
//             prizeBreakupType: template.prizeBreakupType,
//             prizeDistribution: template.prizeDistribution,
//             signupBonusAllowedPercentage: template.signupBonusAllowedPercentage, // ✅ Add this
//             filledSpots: 0,
//             participants: [],
//             status: 'upcoming',
//           };
          

//         if (existingContestsFromTemplate.length === 0) {
//           // 5a. No contest from this template exists for this match: create the first one.
//           const newContest = new Contest(newContestData);
//           await newContest.save();
//           console.log(`[${new Date().toISOString()}]     ✅ Created initial contest: "${newContest.title}" for match ${match._id}`);
//         } else {
//           // 5b. Contests exist. Check if the latest one is full to decide on cloning.
//           const latestContest = existingContestsFromTemplate[existingContestsFromTemplate.length - 1];
//           if (latestContest.filledSpots >= latestContest.totalSpots) {
//             // The latest contest is full, so create a new one (clone).
//             newContestData.baseContestId = existingContestsFromTemplate[0]._id; // Link back to the first one
//             const newClonedContest = new Contest(newContestData);
//             await newClonedContest.save();
//             console.log(`[${new Date().toISOString()}]     ➕ Cloned contest: "${newClonedContest.title}" for match ${match._id}.`);
//           } else {
//              console.log(`[${new Date().toISOString()}]     ℹ️ Contest for match ${match._id}, template "${template.title}" exists and is not full. No clone needed.`);
//           }
//         }
//       }
//     }
//     console.log(`[${new Date().toISOString()}] ✅ Contest auto-creation cycle finished successfully.`);
//   } catch (err) {
//     console.error(`[${new Date().toISOString()}] ❌ Error during auto-creating contests: ${err.message}`, err.stack);
//   }
// };


// // Schedule the job to run. For example, every 15 minutes.
// cron.schedule('* * * * *', createContestsJob, {
//   scheduled: true,
//   timezone: "Asia/Kolkata"
// });


// console.log(`[${new Date().toISOString()}] 🤖 Contest auto-creation cron job configured to run every 15 minutes.`);