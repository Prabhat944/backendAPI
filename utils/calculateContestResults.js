const ContestParticipation = require('../models/ContestParticipation');
const PlayerPerformance = require('../models/PlayerPerformanceSchema');
const Team = require('../models/TeamSchema');
const Contest = require('../models/Contest'); // Your Contest model
const UserContestOutcome = require('../models/UserContestOutcome'); // Path to your UserContestOutcome model

async function calculateContestResults(matchId, contestId) {
  try {
    const participations = await ContestParticipation.find({ matchId, contestId });

    if (participations.length === 0) {
      console.log('No participations found for this contest.');
      return { success: false, message: 'No participations found.', data: [] };
    }

    const playerPerformances = await PlayerPerformance.find({ matchId });
    const playerPointsMap = {};
    for (const perf of playerPerformances) {
      playerPointsMap[perf.playerId.toString()] = perf.points || 0;
    }

    const scoredParticipants = [];
    for (const p of participations) {
      let totalPoints = 0;
      const team = await Team.findById(p.teamId).lean();

      if (!team || !team.players) {
        console.error(`❌ Invalid team format in participation: ${p._id} for contestId: ${contestId}`);
        const plainParticipation = p.toObject ? p.toObject() : { ...p };
        scoredParticipants.push({
            ...plainParticipation,
            totalPoints: 0,
            rank: null,
            isWinner: false,
            prizeWon: 0,
            error: 'Invalid team data'
        });
        continue;
      }

      for (const playerId of team.players) {
        const basePoints = playerPointsMap[playerId.toString()] || 0;
        let multiplier = 1;
        if (team.captain && playerId.toString() === team.captain.toString()) multiplier = 2;
        else if (team.viceCaptain && playerId.toString() === team.viceCaptain.toString()) multiplier = 1.5;
        totalPoints += basePoints * multiplier;
      }
      
      const tempParticipant = p.toObject();
      tempParticipant.totalPoints = totalPoints;
      scoredParticipants.push(tempParticipant);
    }

    scoredParticipants.sort((a, b) => b.totalPoints - a.totalPoints);

    const contest = await Contest.findById(contestId).lean();
    if (!contest) {
      console.error(`❌ Contest not found: ${contestId}`);
      return { success: false, message: 'Contest not found.', data: scoredParticipants };
    }

    const totalPrize = contest.prize || 0;
    const prizeDistributionLogic = contest.prizeBreakupType; 

    console.log(`[DEBUG] For Contest ID: ${contestId}`);
    console.log(`[DEBUG]   Fetched prizeBreakupType: ${prizeDistributionLogic}`);

    const finalParticipantsData = [];
    for (let i = 0; i < scoredParticipants.length; i++) {
      const participantData = scoredParticipants[i]; // This is a plain JS object from p.toObject()
      participantData.rank = i + 1;

      if (prizeDistributionLogic === 'winnerTakesAll') {
        participantData.isWinner = (i === 0);
        participantData.prizeWon = (i === 0) ? totalPrize : 0;
      } else if (prizeDistributionLogic === 'top3Split') {
        const topN = Math.min(3, scoredParticipants.length);
        const prizeSplit = [0.5, 0.3, 0.2]; 
        
        participantData.isWinner = (i < topN);
        participantData.prizeWon = (i < topN && prizeSplit[i] !== undefined) ? Math.floor(totalPrize * prizeSplit[i]) : 0;
      } else {
        console.warn(`Unknown prizeBreakupType: ${prizeDistributionLogic} for contest ${contestId}. Defaulting to no prize.`);
        participantData.isWinner = false;
        participantData.prizeWon = 0;
      }
      
      // Update ContestParticipation document
      const participationToUpdate = await ContestParticipation.findById(participantData._id);
      if (participationToUpdate) {
        participationToUpdate.totalPoints = participantData.totalPoints;
        participationToUpdate.rank = participantData.rank;
        participationToUpdate.isWinner = participantData.isWinner;
        participationToUpdate.prizeWon = participantData.prizeWon;
        await participationToUpdate.save();
        
        // ---- START: Logic to Create/Update UserContestOutcome ----
        try {
          const resultStatus = participantData.isWinner ? 'WIN' : 'LOSS';
          // Note: Logic for 'DRAW' status is not explicitly handled here.
          // It will be 'LOSS' if not a 'WIN'.

          const userOutcomeData = {
            user: participationToUpdate.user, // Assuming 'user' field exists on ContestParticipation
            contestId: contestId,
            matchId: matchId,
            teamId: participationToUpdate.teamId, // Assuming 'teamId' field exists
            rank: participantData.rank,
            points: participantData.totalPoints, // Points scored in this contest participation
            prizeWon: participantData.prizeWon,
            resultStatus: resultStatus,
            // You might want to add contestName, entryFee etc. if they are part of UserContestOutcome schema
            // contestName: contest.name, 
            // entryFee: contest.entryFee,
          };

          await UserContestOutcome.findOneAndUpdate(
            { user: userOutcomeData.user, contestId: userOutcomeData.contestId },
            { $set: userOutcomeData },
            { upsert: true, new: true, runValidators: true } // upsert creates if not found
          );
          // console.log(`UserContestOutcome saved/updated for user ${userOutcomeData.user} in contest ${userOutcomeData.contestId}`);

        } catch (outcomeError) {
          console.error(`❌ Error saving UserContestOutcome for user ${participationToUpdate.user}, contest ${contestId}:`, outcomeError);
          // Depending on your error strategy, you might want to collect these errors
          // or decide if it affects the overall success of calculateContestResults.
          // For now, it's logged, and the main function proceeds.
        }
        // ---- END: Logic to Create/Update UserContestOutcome ----

        finalParticipantsData.push(participationToUpdate.toObject());
      } else {
        // This case (participationToUpdate not found) should be rare if participantData._id is valid
        console.warn(`Could not find ContestParticipation with _id: ${participantData._id} to update.`);
        finalParticipantsData.push(participantData); // Push the data we have (not from DB)
      }
    }

    console.log(`✅ Results calculated and outcomes recorded for Contest ${contestId} - Match ${matchId}`);
    return { success: true, message: 'Results calculated and outcomes recorded successfully.', data: finalParticipantsData };

  } catch (error) {
    console.error(`❌ Error in calculateContestResults for contest ${contestId}:`, error);
    return { success: false, message: `Error calculating results: ${error.message}`, data: [] };
  }
}

async function createDummyContest(matchId) {
  try {
    const contest = new Contest({
      matchId: matchId,
      entryFee: 370,
      totalSpots: 3,
      filledSpots: 0,
      prize: 1000,
      title: 'Test Contest #1',
      participants: [],
      prizeBreakupType: 'winnerTakesAll',  // <-- Set winner takes all here
      // Optionally, if you want a custom split, use this:
      // prizeBreakupType: 'top3Split',
      // customPrizeBreakup: [70, 20, 10],
    });

    await contest.save();
    console.log('✅ Dummy contest created:', contest._id);
  } catch (err) {
    console.error('❌ Error creating dummy contest:', err.message);
  }
}

module.exports = {
  calculateContestResults,
  createDummyContest
}