const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest')
const Team = require('../models/TeamSchema');
const { cloneContest } = require('../utils/cloneContest');

exports.joinContest = async (req, res) => {
  const userId = req.user._id;
  const { matchId, contestId, teamId } = req.body;

  if (!matchId || !contestId || !teamId) {
    return res.status(400).json({ message: 'matchId, contestId, and teamId are required' });
  }

  try {
    // Validate contest
    const contest = await Contest.findById(contestId);
    if (!contest) return res.status(404).json({ message: 'Contest not found' });

    if (contest.filledSpots >= contest.totalSpots)
      return res.status(400).json({ message: 'Contest is already full.' });

    // Validate team
    const team = await Team.findOne({ _id: teamId, user: userId, matchId });
    if (!team) return res.status(400).json({ message: 'Invalid or missing team for this match.' });

    // Check if already joined
    const alreadyJoined = await ContestParticipation.findOne({
      user: userId,
      matchId,
      contestId
    });

    if (alreadyJoined) {
      return res.status(400).json({ message: 'You already joined this contest.' });
    }

    // Join
    contest.participants.push(userId);
    contest.filledSpots += 1;
    await contest.save();

    const participation = new ContestParticipation({
      user: userId,
      matchId,
      contestId,
      teamId
    });

    await participation.save();

    res.status(201).json({ message: 'Contest joined successfully with team.', participation });

  } catch (err) {
    res.status(500).json({ message: 'Error joining contest', error: err.message });
  }
};


exports.joinMultipleContests = async (req, res) => {
  const { matchId, contestId, teamIds } = req.body;
  const userId = req.user._id;

  // ✅ Validate input
  if (!matchId || !contestId || !teamIds || !Array.isArray(teamIds)) {
    return res.status(400).json({ message: 'matchId, contestId, and teamIds[] are required' });
  }

  if (teamIds.length === 0) {
    return res.status(400).json({ message: 'At least one teamId must be provided.' });
  }

  try {
    // ✅ Get base contest for cloning
    const baseContest = await Contest.findById(contestId);
    if (!baseContest) {
      return res.status(404).json({ message: 'Base contest not found' });
    }

    if (!baseContest.matchId) {
      return res.status(500).json({ message: 'Base contest is missing matchId' });
    }

    let joinedCount = 0;
    let failedTeams = [];

    for (let i = 0; i < teamIds.length; i++) {
      const teamId = teamIds[i];

      // ✅ Validate team for this user & match
      const team = await Team.findOne({ _id: teamId, user: userId, matchId });
      if (!team) {
        failedTeams.push(teamId);
        continue;
      }

      // ✅ Check if team already joined same contest (avoid duplicate)
      const existingParticipation = await ContestParticipation.findOne({
        user: userId,
        matchId,
        teamId,
        contestId: baseContest._id
      });

      if (existingParticipation) {
        failedTeams.push(teamId);
        continue;
      }

      // ✅ Find a contest slot with similar settings
      const availableContests = await Contest.find({
        matchId: baseContest.matchId,
        entryFee: baseContest.entryFee,
        totalSpots: baseContest.totalSpots,
        filledSpots: { $lt: baseContest.totalSpots },
        participants: { $ne: userId }
      }).sort({ filledSpots: -1 }); // prefer most-filled

      let joined = false;

      for (let contest of availableContests) {
        // Join available contest
        contest.participants.push(userId);
        contest.filledSpots += 1;
        await contest.save();

        await new ContestParticipation({
          user: userId,
          matchId,
          contestId: contest._id,
          teamId
        }).save();

        joinedCount++;
        joined = true;
        break;
      }

      if (!joined) {
        // Clone contest and join if no available contest found
        const newContest = await cloneContest(baseContest);

        newContest.participants.push(userId);
        newContest.filledSpots = 1;
        await newContest.save();

        await new ContestParticipation({
          user: userId,
          matchId,
          contestId: newContest._id,
          teamId
        }).save();

        joinedCount++;
      }
    }

    return res.status(200).json({
      message: `✅ Successfully joined ${joinedCount} contest(s).`,
      failedTeamIds: failedTeams
    });

  } catch (err) {
    console.error('❌ Error in joinMultipleContests:', err);
    res.status(500).json({ message: 'Error joining contests', error: err.message });
  }
};

exports.switchTeam = async (req, res) => {
  const userId = req.user._id;
  const { participationId, newTeamId } = req.body;

  try {
    const participation = await ContestParticipation.findOne({ _id: participationId, user: userId });
    if (!participation) return res.status(404).json({ message: 'Participation not found.' });

    const contest = await Contest.findById(participation.contestId);
    if (!contest) return res.status(404).json({ message: 'Contest not found.' });

    const matchData = await cricketDataService.getMatchById(participation.matchId);
    if (matchData.matchStarted) {
      return res.status(400).json({ message: 'Cannot switch team after match started.' });
    }

    const team = await Team.findOne({ _id: newTeamId, user: userId, matchId: participation.matchId });
    if (!team) return res.status(400).json({ message: 'Invalid new team.' });

    participation.teamId = newTeamId;
    await participation.save();

    res.json({ message: 'Team switched successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Error switching team', error: err.message });
  }
};
