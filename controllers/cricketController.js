const cricketDataService = require('../services/cricketService');
const ContestParticipation = require('../models/ContestParticipation');
const Team = require('../models/TeamSchema');
const User = require('../models/userModel');
const getCountdown = require('../utils/countDown');
const UserMatch = require('../models/UserMatchStore');
const redisClient = require('../utils/redisClient'); // Assuming your client is exported from here
const SERIES_MATCHES_CACHE_TTL = 3600; // Cache TTL for matches within a series: 1 hour (in seconds)
const { calculateTeamPoints } = require('../utils/pointUpdate'); // <-- Import the new helper
const PlayerPerformance = require('../models/PlayerPerformanceSchema');
const upcomingMatchesList = require('../models/UpcomingMatches')
const recentMatchList = require('../models/RecentMatch'); // Import the new model
const squadList = require('../models/Squad');
const { formatInTimeZone } = require('date-fns-tz'); // <-- The new, reliable time zone library
const Contest = require('../models/Contest');
const ContestTemplate = require('../models/ContestTemplate');
const mongoose = require('mongoose');




exports.getUpcomingMatches = async (req, res) => {
  const REDIS_KEY = 'view:upcoming_matches'; // A new key for the final, combined view

  try {
    // Step 1: Check Redis first
    const cachedMatches = await redisClient.get(REDIS_KEY);
    if (cachedMatches) {
      console.log('[getUpcomingMatches] Cache HIT!');
      return res.status(200).json({
        source: 'cache',
        data: JSON.parse(cachedMatches)
      });
    }

    // Step 2: If cache misses, query the database
    console.log('[getUpcomingMatches] Cache MISS. Fetching from MongoDB.');
    const upcomingMatches = await upcomingMatchesList.find({
      dateTimeGMT: { $gt: new Date() }
    }).sort({ dateTimeGMT: 'asc' }).lean();

    // Step 3: Save the result to the cache for next time.
    // A short TTL of 5 minutes is good for a list that changes often.
    await redisClient.setEx(REDIS_KEY, 300, JSON.stringify(upcomingMatches));

    return res.status(200).json({
      source: 'database',
      data: upcomingMatches
    });

  } catch (error) {
    console.error('[getUpcomingMatches] Top-level error:', error);
    return res.status(500).json({ message: 'Failed to fetch upcoming matches' });
  }
};

exports.getRecentMatches = async (req, res) => {
  const REDIS_KEY = 'view:recent_matches';

  try {
    // 1. Check Redis first
    const cachedMatches = await redisClient.get(REDIS_KEY);
    if (cachedMatches) {
      console.log('[getRecentMatches] Cache HIT!');
      return res.status(200).json({
        source: 'cache',
        data: JSON.parse(cachedMatches)
      });
    }

    // 2. If cache misses, query MongoDB
    console.log('[getRecentMatches] Cache MISS. Fetching from MongoDB.');
    // We sort by date in descending order to show the most recent matches first.
    const recentMatches = await recentMatchList.find({}).sort({ dateTimeGMT: 'desc' }).lean();

    // 3. Save to Redis with a short TTL (Time-To-Live) because scores change fast.
    await redisClient.setEx(REDIS_KEY, 60, JSON.stringify(recentMatches)); // Cache for 60 seconds

    return res.status(200).json({
      source: 'database',
      data: recentMatches
    });

  } catch (error) {
    console.error('[getRecentMatches] Top-level error:', error);
    return res.status(500).json({ message: 'Failed to fetch recent matches' });
  }
};

/**
 * This is the final, production-ready controller to get all matches for a logged-in user,
 * complete with all data enrichment and business logic.
 */
/**
 * This is the final, production-ready controller to get all matches for a logged-in user,
 * complete with all data enrichment and business logic.
 */
const generatePrizeBreakdown = (contestTemplate) => {
  if (!contestTemplate) return [];
  const { prizeBreakupType, prizeDistribution, prize } = contestTemplate;
  switch (prizeBreakupType) {
    case 'winnerTakesAll':
      return [{ rank: 1, prize: prize || 0 }];
    case 'fixedAmountSplit':
      return (prizeDistribution || []).map(dist => ({ rank: dist.rank, prize: dist.amount }));
    case 'percentageSplit':
      return (prizeDistribution || []).map(dist => ({ rank: dist.rank, prize: parseFloat(((dist.percentage / 100) * (prize || 0)).toFixed(2)) }));
    default:
      return [];
  }
};

const enrichTeam = (team, matchPerformances, matchPlayerDetails) => {
  let totalPoints = 0;
  const enrichedPlayers = team.players.map(playerId => {
    const playerStrId = playerId?.toString();
    const details = matchPlayerDetails.get(playerStrId) || { name: 'Unknown Player', playerImg: '' };
    const performance = matchPerformances[playerStrId] || { points: 0 };
    let currentPoints = parseFloat(performance.points || 0);
    let role = null;
    if (team.captain?.toString() === playerStrId) { currentPoints *= 2; role = 'Captain'; }
    if (team.viceCaptain?.toString() === playerStrId) { currentPoints *= 1.5; role = 'Vice-Captain'; }
    totalPoints += currentPoints;
    return { playerId, name: details.name, playerImg: details.playerImg, role, points: parseFloat(currentPoints.toFixed(2)), basePoints: parseFloat(performance.points || 0) };
  });
  return { ...team, players: enrichedPlayers, totalPoints: parseFloat(totalPoints.toFixed(2)), teamName: team.teamName || '' };
};

exports.getMyMatches = async (req, res) => {
  try {
    const userId = req.user?._id;

    // --- (Data fetching and map creation logic is unchanged) ---
    const participations = await ContestParticipation.find({ user: userId }).lean();
    if (!participations || participations.length === 0) {
      return res.json({ upcoming: [], live: [], completed: [] });
    }
    const matchIds = [...new Set(participations.map(p => p.matchId?.toString().trim()).filter(Boolean))];
    const userContestIds = [...new Set(participations.map(p => p.contestId?.toString()).filter(Boolean))];
    const allContests = await Contest.find({ _id: { $in: userContestIds } }).lean();
    const templateIds = [...new Set(allContests.map(c => c.contestTemplateId?.toString()).filter(Boolean))];
    const [
      allParticipationsInContests, allPlayerPerformances, upcomingMatchDetails, recentMatchDetails, allSquads, allContestTemplates
    ] = await Promise.all([
      ContestParticipation.find({ contestId: { $in: userContestIds } }).populate('user', 'name').lean(),
      PlayerPerformance.find({ matchId: { $in: matchIds } }).lean(),
      upcomingMatchesList.find({ _id: { $in: matchIds } }).lean(),
      recentMatchList.find({ _id: { $in: matchIds } }).lean(),
      squadList.find({ _id: { $in: matchIds } }).lean(),
      ContestTemplate.find({ _id: { $in: templateIds } }).lean()
    ]);
    const allTeamIds = [...new Set(allParticipationsInContests.map(p => p.teamId?.toString()).filter(Boolean))];
    const allTeams = await Team.find({ _id: { $in: allTeamIds } }).lean();
    const teamsById = new Map(allTeams.map(t => [t._id.toString(), t]));
    const contestDetailsMap = new Map(allContests.map(c => [c._id.toString(), c]));
    const contestTemplatesMap = new Map(allContestTemplates.map(ct => [ct._id.toString(), ct]));
    const performancesByMatch = allPlayerPerformances.reduce((acc, p) => {
        const mid = p.matchId?.toString();
        if(mid) { if (!acc[mid]) acc[mid] = {}; acc[mid][p.playerId.toString()] = p; }
        return acc;
    }, {});
    const matchDetailsMap = new Map();
    upcomingMatchDetails.forEach(m => matchDetailsMap.set(m._id.toString(), m));
    recentMatchDetails.forEach(m => matchDetailsMap.set(m._id.toString(), m));
    const playerDetailsMap = allSquads.reduce((acc, squadDoc) => {
        const matchId = squadDoc._id.toString();
        const innerPlayerMap = new Map(squadDoc.squad.flatMap(team => team.players).map(player => [player.id, player]));
        acc.set(matchId, innerPlayerMap);
        return acc;
    }, new Map());

    const categorizedMatches = { upcoming: [], live: [], completed: [] };

    for (const mid of matchIds) {
      const matchDetails = matchDetailsMap.get(mid);
      if (!matchDetails) continue;
      
      if (matchDetails.matchStarted && !matchDetails.matchEnded && matchDetails.teams && matchDetails.score && matchDetails.score.length < matchDetails.teams.length) {
        const teamsWithScores = matchDetails.score.map(s => s.inning.split(' Inning')[0].trim());
        const teamWithoutScore = matchDetails.teams.find(teamName => !teamsWithScores.includes(teamName));
        if (teamWithoutScore) {
            matchDetails.score.push({ r: 0, w: 0, o: 0, inning: `${teamWithoutScore} Inning 1` });
        }
      }

      const participantsForThisMatch = allParticipationsInContests.filter(p => p.matchId?.toString() === mid);

      let allEnrichedTeams = [];
      participantsForThisMatch.forEach(p => {
        const team = teamsById.get(p.teamId?.toString());
        if (team) {
          allEnrichedTeams.push({ ...enrichTeam(team, performancesByMatch[mid] || {}, playerDetailsMap.get(mid) || new Map()), user: p.user, contestId: p.contestId });
        }
      });

      // ✅ --- START OF CORRECTED LOGIC ---
      // 1. Calculate ranks first for all teams
      const finalRanksByContest = new Map();
      if (matchDetails.matchStarted) {
        const contestIdsInMatch = [...new Set(participantsForThisMatch.map(p => p.contestId.toString()))];
        for (const contestId of contestIdsInMatch) {
          const contestParticipants = allEnrichedTeams.filter(team => team.contestId.toString() === contestId);
          contestParticipants.sort((a, b) => b.totalPoints - a.totalPoints);
          const userRankMap = new Map();
          let rank = 1;
          for (let i = 0; i < contestParticipants.length; i++) {
            if (i > 0 && contestParticipants[i].totalPoints < contestParticipants[i - 1].totalPoints) {
              rank = i + 1;
            }
            userRankMap.set(contestParticipants[i]._id.toString(), rank);
          }
          finalRanksByContest.set(contestId, userRankMap);
        }
      }
      
      // 2. Now, create a final list of teams that includes their rank and prize won
      const allFullyEnrichedTeams = allEnrichedTeams.map(team => {
        const rank = finalRanksByContest.get(team.contestId.toString())?.get(team._id.toString()) || team.rank || null;
        const contest = contestDetailsMap.get(team.contestId.toString());
        const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;
        const prizeBreakdown = generatePrizeBreakdown(contestTemplate);

        let isWinner = false;
        let prizeWon = 0;

        if (matchDetails.matchEnded && rank) {
            const tiedPlayers = allEnrichedTeams.filter(t => t.contestId.toString() === team.contestId.toString() && finalRanksByContest.get(t.contestId.toString())?.get(t._id.toString()) === rank);
            const tieCount = tiedPlayers.length;

            if (tieCount > 1) { // Tie detected
                const occupiedRanks = Array.from({ length: tieCount }, (_, i) => rank + i);
                const totalTiedPrize = prizeBreakdown.filter(b => occupiedRanks.includes(b.rank)).reduce((sum, b) => sum + b.prize, 0);
                prizeWon = parseFloat((totalTiedPrize / tieCount).toFixed(2));
            } else { // No tie
                const winningRank = prizeBreakdown.find(b => b.rank === rank);
                if (winningRank) prizeWon = winningRank.prize;
            }
            isWinner = prizeWon > 0;
        }

        return { ...team, rank, isWinner, prizeWon };
      });
      // ✅ --- END OF CORRECTED LOGIC ---

      // 3. Build the response from the final, fully-enriched data
      const userTeamsMap = new Map();
      allFullyEnrichedTeams.filter(t => t.user?._id?.toString() === userId.toString()).forEach(team => {
          if (!userTeamsMap.has(team._id.toString())) userTeamsMap.set(team._id.toString(), team);
      });
      const userTeams = Array.from(userTeamsMap.values());
      
      const opponentTeamsMap = new Map();
      allFullyEnrichedTeams.filter(t => t.user?._id?.toString() !== userId.toString()).forEach(team => {
          if (!opponentTeamsMap.has(team._id.toString())) opponentTeamsMap.set(team._id.toString(), team);
      });
      const opponentTeams = Array.from(opponentTeamsMap.values());

      const userContestDetails = participantsForThisMatch
        .filter(p => p.user?._id?.toString() === userId.toString())
        .map(p => {
          const contest = contestDetailsMap.get(p.contestId.toString());
          if (contest?.status === 'cancelled') {
            return {
              _id: p._id,
              contestId: p.contestId,
              status: 'cancelled',
              teamName: teamsById.get(p.teamId?.toString())?.teamName || '',
              entryFee: contest?.entryFee || 0
            };
          }

          const enrichedTeamData = new Map(allFullyEnrichedTeams.map(t => [t._id.toString(), t])).get(p.teamId.toString());
          const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;

          return {
            ...p,
            totalPoints: enrichedTeamData?.totalPoints || p.totalPoints,
            rank: enrichedTeamData?.rank || p.rank,
            isWinner: enrichedTeamData?.isWinner || false,
            prizeWon: enrichedTeamData?.prizeWon || 0,
            contestPrize: contestTemplate?.prize || 0,
            contestType: contestTemplate?.type || '',
            entryFee: contestTemplate?.entryFee || 0,
            totalSpots: contestTemplate?.totalSpots || 0,
            prizeBreakdown: generatePrizeBreakdown(contestTemplate),
            teamName: teamsById.get(p.teamId?.toString())?.teamName || ''
          };
        });

      if (userContestDetails.length === 0) continue;

      const matchMeta = {
        ...matchDetails,
        userTeamsCount: userTeams.length,
        userContestDetails,
        userTeams,
        opponentTeams,
        displayTimeIST: formatInTimeZone(new Date(matchDetails.dateTimeGMT), 'Asia/Kolkata', 'h:mm a'),
        countdown: getCountdown(new Date(matchDetails.dateTimeGMT)),
      };

      if (matchDetails.matchEnded) {
        categorizedMatches.completed.push(matchMeta);
      } else if (matchDetails.matchStarted) {
        categorizedMatches.live.push(matchMeta);
      } else {
        categorizedMatches.upcoming.push(matchMeta);
      }
    }

    categorizedMatches.upcoming.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
    categorizedMatches.live.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
    categorizedMatches.completed.sort((a, b) => new Date(b.dateTimeGMT) - new Date(a.dateTimeGMT));

    return res.json(categorizedMatches);
  } catch (error) {
    console.error('[getMyMatches] Error:', error.message, error.stack);
    return res.status(500).json({ message: 'Failed to fetch user matches', error: error.message });
  }
};

/**
 * @desc Get detailed match information
 */
exports.getMatchDetails = async (req, res) => {
  try {
    const { matchId } = req.params;
    const matchDetails = await cricketDataService.getMatchById(matchId);

    return res.json(matchDetails);
  } catch (error) {
    console.error('[getMatchDetails]', error);
    return res.status(500).json({ message: 'Failed to fetch match details', error: error.message });
  }
};


exports.getUserContestsForMatch = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { matchId } = req.params;

    if (!matchId || !userId) {
      return res.status(400).json({ message: 'Match ID and User ID are required.' });
    }

    const matchDetails = await upcomingMatchesList.findById(matchId).lean() || await recentMatchList.findById(matchId).lean();

    if (!matchDetails) {
        return res.status(404).json({ message: 'Match not found.' });
    }

    const userParticipationStubs = await ContestParticipation.find({
      user: userId,
      matchId: matchId
    }).lean();

    if (userParticipationStubs.length === 0) {
      return res.json({
        countdown: getCountdown(matchDetails.dateTimeGMT),
        displayTimeIST: formatToIST(matchDetails.dateTimeGMT),
        count: 0,
        participations: [],
      });
    }

    const contestIds = userParticipationStubs.map(p => p.contestId);

    const [
        allContestDetails,
        allParticipationsInContests
    ] = await Promise.all([
        Contest.find({ _id: { $in: contestIds } })
          .select('title entryFee totalSpots prize filledSpots prizeBreakupType prizeDistribution')
          .lean(),
        ContestParticipation.find({ contestId: { $in: contestIds } })
          .populate({ path: 'user', select: 'name' })
          .populate({ path: 'teamId', select: 'teamName' })
          .lean()
    ]);
    
    const contestsById = new Map(allContestDetails.map(c => [c._id.toString(), c]));
    
    const participationsByContest = allParticipationsInContests.reduce((acc, p) => {
        const contestIdStr = p.contestId.toString();
        if (!acc[contestIdStr]) {
            acc[contestIdStr] = [];
        }
        acc[contestIdStr].push(p);
        return acc;
    }, {});

    const enrichedParticipations = userParticipationStubs.map(userP => {
      const contestIdStr = userP.contestId.toString();
      const allParticipants = participationsByContest[contestIdStr] || [];
      const contestDetails = contestsById.get(contestIdStr) || {};

      if(contestDetails) {
        contestDetails.prizeBreakdown = generatePrizeBreakdown(contestDetails);
      }

      let userTeam = {};
      const opponentTeams = [];

      allParticipants.forEach(participant => {
        if (participant.user?._id.toString() === userId.toString()) {
          // --- *** THIS IS THE FIX: Structuring userTeam to be consistent with opponentTeams *** ---
          userTeam = {
            userName: participant.user?.name || 'You',
            teamName: participant.teamId?.teamName || 'Unnamed Team',
          };
        } else {
          opponentTeams.push({
            userName: participant.user?.name || 'Opponent',
            teamName: participant.teamId?.teamName || 'Unnamed Team',
          });
        }
      });

      return {
        _id: userP._id,
        teamId: userP.teamId,
        totalPoints: userP.totalPoints,
        rank: userP.rank,
        isWinner: userP.isWinner,
        prizeWon: userP.prizeWon,
        contestDetails: contestDetails,
        userTeam: userTeam,
        opponentTeams: opponentTeams,
      };
    });

    res.json({
      countdown: getCountdown(matchDetails.dateTimeGMT),
      displayTimeIST: formatToIST(matchDetails.dateTimeGMT),
      count: enrichedParticipations.length,
      participations: enrichedParticipations,
    });

  } catch (error) {
    console.error('[getUserContestsForMatch] Error:', error);
    res.status(500).json({ message: 'Failed to fetch user contest data for the match', error: error.message });
  }
};

function formatToIST(utcDateString) {
  if (!utcDateString) return null;

  try {
    const date = new Date(utcDateString.endsWith('Z') ? utcDateString : utcDateString + 'Z');
    
    const options = {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
      timeZoneName: 'short'
    };

    return date.toLocaleString('en-IN', options);
  } catch (error) {
    console.error(`Could not format date to IST: ${utcDateString}`, error);
    return null;
  }
}

// If you put this in the same file as getCountdown, you can export both:
// module.exports = { getCountdown, formatToIST };