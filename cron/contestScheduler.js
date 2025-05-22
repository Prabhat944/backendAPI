const cron = require('node-cron');
const Match = require('../models/Contest'); // ✅ Correct model
const ContestTemplate = require('../models/ContestTemplate');
const ContestParticipation = require('../models/ContestParticipation');

// Run every 2 hours
cron.schedule('0 */2 * * *', async () => {
  console.log('🔁 Auto-creating contests for upcoming matches...');
  const now = new Date();
  const inNext6Hours = new Date(now.getTime() + 6 * 60 * 60 * 1000);

  try {
    // Get upcoming matches
    const upcomingMatches = await Match.find({
      dateTimeGMT: { $gte: now, $lte: inNext6Hours }
    });

    // Get contest templates
    const templates = await ContestTemplate.find({});

    for (const match of upcomingMatches) {
      for (const template of templates) {
        // Find all contests for this match/template config
        const similarContests = await ContestParticipation.find({
          matchId: match._id, // or match.match_id if you're using external ID
          entryFee: template.entryFee,
          totalSpots: template.totalSpots,
        }).sort({ createdAt: 1 });

        if (similarContests.length === 0) {
          // First time creation
          const newContest = new ContestParticipation({
            matchId: match._id,
            entryFee: template.entryFee,
            totalSpots: template.totalSpots,
            prize: template.prize,
            title: `${template.title || 'League'} #1`,
            participants: [],
            filledSpots: 0,
          });

          await newContest.save();
          console.log(`✅ Created contest for match ${match._id} | ₹${template.entryFee} | #1`);
        } else {
          // Check if all existing contests are full
          const allFull = similarContests.every(c => c.filledSpots >= c.totalSpots);

          if (allFull) {
            const version = similarContests.length + 1;
            const newContest = new ContestParticipation({
              matchId: match._id,
              entryFee: template.entryFee,
              totalSpots: template.totalSpots,
              prize: template.prize,
              title: `${template.title || 'League'} #${version}`,
              participants: [],
              filledSpots: 0,
            });

            await newContest.save();
            console.log(`➕ Cloned contest for match ${match._id} | ₹${template.entryFee} | #${version}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error creating contests:', err.message);
  }
});
