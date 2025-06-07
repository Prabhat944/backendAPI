// File: path/to/your/cronJob.js

const cron = require('node-cron');
const Match = require('../models/Match'); // Adjust path as needed
const Contest = require('../models/Contest'); // Adjust path as needed
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path as needed

// Run every 2 hours (or your preferred schedule: 'minute hour day-of-month month day-of-week')
// Example: '0 */2 * * *' - At minute 0 past every 2nd hour.
cron.schedule('* * * * *', async () => {
  console.log(`[${new Date().toISOString()}] 🔁 Cron Job: Starting auto-creation of contests...`);
  const now = new Date();
  // Define the window for upcoming matches (e.g., next 6 hours)
  const lookAheadWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  try {
    // 1. Get upcoming matches within the defined window
    const upcomingMatches = await Match.find({
      dateTimeGMT: { $gte: now, $lte: lookAheadWindow },
      status: 'Upcoming', // Ensure we only process matches that haven't started
    }).lean(); // .lean() for performance if we don't need Mongoose documents features here
console.log('check upcoingMatches', upcomingMatches);
    if (upcomingMatches.length === 0) {
      console.log(`[${new Date().toISOString()}] ℹ️ No upcoming matches found in the window.`);
      return;
    }
    console.log(`[${new Date().toISOString()}]  encontrados ${upcomingMatches.length} próximos partidos.`);

    // 2. Get all active contest templates
    const activeTemplates = await ContestTemplate.find({ isActive: true }).lean();

    if (activeTemplates.length === 0) {
      console.log(`[${new Date().toISOString()}] ℹ️ No active contest templates found.`);
      return;
    }
    console.log(`[${new Date().toISOString()}] Encontradas ${activeTemplates.length} plantillas activas.`);

    for (const match of upcomingMatches) {
      console.log(`[${new Date().toISOString()}]  Processing match ID: ${match._id} (Type: ${match.matchType})`);

      // 3. Filter templates applicable to the current match's type
      const applicableTemplates = activeTemplates.filter(template =>
        template.matchType === 'ALL' || template.matchType === match.matchType
      );

      if (applicableTemplates.length === 0) {
        console.log(`[${new Date().toISOString()}]   ℹ️ No applicable templates for match ${match._id} (Type: ${match.matchType}).`);
        continue;
      }

      for (const template of applicableTemplates) {
        // 4. Find existing contests for this specific match AND template
        //    We use contestTemplateId for precise matching.
        const existingContestsFromTemplate = await Contest.find({
          matchId: match.externalMatchId.toString(), // Or match.externalMatchId if that's your primary key for contests
          contestTemplateId: template._id,
        }).sort({ createdAt: 1 }); // Sort to determine versioning and find the base

        const version = existingContestsFromTemplate.length + 1;
        const contestTitle = `${template.title} #${version}`;

        // Data for the new contest, to be created if needed
        const newContestData = {
          title: contestTitle,
          matchId: match.externalMatchId.toString(), // Or match.externalMatchId
          contestTemplateId: template._id,
          entryFee: template.entryFee,
          totalSpots: template.totalSpots,
          prize: template.prize,
          prizeBreakupType: template.prizeBreakupType,
          prizeDistribution: template.prizeDistribution,
          filledSpots: 0,
          participants: [],
          status: 'upcoming',
          // baseContestId will be set based on whether it's an initial creation or a clone
        };

        if (existingContestsFromTemplate.length === 0) {
          // 5a. No contest from this template exists for this match: create the first one.
          // This covers the "ensure one H2H, one 3-member, one 4-member" if such templates exist.
          newContestData.baseContestId = null; // This is the first/base contest

          const newContest = new Contest(newContestData);
          await newContest.save();
          console.log(`[${new Date().toISOString()}]     ✅ Created initial contest: "${newContest.title}" (ID: ${newContest._id}) for match ${match._id}, template ${template._id}`);
        } else {
          // 5b. Contests from this template already exist. Check if all are full to decide on cloning.
          const allExistingAreFull = existingContestsFromTemplate.every(
            c => c.filledSpots >= c.totalSpots
          );

          if (allExistingAreFull) {
            // All existing contests for this template & match are full, create a new clone.
            // The new clone's baseContestId points to the _id of the *first* contest in the series.
            newContestData.baseContestId = existingContestsFromTemplate[0]._id; 
            // The title (e.g., #2, #3) is already set correctly by 'version'

            const newClonedContest = new Contest(newContestData);
            await newClonedContest.save();
            console.log(`[${new Date().toISOString()}]     ➕ Cloned contest: "${newClonedContest.title}" (ID: ${newClonedContest._id}) for match ${match._id}, template ${template._id}. Base: ${newContestData.baseContestId}`);
          } else {
            // Optional: Log if contests exist but are not yet full
             console.log(`[${new Date().toISOString()}]     ℹ️ Contests for match ${match._id}, template ${template.title} exist but not all are full. No clone needed yet.`);
          }
        }
      }
    }
    console.log(`[${new Date().toISOString()}] ✅ Contest auto-creation cycle finished successfully.`);
  } catch (err) {
    console.error(`[${new Date().toISOString()}] ❌ Error during auto-creating contests: ${err.message}`, err.stack);
  }
});

// To run the job immediately once for testing, you can do:
// (async () => {
//   console.log("Running cron job manually for testing...");
//   // Find the scheduled task and execute its function
//   const task = cron.getTasks().values().next().value; // Gets the first scheduled task
//   if (task) {
//     const jobFunction = task.options.job; // Accessing the function might depend on node-cron version details
//                                          // Or, more simply, just call the async function directly:
//     // await theFunctionThatIsScheduled(); // where theFunctionThatIsScheduled is the async callback
//   } else {
//     console.log("No scheduled task found to run manually.");
//   }
// })();

console.log(`[${new Date().toISOString()}] 🤖 Contest auto-creation cron job configured.`);