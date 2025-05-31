const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest')
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');
const UserMatch = require('../models/UserMatchStore'); // Make sure you have this model
const { getMatchById } = require('../services/cricketService'); // You’ll need to implement this


exports.joinContest = async (req, res) => {
  const userId = req.user._id;
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'Required fields: matchId, contestId, teamId' });
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

    const alreadyJoined = await ContestParticipation.exists({ user: userId, matchId, contestId });
    if (alreadyJoined) {
      return res.status(400).json({ message: 'Already joined this contest' });
    }

    // 🟡 Save match info to UserMatch if not already saved
    const userMatchExists = await UserMatch.findOne({ user: userId, matchId });

    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId); // Implement this in your service
      if (matchInfo) {
        await UserMatch.create({
          user: userId,
          matchId,
          matchInfo,
          status: matchInfo?.matchStarted ? (matchInfo?.matchEnded ? 'completed' : 'live') : 'upcoming'
        });
      }
    }

    // Proceed with contest participation
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
  const { matchId, contestId, teamId, count } = req.body;
  const userId = req.user._id;

  if (!matchId || !contestId || !teamId || !count || count < 1) {
    return res.status(400).json({ message: 'Required: matchId, contestId, teamId, and valid count' });
  }

  try {
    const [baseContest, team] = await Promise.all([
      Contest.findById(contestId),
      Team.findOne({ _id: teamId, user: userId, matchId })
    ]);

    if (!baseContest) return res.status(404).json({ message: 'Base contest not found' });
    if (!team) return res.status(400).json({ message: 'Invalid team' });

    // 🟢 Create UserMatch if not exists
    const userMatchExists = await UserMatch.findOne({ user: userId, matchId });
    if (!userMatchExists) {
      const matchInfo = await getMatchById(matchId);
      console.log('check matchInfo here', matchInfo);
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

    while (joinedCount < count) {
      // Avoid duplicate first-time join
      if (joinedCount === 0) {
        const existing = await ContestParticipation.exists({
          user: userId,
          matchId,
          teamId,
          contestId: baseContest._id
        });
        if (existing) return res.status(400).json({ message: 'Already joined base contest with this team' });
      }

      // Find available similar contest
      const availableContest = await Contest.findOne({
        matchId: baseContest.matchId,
        entryFee: baseContest.entryFee,
        totalSpots: baseContest.totalSpots,
        filledSpots: { $lt: baseContest.totalSpots },
        participants: { $ne: userId }
      }).sort({ filledSpots: -1 });

      let targetContest = availableContest;

      // Clone if none found
      if (!targetContest) {
        targetContest = await cloneContest(baseContest);
      }

      // Join contest
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

