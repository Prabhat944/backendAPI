const cricketDataService = require('../services/cricketService');
const ContestParticipation = require('../models/ContestParticipation');
const Team = require('../models/TeamSchema');
// const Contest = require('../models/ContestSchema');

const getCountdown = require('../utils/countDown');


exports.upcomingMatches = async (req, res) => {
  try {
    const matches = await cricketDataService.upcomingMatchesList();
    const updatedMatches = matches.map(match => {
      const matchTime = match.dateTimeGMT || match.start_time;
      return {
        ...match,
        countdown: getCountdown(matchTime, 'future')
      };
    });

    res.json(updatedMatches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching matches', error: err.message });
  }
};

exports.getRecentMatches = async (req, res) => {
  try {
    const matches = await cricketDataService.recentMatchesList();
    res.json(matches);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching matches', error: err.message });
  }
};


exports.getMyMatches = async (req, res) => {
  try {
    const userId = req.user._id;

    const participations = await ContestParticipation.find({ user: userId }).select('matchId contestId');
    const matchIds = participations.map(p => p.matchId?.toString().trim());

    if (matchIds.length === 0) {
      return res.json({
        upcoming: [],
        live: [],
        completed: []
      });
    }

    // Fetch all contests joined by user, grouped by matchId
    const contestsByMatch = {};
    participations.forEach(p => {
      const mid = p.matchId.toString();
      if (!contestsByMatch[mid]) contestsByMatch[mid] = [];
      contestsByMatch[mid].push(p.contestId);
    });

    // Fetch all teams created by user
    const userTeams = await Team.find({ user: userId, matchId: { $in: matchIds } }).select('matchId');
    const teamsCountByMatch = {};
    userTeams.forEach(t => {
      const mid = t.matchId.toString();
      teamsCountByMatch[mid] = (teamsCountByMatch[mid] || 0) + 1;
    });

    // Fetch match data
    const [recentMatchesResponse, upcomingMatchesResponse] = await Promise.all([
      cricketDataService.recentMatchesList(),
      cricketDataService.upcomingMatchesList()
    ]);
    const recentMatches = recentMatchesResponse.data;
    const upcomingMatches = upcomingMatchesResponse;

    const allMatches = [...recentMatches, ...upcomingMatches];

    const joinedMatches = allMatches.filter(
      m => matchIds.includes((m.match_id?.toString() || m.id?.toString())?.trim())
    );

    const upcoming = [];
    const live = [];
    const completed = [];

    joinedMatches.forEach(match => {
      const matchId = (match.match_id?.toString() || match.id?.toString())?.trim();
      const isMatchStarted = match.matchStarted;
      const isMatchEnded = match.matchEnded;
      const matchTime = match.dateTimeGMT || match.start_time;

      const matchData = {
        ...match,
        countdown: !isMatchStarted ? getCountdown(matchTime, 'future') : undefined,
        ago: isMatchEnded ? getCountdown(matchTime, 'past') : undefined,
        userTeamsCount: teamsCountByMatch[matchId] || 0,
        userContestsJoined: contestsByMatch[matchId] || []
      };

      if (!isMatchStarted) {
        upcoming.push(matchData);
      } else if (isMatchStarted && !isMatchEnded) {
        live.push(matchData);
      } else if (isMatchEnded) {
        completed.push(matchData);
      }
    });

    res.json({
      upcoming,
      live,
      completed
    });

  } catch (err) {
    res.status(500).json({ message: 'Error fetching user matches', error: err.message });
  }
};


exports.getMatchDetails = async (req, res) => {
  try {
    const { matchId } = req.params;
    const data = await cricketDataService.getMatchById(matchId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching match details', error: err.message });
  }
};