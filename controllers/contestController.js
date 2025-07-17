// contestController.js (Relevant sections for joinContest, joinMultipleContests, getContestsByMatchId)

const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest');
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');
const Match = require('../models/UpcomingMatches'); // Assuming this path
const axios = require('axios');
const mongoose = require('mongoose');
const User = require('../models/userModel')
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL;
const OFFER_SERVICE_URL = process.env.OFFER_SERVICE_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
if (!WALLET_SERVICE_URL) {
  console.error('Error: WALLET_SERVICE_URL is not defined in environment variables. Please set it.');
  process.exit(1);
}

// exports.joinContest = async (req, res) => {
//   const userId = req.user._id.toString();
//   const { matchId, contestId, teamId } = req.body;

//   if (!matchId || !contestId || !teamId) {
//     return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
//   }

//   try {
//     const [contest, team, isMatchUpcoming] = await Promise.all([
//         // Populate contestTemplateId to get entryFee, maxTeamsPerUser, and signupBonusAllowedPercentage
//         Contest.findById(contestId).populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage'),
//         Team.findOne({ _id: teamId, user: userId, matchId }),
//         Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } })
//     ]);

//     if (!isMatchUpcoming) {
//       return res.status(400).json({ message: 'This match has already started.' });
//     }
//     if (!contest) return res.status(404).json({ message: 'Contest not found' });
//     if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
//     if (contest.filledSpots >= contest.totalSpots) {
//       return res.status(400).json({ message: 'Contest is full' });
//     }

//     if (!contest.contestTemplateId || typeof contest.contestTemplateId.entryFee === 'undefined') {
//       console.error(`Contest ${contestId} or its template is missing entryFee.`);
//       return res.status(500).json({ message: 'Contest entry fee not defined.' });
//     }

//     const entryFee = contest.contestTemplateId.entryFee;
//     // Get the exact signup bonus percentage from the contest template
//     const signupBonusAllowedPercentageForContest = contest.contestTemplateId.signupBonusAllowedPercentage || 0;


//     const entryLimit = contest.contestTemplateId.maxTeamsPerUser || 1;
//     const existingParticipations = await ContestParticipation.find({ user: userId, contestId }).lean();

//     if (existingParticipations.length >= entryLimit) {
//       return res.status(400).json({ message: `You have reached the entry limit of ${entryLimit} for this contest.` });
//     }

//     const isTeamAlreadyEntered = existingParticipations.some(p => p.teamId.toString() === teamId.toString());
//     if (isTeamAlreadyEntered) {
//       return res.status(400).json({ message: 'You have already joined this contest with this specific team.' });
//     }

//     // --- Wallet Deduction ---
//     let deductionDetails;
//     try {
//       const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
//         userId: userId,
//         amount: entryFee,
//         reason: `Contest Entry: ${contest.title} (${contestId})`,
//         signupBonusPercentage: signupBonusAllowedPercentageForContest // <-- PASS THE PERCENTAGE
//       }, {
//         headers: { 'Authorization': req.headers.authorization } // Assuming your wallet service requires this token
//       });

//       if (walletDeductionResponse.status !== 200) {
//         console.error('Wallet deduction failed with non-200 status:', walletDeductionResponse.data);
//         return res.status(500).json({ message: 'Failed to deduct funds from wallet.' });
//       }

//       console.log('Funds successfully deducted:', walletDeductionResponse.data.message);
//       deductionDetails = walletDeductionResponse.data.deductionBreakdown; 

//     } catch (walletError) {
//       if (walletError.response && walletError.response.data && walletError.response.data.message) {
//         console.error('Wallet service error:', walletError.response.data.message);
//         return res.status(walletError.response.status).json({ message: walletError.response.data.message });
//       } else {
//         console.error('Error connecting to Wallet Service or unexpected error:', walletError.message);
//         return res.status(500).json({ message: 'Error processing wallet transaction. Please try again.' });
//       }
//     }
//     // --- END Wallet Deduction ---

//     contest.participants.push(userId);
//     contest.filledSpots += 1;
//     await contest.save();

//     const participation = await ContestParticipation.create({
//       user: userId,
//       matchId,
//       contestId,
//       teamId,
//       deductionBreakdown: deductionDetails // Ensure this field exists in ContestParticipation schema
//     });

//     return res.status(201).json({ message: 'Successfully joined contest', participation });

//   } catch (err) {
//     console.error('Error in joinContest:', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

exports.joinContest = async (req, res) => {
  const userId = req.user._id.toString();
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
  }

  try {
    const [contest, team, isMatchUpcoming] = await Promise.all([
        Contest.findById(contestId).populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage title'),
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
    if (!contest.contestTemplateId) {
      return res.status(500).json({ message: 'Contest configuration is missing.' });
    }

    const { entryFee, maxTeamsPerUser, signupBonusAllowedPercentage, title: contestTitle } = contest.contestTemplateId;

    const entryLimit = maxTeamsPerUser || 1;
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
    let transactionId;
    try {
      const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
        userId,
        amount: entryFee,
        reason: `Contest Entry: ${contestTitle} (${contestId})`,
        signupBonusPercentage: signupBonusAllowedPercentage
      }, {
        headers: { 'Authorization': req.headers.authorization }
      });
      deductionDetails = walletDeductionResponse.data.deductionBreakdown; 
      transactionId = walletDeductionResponse.data.transactionId;
    } catch (walletError) {
      const status = walletError.response?.status || 500;
      const message = walletError.response?.data?.message || 'Error processing wallet transaction.';
      return res.status(status).json({ message });
    }
    // --- END Wallet Deduction ---

    try {
        const participation = await ContestParticipation.create({
            user: userId,
            matchId,
            contestId,
            teamId,
            deductionBreakdown: deductionDetails,
            transactionId
        });

        // ✅ ATOMIC UPDATE: Safely increment the filledSpots count.
        await Contest.findByIdAndUpdate(contestId, { $inc: { filledSpots: 1 } });

        // ✅ Notify the Offer Service (This will not crash the main function if it fails)
        try {
          console.log("tag here======>",{ userId, matchId, contestId });
            await axios.post(`${OFFER_SERVICE_URL}/api/offerRoutes/track-progress`, {
                userId: userId,
                matchId: matchId,
                contestId: contestId
            },
            {
              headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` } // Added auth header
            });

        } catch (offerError) {
            console.error(`[Non-blocking error] Failed to track offer progress for user ${userId} in match ${matchId}:`, offerError.message);
        }

        return res.status(201).json({ message: 'Successfully joined contest', participation });

    } catch(dbError) {
        // --- Refund Logic ---
        console.error('CRITICAL: DB save failed after wallet deduction. Initiating refund.', dbError);
        try {
            await axios.post(`${WALLET_SERVICE_URL}/api/wallet/refund`, {
                transactionId: transactionId,
                reason: `Automatic refund: Failed to join contest ${contestId}`
            }, { headers: { 'Authorization': req.headers.authorization }});
        } catch (refundError) {
            console.error(`CRITICAL FAILURE: Automatic refund for transaction ${transactionId} FAILED.`, refundError.message);
        }

        if (dbError.code === 11000) {
            return res.status(400).json({ message: 'You have already joined with this specific team. Your entry fee has been refunded.' });
        }
        return res.status(500).json({ message: 'Could not join contest due to a database error. Your entry fee has been refunded.' });
    }

  } catch (err) {
    console.error('Error in joinContest:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// exports.joinMultipleContests = async (req, res) => {
//   const { matchId, teamId, count, contestTemplateId } = req.body;
//   const userId = req.user._id.toString();

//   if (!matchId || !teamId || !count || count < 1 || !contestTemplateId) {
//     return res.status(400).json({ message: 'Required: matchId, teamId, valid count, and contestTemplateId' });
//   }

//   try {
//     const isMatchUpcoming = await Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } });
//     if (!isMatchUpcoming) {
//       return res.status(400).json({ message: "This match is not available for joining or has already started." });
//     }

//     const team = await Team.findOne({ _id: teamId, user: userId, matchId });
//     if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    
//     // Populate contestTemplateId to get entryFee, maxTeamsPerUser, and signupBonusAllowedPercentage
//     const baseContestForCloning = await Contest.findOne({ contestTemplateId, matchId })
//                                             .populate('contestTemplateId', 'entryFee maxTeamsPerUser signupBonusAllowedPercentage');
//     if (!baseContestForCloning) {
//         return res.status(404).json({ message: 'No contests found for this template and match.'});
//     }
    
//     if (!baseContestForCloning.contestTemplateId || typeof baseContestForCloning.contestTemplateId.entryFee === 'undefined') {
//       console.error(`Contest template ${contestTemplateId} is missing entryFee.`);
//       return res.status(500).json({ message: 'Contest entry fee not defined for template.' });
//     }
//     const entryFee = baseContestForCloning.contestTemplateId.entryFee;
//     const signupBonusAllowedPercentageForContest = baseContestForCloning.contestTemplateId.signupBonusAllowedPercentage || 0;


//     let joinedCount = 0;
//     let insufficientFundsMessage = '';

//     while (joinedCount < count) {
//       let targetContest = await Contest.findOne({
//         contestTemplateId: contestTemplateId,
//         matchId: matchId,
//         filledSpots: { $lt: baseContestForCloning.totalSpots },
//         participants: { $ne: userId }
//       }).sort({ filledSpots: -1 });

//       if (!targetContest) {
//         targetContest = await cloneContest(baseContestForCloning);
//         if (!targetContest) {
//             console.log("Could not clone more contests. Stopping batch join.");
//             break;
//         }
//       }
      
//       const alreadyInThisInstance = await ContestParticipation.exists({ user: userId, contestId: targetContest._id });
//       if(alreadyInThisInstance) {
//         console.log(`User already in contest ${targetContest._id}. Skipping this instance.`);
//         continue;
//       }

//       // --- Wallet Deduction for EACH contest ---
//       let deductionDetails;
//       try {
//         const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
//           userId: userId,
//           amount: entryFee,
//           reason: `Contest Batch Entry: ${targetContest.title} (${targetContest._id})`,
//           signupBonusPercentage: signupBonusAllowedPercentageForContest // <-- PASS THE PERCENTAGE
//         }, {
//           headers: { 'Authorization': req.headers.authorization }
//         });

//         if (walletDeductionResponse.status !== 200) {
//           console.error('Wallet deduction failed with non-200 status for one contest:', walletDeductionResponse.data);
//           if (walletDeductionResponse.data && walletDeductionResponse.data.message.includes('Insufficient balance')) {
//             insufficientFundsMessage = walletDeductionResponse.data.message;
//             break;
//           }
//           continue;
//         }
//         console.log(`Funds successfully deducted for contest ${targetContest._id}:`, walletDeductionResponse.data.message);
//         deductionDetails = walletDeductionResponse.data.deductionBreakdown;

//         targetContest.participants.push(userId);
//         targetContest.filledSpots += 1;
//         await targetContest.save();

//         await ContestParticipation.create({
//           user: userId,
//           matchId,
//           contestId: targetContest._id,
//           teamId,
//           deductionBreakdown: deductionDetails
//         });

//         joinedCount++;

//       } catch (walletError) {
//         if (walletError.response && walletError.response.data && walletError.response.data.message) {
//           console.error('Wallet service error for one contest:', walletError.response.data.message);
//           if (walletError.response.data.message.includes('Insufficient balance')) {
//              insufficientFundsMessage = walletError.response.data.message;
//              break;
//           }
//         } else {
//           console.error('Error connecting to Wallet Service or unexpected error during batch join:', walletError.message);
//         }
//         break;
//       }
//     }

//     let responseMessage = `Successfully joined ${joinedCount} contest(s)`;
//     if (joinedCount < count) {
//       if (insufficientFundsMessage) {
//         responseMessage += `. ${insufficientFundsMessage}`;
//       } else {
//         responseMessage += `. Some contests could not be joined due to various reasons (e.g., filled up, invalid contest, or other wallet issues).`;
//       }
//     }
//     return res.status(200).json({ message: responseMessage, joinedCount });

//   } catch (err) {
//     console.error('Error in joinMultipleContests:', err);
//     return res.status(500).json({ message: 'Internal server error', error: err.message });
//   }
// };

exports.joinMultipleContests = async (req, res) => {
  const { matchId, teamId, count, contestTemplateId } = req.body;
  const userId = req.user._id.toString();

  if (!matchId || !teamId || !count || count < 1 || !contestTemplateId) {
    return res.status(400).json({ message: 'Required: matchId, teamId, valid count, and contestTemplateId' });
  }

  try {
    const [isMatchUpcoming, team, baseContestForCloning] = await Promise.all([
        Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } }),
        Team.findOne({ _id: teamId, user: userId, matchId }),
        Contest.findOne({ contestTemplateId, matchId }).populate('contestTemplateId', 'entryFee signupBonusAllowedPercentage title')
    ]);
    
    if (!isMatchUpcoming) return res.status(400).json({ message: "This match is not available for joining." });
    if (!team) return res.status(400).json({ message: 'Invalid team for this match' });
    if (!baseContestForCloning) return res.status(404).json({ message: 'No contests found for this template and match.'});
    if (!baseContestForCloning.contestTemplateId) return res.status(500).json({ message: 'Contest entry fee not defined for template.' });

    const { entryFee, signupBonusAllowedPercentage, title: contestTitle } = baseContestForCloning.contestTemplateId;

    let joinedCount = 0;
    let insufficientFundsMessage = '';

    // ✅ FIX 1: Get all contest INSTANCES the user has already joined for this match.
    const existingParticipations = await ContestParticipation.find({ userId, matchId }).select('contestId').lean();
    const joinedContestIds = existingParticipations.map(p => p.contestId);

    for (let i = 0; i < count; i++) {
      // ✅ FIX 2: Correct the query to exclude already-joined contests and remove the faulty 'participants' check.
      let targetContest = await Contest.findOne({
        contestTemplateId: contestTemplateId,
        matchId: matchId,
        filledSpots: { $lt: baseContestForCloning.totalSpots },
        _id: { $nin: joinedContestIds } // Exclude contests we've already joined
      }).sort({ filledSpots: -1 });

      if (!targetContest) {
        // Now this will be called correctly when no available spots are found
        targetContest = await cloneContest(baseContestForCloning);
        if (!targetContest) break;
      }
      
      try {
        const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
          userId,
          amount: entryFee,
          reason: `Contest Batch Entry: ${contestTitle} (${targetContest._id})`,
          signupBonusPercentage: signupBonusAllowedPercentage
        }, { headers: { 'Authorization': req.headers.authorization }});

        const { deductionBreakdown, transactionId } = walletDeductionResponse.data;

        await ContestParticipation.create({
          user: userId,
          matchId,
          contestId: targetContest._id,
          teamId,
          deductionBreakdown,
          transactionId
        });
        
        // Add the newly joined contest to our exclusion list for the next loop
        joinedContestIds.push(targetContest._id);

        await Contest.findByIdAndUpdate(targetContest._id, { $inc: { filledSpots: 1 } });
        joinedCount++;

        try {
          console.log("tag here======>1",{ userId, matchId });
            await axios.post(`${OFFER_SERVICE_URL}/api/offerRoutes/track-progress`, { userId, matchId },
              {
                headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` } // Added auth header
              }
            );
        } catch (offerError) {
            console.error(`[Non-blocking error] Failed to track offer progress during batch join:`, offerError.message);
        }

      } catch (walletError) {
        if (walletError.response?.data?.message.includes('Insufficient balance')) {
           insufficientFundsMessage = walletError.response.data.message;
        } else {
           console.error('Wallet service error during batch join:', walletError.message);
        }
        break;
      }
    }

    let responseMessage = `Successfully joined ${joinedCount} contest(s)`;
    if (joinedCount < count) {
      responseMessage += insufficientFundsMessage ? `. Stopped due to insufficient funds.` : `. Some contests could not be joined.`;
    }
    return res.status(200).json({ message: responseMessage, joinedCount });

  } catch (err) {
    console.error('Error in joinMultipleContests:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.switchTeam = async (req, res) => {
  const userId = req.user._id;
  const { participationId, newTeamId } = req.body;

  if (!participationId || !newTeamId) {
    return res.status(400).json({ message: 'Required fields: participationId, newTeamId' });
  }

  try {
    console.log('User ID:', userId);
    console.log('participationId:', participationId);
    console.log('newTeamId:', newTeamId);
    console.log('req.user:', req.user);

    // ✅ Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(participationId) ||
      !mongoose.Types.ObjectId.isValid(newTeamId) ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }

    const participation = await ContestParticipation.findOne({
      _id: new mongoose.Types.ObjectId(participationId),
      user: new mongoose.Types.ObjectId(userId)
    });

    console.log('Participation Found:', participation);

    if (!participation) return res.status(404).json({ message: 'Participation not found' });

    const contestMatch = await Match.findById(participation.matchId, '_id').lean();

    if (!contestMatch) {
      return res.status(400).json({ message: 'Cannot switch team after match starts' });
    }

    const newTeam = await Team.findOne({
      _id: new mongoose.Types.ObjectId(newTeamId),
      user: new mongoose.Types.ObjectId(userId),
      matchId: participation.matchId
    });

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

exports.joinTeamContest = async (req, res) => {
  const userId = req.user._id.toString();
  const { matchId, contestId, teamId, contestTeam } = req.body;

  if (!contestId || !teamId || !contestTeam || !['A', 'B'].includes(contestTeam)) {
      return res.status(400).json({ message: 'Required fields: contestId, teamId, and contestTeam ("A" or "B")' });
  }

  try {
      const [contest, team, isMatchUpcoming] = await Promise.all([
          Contest.findById(contestId).populate({
              path: 'contestTemplateId',
              select: 'entryFee maxTeamsPerUser signupBonusAllowedPercentage teamContestConfig title'
          }),
          Team.findOne({ _id: teamId, user: userId, matchId }),
          Match.exists({ _id: matchId, dateTimeGMT: { $gt: new Date() } })
      ]);

      if (!isMatchUpcoming) {
          return res.status(400).json({ message: 'This match has already started.' });
      }
      if (!contest) {
          return res.status(404).json({ message: 'Contest not found.' });
      }
      if (!team) {
          return res.status(400).json({ message: 'Invalid team for this match.' });
      }
      if (contest.type !== 'TEAM_CONTEST') {
          return res.status(400).json({ message: 'This is not a team contest.' });
      }
      if (!contest.contestTemplateId) {
          return res.status(500).json({ message: 'Contest configuration is missing.' });
      }

      const { entryFee, maxTeamsPerUser, signupBonusAllowedPercentage, teamContestConfig, title: contestTitle } = contest.contestTemplateId;

      const totalSpotsInContest = teamContestConfig.teams * teamContestConfig.spotsPerTeam;
      const currentFilledSpots = await ContestParticipation.countDocuments({ contestId });
      if (currentFilledSpots >= totalSpotsInContest) {
          return res.status(400).json({ message: 'This contest is full.' });
      }
      
      const spotsOnSelectedTeam = await ContestParticipation.countDocuments({ contestId, contestTeam });
      if (spotsOnSelectedTeam >= teamContestConfig.spotsPerTeam) {
          return res.status(400).json({ message: `Team ${contestTeam} is already full.` });
      }

      const entryLimit = maxTeamsPerUser || 1;
      const existingParticipations = await ContestParticipation.find({ user: userId, contestId }).lean();
      
      if (existingParticipations.length > 0) {
          const lockedInTeam = existingParticipations[0].contestTeam;
          if (lockedInTeam !== contestTeam) {
              return res.status(400).json({ 
                  message: `You have already joined Team ${lockedInTeam} in this contest and cannot join the opposing team.` 
              });
          }
      }
      
      if (existingParticipations.length >= entryLimit) {
          return res.status(400).json({ message: `You have reached the entry limit of ${entryLimit} for this contest.` });
      }

      const isTeamAlreadyEntered = existingParticipations.some(p => p.teamId.toString() === teamId.toString());
      if (isTeamAlreadyEntered) {
          return res.status(400).json({ message: 'You have already joined this contest with this specific team.' });
      }
    
      let deductionDetails;
      let transactionId;
      try {
          const walletDeductionResponse = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/deduct`, {
              userId: userId,
              amount: entryFee,
              reason: `Team Contest Entry: ${contestTitle} (${contestId})`,
              signupBonusPercentage: signupBonusAllowedPercentage
          }, {
              headers: { 'Authorization': req.headers.authorization }
          });
          deductionDetails = walletDeductionResponse.data.deductionBreakdown;
          transactionId = walletDeductionResponse.data.transactionId; 
      } catch (walletError) {
          const status = walletError.response?.status || 500;
          const message = walletError.response?.data?.message || 'Error processing wallet transaction.';
          console.error(`Wallet service error (${status}): ${message}`);
          return res.status(status).json({ message });
      }
      
      try {
          await ContestParticipation.create({
              user: userId,
              matchId: matchId,
              contestId: contestId,
              teamId: teamId,
              contestTeam: contestTeam,
              deductionBreakdown: deductionDetails,
              transactionId: transactionId 
          });
          
          await Contest.findByIdAndUpdate(contestId, { $inc: { filledSpots: 1 } });

          // --- ✅ NEW BLOCK ADDED ---
          // Notify the Offer Service after successfully joining the contest
          try {
            const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
            console.log("tag here======>2",{ userId, matchId, contestId });
            await axios.post(`${OFFER_SERVICE_URL}/api/offerRoutes/track-progress`, 
              {
                userId: userId,
                matchId: matchId,
                contestId: contestId
              },
              {
                headers: { 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` }
              }
            );
            console.log(`[Contest Service] Successfully notified Offer Service for user ${userId} in match ${matchId}`);
          } catch (offerError) {
              console.error(`[Non-blocking error] Failed to track offer progress for user ${userId} in match ${matchId}:`, offerError.message);
          }
          // --- END OF NEW BLOCK ---

          return res.status(201).json({ message: `Successfully joined Team ${contestTeam}!` });

      } catch (dbError) {
          console.error('CRITICAL: DB save failed after wallet deduction. Initiating refund.', dbError);
          try {
              await axios.post(`${WALLET_SERVICE_URL}/api/wallet/refund`, {
                  transactionId: transactionId,
                  reason: `Automatic refund: Failed to join contest ${contestId}`
              }, {
                  headers: { 'Authorization': req.headers.authorization }
              });
          } catch (refundError) {
              console.error(`CRITICAL FAILURE: Automatic refund for transaction ${transactionId} FAILED.`, refundError.message);
          }
          if (dbError.code === 11000) {
              return res.status(400).json({ message: 'You have already joined with this specific team. Your entry fee has been refunded.' });
          }
          return res.status(500).json({ message: 'Could not join contest due to a database error. Your entry fee has been refunded.' });
      }
  } catch (err) {
      console.error('An unexpected error occurred in joinTeamContest:', err);
      return res.status(500).json({ message: 'An internal server error occurred. Please try again later.' });
  }
};

exports.deleteTeam = async (req, res) => {
  // 1. Get the team ID from the URL parameters and the user ID from the authenticated token.
  const { teamId } = req.params;
  const userId = req.user._id.toString();

  if (!teamId) {
      return res.status(400).json({ message: 'Team ID is required.' });
  }

  try {
      // 2. Find the team by its ID.
      const team = await Team.findById(teamId);

      // --- Validation Checks ---

      // Check if the team actually exists.
      if (!team) {
          return res.status(404).json({ message: 'Team not found.' });
      }

      // SECURITY: Check if the logged-in user is the owner of the team.
      if (team.user.toString() !== userId) {
          return res.status(403).json({ message: 'Forbidden: You can only delete your own teams.' });
      }

      // CRITICAL: Check if this team is part of any contest participations.
      // We use .exists() because it's the most efficient way to check for at least one document.
      const isTeamInContest = await ContestParticipation.exists({ teamId: teamId });
      if (isTeamInContest) {
          return res.status(400).json({ message: 'Cannot delete team. It has been entered into one or more contests.' });
      }

      // --- Perform Deletion ---
      // If all checks pass, it is safe to delete the team.
      await Team.findByIdAndDelete(teamId);

      return res.status(200).json({ message: 'Team deleted successfully.' });

  } catch (err) {
      console.error('Error in deleteTeam:', err);
      return res.status(500).json({ message: 'An internal server error occurred.' });
  }
};

// In your Contest Service's contestController.js

/**
 * [INTERNAL] For backfilling data. Gets all contest IDs a user participated in for a specific match.
 */
exports.getParticipationsForBackfill = async (req, res) => {
  const { userId, matchId } = req.query;

  if (!userId || !matchId) {
      return res.status(400).json({ message: 'userId and matchId are required query parameters.' });
  }

  try {
      // 👇 --- THIS IS THE CORRECTED QUERY ---
      // We convert the userId string into a MongoDB ObjectId before searching.
      const participations = await ContestParticipation.find({
          user: new mongoose.Types.ObjectId(userId), 
          matchId: matchId
      }).select('contestId -_id').lean();

      const contestIds = participations.map(p => p.contestId.toString());

      res.status(200).json({ contestIds });

  } catch (error) {
      console.error('Error in getParticipationsForBackfill:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * [INTERNAL] For backfilling. Gets all unique user IDs who participated in a specific match.
 */
exports.getUniqueParticipantsByMatch = async (req, res) => {
  const { matchId } = req.params;

  // Log 1: Confirm the function is hit and we have the correct matchId
  console.log(`--- [getUniqueParticipantsByMatch] Looking for participants in match: ${matchId} ---`);

  try {
      const query = { matchId: matchId };

      // Log 2: Show the exact query being sent to MongoDB
      console.log('Executing DB query with:', query);

      // This is the database query we need to inspect
      const userIds = await ContestParticipation.find({ matchId: matchId });

      // Log 3: Show exactly what the database returned
      console.log(`Query found ${userIds.length} unique users.`);
      console.log('User IDs found:', userIds);

      res.status(200).json({ userIds });
  } catch (error) {
      console.error('Error in getUniqueParticipantsByMatch:', error);
      res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getContestsForChatCleanup = async (req, res) => {
  try {
      const contests = await Contest.find({
          status: 'completed',
          chatDeleted: { $ne: true }
      }).select('_id').lean(); // .lean() for performance

      res.json(contests);
  } catch (error) {
      console.error('Error fetching contests for chat cleanup:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.markContestsChatDeleted = async (req, res) => {
  try {
      const { contestIds } = req.body;

      if (!Array.isArray(contestIds) || contestIds.length === 0) {
          return res.status(400).json({ message: 'contestIds must be a non-empty array.' });
      }

      const result = await Contest.updateMany(
          { _id: { $in: contestIds } },
          { $set: { chatDeleted: true } }
      );

      res.json({
          message: 'Contests successfully marked as chat-deleted.',
          modifiedCount: result.nModified,
      });

  } catch (error) {
      console.error('Error marking contests as chat-deleted:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getContestsByIds = async (req, res) => {
  try {
      const { contestIds } = req.body;

      if (!Array.isArray(contestIds) || contestIds.length === 0) {
          return res.status(400).json({ message: 'contestIds must be a non-empty array.' });
      }

      const contests = await Contest.find({ '_id': { $in: contestIds } }).lean();

      res.json(contests);
  } catch (error) {
      console.error('Error fetching contests by IDs:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
};
