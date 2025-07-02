// contestController.js (Relevant sections for joinContest, joinMultipleContests, getContestsByMatchId)

const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest');
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');
const Match = require('../models/UpcomingMatches'); // Assuming this path
const axios = require('axios');

const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL;

if (!WALLET_SERVICE_URL) {
  console.error('Error: WALLET_SERVICE_URL is not defined in environment variables. Please set it.');
  process.exit(1);
}

exports.joinContest = async (req, res) => {
  const userId = req.user._id.toString();
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
  }

  try {
    const [contest, team, isMatchUpcoming] = await Promise.all([
        // Populate contestTemplateId to get entryFee, maxTeamsPerUser, and signupBonusAllowedPercentage
        Contest.findById(contestId).populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage'),
        Team.findOne({ _id: teamId, user: userId, matchId }),
        Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } })
    ]);

    if (!isMatchUpcoming) {
      return res.status(400).json({ message: 'This match has already started.' });
    }
    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    if (contest.filledSpots >= contest.totalSpots) {
      return res.status(400).json({ message: 'Contest is full' });
    }

    if (!contest.contestTemplateId || typeof contest.contestTemplateId.entryFee === 'undefined') {
      console.error(`Contest ${contestId} or its template is missing entryFee.`);
      return res.status(500).json({ message: 'Contest entry fee not defined.' });
    }

    const entryFee = contest.contestTemplateId.entryFee;
    // Get the exact signup bonus percentage from the contest template
    const signupBonusAllowedPercentageForContest = contest.contestTemplateId.signupBonusAllowedPercentage || 0;


    const entryLimit = contest.contestTemplateId.maxTeamsPerUser || 1;
    const existingParticipations = await ContestParticipation.find({ user: userId, contestId }).lean();

    if (existingParticipations.length >= entryLimit) {
      return res.status(400).json({ message: `You have reached the entry limit of ${entryLimit} for this contest.` });
    }

    const isTeamAlreadyEntered = existingParticipations.some(p => p.teamId.toString() === teamId.toString());
    if (isTeamAlreadyEntered) {
      return res.status(400).json({ message: 'You have already joined this contest with this specific team.' });
    }

    // --- Wallet Deduction ---
    let deductionDetails;
    try {
      const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
        userId: userId,
        amount: entryFee,
        reason: `Contest Entry: ${contest.title} (${contestId})`,
        signupBonusPercentage: signupBonusAllowedPercentageForContest // <-- PASS THE PERCENTAGE
      }, {
        headers: { 'Authorization': req.headers.authorization } // Assuming your wallet service requires this token
      });

      if (walletDeductionResponse.status !== 200) {
        console.error('Wallet deduction failed with non-200 status:', walletDeductionResponse.data);
        return res.status(500).json({ message: 'Failed to deduct funds from wallet.' });
      }

      console.log('Funds successfully deducted:', walletDeductionResponse.data.message);
      deductionDetails = walletDeductionResponse.data.deductionBreakdown; 

    } catch (walletError) {
      if (walletError.response && walletError.response.data && walletError.response.data.message) {
        console.error('Wallet service error:', walletError.response.data.message);
        return res.status(walletError.response.status).json({ message: walletError.response.data.message });
      } else {
        console.error('Error connecting to Wallet Service or unexpected error:', walletError.message);
        return res.status(500).json({ message: 'Error processing wallet transaction. Please try again.' });
      }
    }
    // --- END Wallet Deduction ---

    contest.participants.push(userId);
    contest.filledSpots += 1;
    await contest.save();

    const participation = await ContestParticipation.create({
      user: userId,
      matchId,
      contestId,
      teamId,
      deductionBreakdown: deductionDetails // Ensure this field exists in ContestParticipation schema
    });

    return res.status(201).json({ message: 'Successfully joined contest', participation });

  } catch (err) {
    console.error('Error in joinContest:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.joinMultipleContests = async (req, res) => {
  const { matchId, teamId, count, contestTemplateId } = req.body;
  const userId = req.user._id.toString();

  if (!matchId || !teamId || !count || count < 1 || !contestTemplateId) {
    return res.status(400).json({ message: 'Required: matchId, teamId, valid count, and contestTemplateId' });
  }

  try {
    const isMatchUpcoming = await Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } });
    if (!isMatchUpcoming) {
      return res.status(400).json({ message: "This match is not available for joining or has already started." });
    }

    const team = await Team.findOne({ _id: teamId, user: userId, matchId });
    if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    
    // Populate contestTemplateId to get entryFee, maxTeamsPerUser, and signupBonusAllowedPercentage
    const baseContestForCloning = await Contest.findOne({ contestTemplateId, matchId })
                                            .populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage');
    if (!baseContestForCloning) {
        return res.status(404).json({ message: 'No contests found for this template and match.'});
    }
    
    if (!baseContestForCloning.contestTemplateId || typeof baseContestForCloning.contestTemplateId.entryFee === 'undefined') {
      console.error(`Contest template ${contestTemplateId} is missing entryFee.`);
      return res.status(500).json({ message: 'Contest entry fee not defined for template.' });
    }
    const entryFee = baseContestForCloning.contestTemplateId.entryFee;
    const signupBonusAllowedPercentageForContest = baseContestForCloning.contestTemplateId.signupBonusAllowedPercentage || 0;


    let joinedCount = 0;
    let insufficientFundsMessage = '';

    while (joinedCount < count) {
      let targetContest = await Contest.findOne({
        contestTemplateId: contestTemplateId,
        matchId: matchId,
        filledSpots: { $lt: baseContestForCloning.totalSpots },
        participants: { $ne: userId }
      }).sort({ filledSpots: -1 });

      if (!targetContest) {
        targetContest = await cloneContest(baseContestForCloning);
        if (!targetContest) {
            console.log("Could not clone more contests. Stopping batch join.");
            break;
        }
      }
      
      const alreadyInThisInstance = await ContestParticipation.exists({ user: userId, contestId: targetContest._id });
      if(alreadyInThisInstance) {
        console.log(`User already in contest ${targetContest._id}. Skipping this instance.`);
        continue;
      }

      // --- Wallet Deduction for EACH contest ---
      let deductionDetails;
      try {
        const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
          userId: userId,
          amount: entryFee,
          reason: `Contest Batch Entry: ${targetContest.title} (${targetContest._id})`,
          signupBonusPercentage: signupBonusAllowedPercentageForContest // <-- PASS THE PERCENTAGE
        }, {
          headers: { 'Authorization': req.headers.authorization }
        });

        if (walletDeductionResponse.status !== 200) {
          console.error('Wallet deduction failed with non-200 status for one contest:', walletDeductionResponse.data);
          if (walletDeductionResponse.data && walletDeductionResponse.data.message.includes('Insufficient balance')) {
            insufficientFundsMessage = walletDeductionResponse.data.message;
            break;
          }
          continue;
        }
        console.log(`Funds successfully deducted for contest ${targetContest._id}:`, walletDeductionResponse.data.message);
        deductionDetails = walletDeductionResponse.data.deductionBreakdown;

        targetContest.participants.push(userId);
        targetContest.filledSpots += 1;
        await targetContest.save();

        await ContestParticipation.create({
          user: userId,
          matchId,
          contestId: targetContest._id,
          teamId,
          deductionBreakdown: deductionDetails
        });

        joinedCount++;

      } catch (walletError) {
        if (walletError.response && walletError.response.data && walletError.response.data.message) {
          console.error('Wallet service error for one contest:', walletError.response.data.message);
          if (walletError.response.data.message.includes('Insufficient balance')) {
             insufficientFundsMessage = walletError.response.data.message;
             break;
          }
        } else {
          console.error('Error connecting to Wallet Service or unexpected error during batch join:', walletError.message);
        }
        break;
      }
    }

    let responseMessage = `Successfully joined ${joinedCount} contest(s)`;
    if (joinedCount < count) {
      if (insufficientFundsMessage) {
        responseMessage += `. ${insufficientFundsMessage}`;
      } else {
        responseMessage += `. Some contests could not be joined due to various reasons (e.g., filled up, invalid contest, or other wallet issues).`;
      }
    }
    return res.status(200).json({ message: responseMessage, joinedCount });

  } catch (err) {
    console.error('Error in joinMultipleContests:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};


exports.switchTeam = async (req, res) => {
  const userId = req.user._id;
  const { participationId, newTeamId } = req.body;

  if (!participationId || !newTeamId) {
    return res.status(400).json({ message: 'Required fields: participationId, newTeamId' });
  }

  try {
    const participation = await ContestParticipation.findOne({ _id: participationId, user: userId });
    if (!participation) return res.status(404).json({ message: 'Participation not found' });

    const contestMatch = await Match.findById(participation.matchId, '_id').lean();
    
    if (!contestMatch) {
      return res.status(400).json({ message: 'Cannot switch team after match starts' });
    }

    const newTeam = await Team.findOne({ _id: newTeamId, user: userId, matchId: participation.matchId });
    if (!newTeam) return res.status(400).json({ message: 'Invalid new team' });

    participation.teamId = newTeamId;
    await participation.save();

    return res.json({ message: 'Team switched successfully' });
  } catch (err) {
    console.error('Error in switchTeam:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getContestsByMatchId = async (req, res) => {
  try {
    const { matchId } = req.params;

    if (!matchId) {
      return res.status(400).json({ message: 'A matchId is required.' });
    }

    const contests = await Contest.find({ matchId })
      .select('title entryFee totalSpots filledSpots prize prizeBreakupType contestTemplateId')
      .populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage') // <-- Add this field
      .lean();

    return res.status(200).json(contests);

  } catch (error) {
    console.error('Error fetching contests by match ID:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * Cancels a contest and initiates refunds to all participants based on their original deduction breakdown.
 * This function assumes a specific contest ID is passed for cancellation.
 * You might protect this endpoint with an admin/internal middleware.
 */
exports.cancelContest = async (req, res) => {
  const { contestId } = req.body; // Or req.params if you use it in URL

  if (!contestId) {
    return res.status(400).json({ message: 'Contest ID is required for cancellation.' });
  }

  try {
    const contest = await Contest.findById(contestId);
    if (!contest) {
      return res.status(404).json({ message: 'Contest not found.' });
    }
    console.log(`Contest ${contestId} marked for cancellation.`);

    const participations = await ContestParticipation.find({ contestId }).select('user deductionBreakdown');

    if (participations.length === 0) {
      return res.status(200).json({ message: 'Contest cancelled, no participants to refund.' });
    }

    let successfulRefunds = 0;
    let failedRefunds = 0;
    const refundErrors = [];

    for (const participation of participations) {
      const userId = participation.user.toString();
      const breakdown = participation.deductionBreakdown; 

      if (!breakdown || Object.keys(breakdown).length === 0 || 
          (breakdown.deposit_balance === 0 && breakdown.cashback_balance === 0 && 
           breakdown.withdrawal_balance === 0 && breakdown.signup_bonus_balance === 0)) {
        console.warn(`No valid deduction breakdown found for participation ${participation._id}. Skipping refund for user ${userId}.`);
        failedRefunds++;
        refundErrors.push({ userId, message: 'No valid deduction breakdown recorded for this participation.' });
        continue;
      }

      try {
        const refundResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/refund`, {
          userId: userId,
          breakdown: breakdown,
          reason: `Contest Cancellation: ${contest.title} (${contestId})`
        }, {
          // IMPORTANT: AUTHENTICATION FOR SERVICE-TO-SERVICE CALL
          // This must be a token that the Wallet Service expects for internal calls.
          // For example:
          headers: { 'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}` } // Assuming you have this env var
        });

        if (refundResponse.status === 200) {
          successfulRefunds++;
          console.log(`Refund successful for user ${userId}:`, refundResponse.data.message);
        } else {
          failedRefunds++;
          refundErrors.push({ userId, message: `Wallet service responded with status ${refundResponse.status}: ${refundResponse.data.message}` });
          console.error(`Refund failed for user ${userId}:`, refundResponse.data);
        }
      } catch (refundError) {
        failedRefunds++;
        if (refundError.response && refundError.response.data && refundError.response.data.message) {
          refundErrors.push({ userId, message: `Wallet service error: ${refundError.response.data.message}` });
          console.error(`Wallet service error for user ${userId}:`, refundError.response.data.message);
        } else {
          refundErrors.push({ userId, message: `Network/unexpected error: ${refundError.message}` });
          console.error(`Error connecting to Wallet Service for user ${userId}:`, refundError.message);
        }
      }
    }

    return res.status(200).json({
      message: `Contest ${contestId} cancelled. Refund process completed.`,
      summary: {
        totalParticipants: participations.length,
        successfulRefunds,
        failedRefunds
      },
      errors: refundErrors
    });

  } catch (err) {
    console.error('Error in cancelContest:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};