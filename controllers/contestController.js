const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest');
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');
const UserMatch = require('../models/UserMatchStore');
const { getMatchById, cricketDataService } = require('../services/cricketService'); // Assuming cricketDataService is also in this service file

exports.joinContest = async (req, res) => {
  const userId = req.user._id;
  // --- CHANGED: Added contestTemplateId ---
  const { matchId, contestId, teamId, contestTemplateId } = req.body;

  // --- CHANGED: Updated validation ---
  if (!matchId || !contestId || !teamId || !contestTemplateId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId, contestTemplateId' });
  }

  try {
    const [contest, team] = await Promise.all([
      Contest.findById(contestId),
      Team.findOne({ _id: teamId, user: userId, matchId })
    ]);

    if (!contest) return res.status(404).json({ message: 'Contest not found' });
    if (!team) return res.status(400).json({ message: 'Invalid team for the match' });

    if (contest.filledSpots >= contest.totalSpots) {
      return res.status(400).json({ message: 'Contest is full' });
    }

    const alreadyJoined = await ContestParticipation.exists({ user: userId, contestId });
    if (alreadyJoined) {
      return res.status(400).json({ message: 'Already joined this contest' });
    }

    const userMatchExists = await UserMatch.findOne({ user: userId, matchId });

    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId);
      if (matchInfo) {
        await UserMatch.create({
          user: userId,
          matchId,
          matchInfo,
          status: matchInfo?.matchStarted ? (matchInfo?.matchEnded ? 'completed' : 'live') : 'upcoming'
        });
      }
    }

    contest.participants.push(userId);
    contest.filledSpots += 1;
    await contest.save();

    const participation = await ContestParticipation.create({
      user: userId,
      matchId,
      contestId,
      teamId
    });

    return res.status(201).json({ message: 'Successfully joined contest', participation });

  } catch (err) {
    console.error('Error in joinContest:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
  }
};

exports.joinMultipleContests = async (req, res) => {
  // --- CHANGED: Added contestTemplateId ---
  const { matchId, teamId, count, contestTemplateId } = req.body;
  const userId = req.user._id;

  // --- CHANGED: Updated validation ---
  // Note: We use contestTemplateId here instead of a single contestId
  if (!matchId || !teamId || !count || count < 1 || !contestTemplateId) {
    return res.status(400).json({ message: 'Required: matchId, teamId, valid count, and contestTemplateId' });
  }

  try {
    const team = await Team.findOne({ _id: teamId, user: userId, matchId });
    if (!team) return res.status(400).json({ message: 'Invalid team' });

    const userMatchExists = await UserMatch.findOne({ user: userId, matchId });
    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId);
      if (matchInfo) {
        await UserMatch.create({
          user: userId,
          matchId,
          matchInfo,
          status: matchInfo?.matchStarted ? (matchInfo?.matchEnded ? 'completed' : 'live') : 'upcoming'
        });
      }
    }

    let joinedCount = 0;

    // We need a base contest to clone from if necessary, so find one.
    const baseContestForCloning = await Contest.findOne({ contestTemplateId });
    if (!baseContestForCloning) {
        return res.status(404).json({ message: 'No contests found for this template.'});
    }

    while (joinedCount < count) {
      // --- CHANGED: Logic is now more robust using contestTemplateId ---
      const availableContest = await Contest.findOne({
        contestTemplateId: contestTemplateId, // Find contests from the same template
        matchId: matchId,
        filledSpots: { $lt: baseContestForCloning.totalSpots },
        participants: { $ne: userId } // Make sure user isn't in this specific one
      }).sort({ filledSpots: -1 });

      let targetContest = availableContest;

      if (!targetContest) {
        // Use the first contest of this type as the base for cloning
        targetContest = await cloneContest(baseContestForCloning);
      }

      // Check if user has already joined this specific contest instance with the given team
      const alreadyInThisInstance = await ContestParticipation.exists({ user: userId, contestId: targetContest._id, teamId });
      if(alreadyInThisInstance) {
        // If they are, we can't join this one, but we can try to find/clone another one.
        // For simplicity here, we'll skip. A more advanced implementation might try another find/clone.
        console.log(`User already in contest ${targetContest._id} with this team. Skipping.`);
        // To prevent an infinite loop if no other contests can be found/created, we break.
        if(!availableContest) break; 
        continue;
      }

      targetContest.participants.push(userId);
      targetContest.filledSpots += 1;
      await targetContest.save();

      await ContestParticipation.create({
        user: userId,
        matchId,
        contestId: targetContest._id,
        teamId
      });

      joinedCount++;
    }

    if (joinedCount < count) {
      return res.status(200).json({ message: `Successfully joined ${joinedCount} contest(s). Some could not be joined.` });
    }
    return res.status(200).json({ message: `Successfully joined ${joinedCount} contest(s)` });

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

    const contest = await Contest.findById(participation.contestId);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });

    // Assuming you have cricketDataService imported
    const matchData = await cricketDataService.getMatchById(participation.matchId);
    if (matchData?.matchStarted) {
      return res.status(400).json({ message: 'Cannot switch team after match starts' });
    }

    const newTeam = await Team.findOne({ _id: newTeamId, user: userId, matchId: participation.matchId });
    if (!newTeam) return res.status(400).json({ message: 'Invalid new team' });

    participation.teamId = newTeamId;
    await participation.save();

    return res.json({ message: 'Team switched successfully' });
  } catch (err) {
    console.error('Error in switchTeam:', err);
    return res.status(500).json({ message: 'Internal server error', error: err.message });
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
      .lean();

    return res.status(200).json(contests);

  } catch (error) {
    console.error('Error fetching contests by match ID:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};