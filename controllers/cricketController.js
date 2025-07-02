const cricketDataService = require('../services/cricketService');
const ContestParticipation = require('../models/ContestParticipation');
const Team = require('../models/TeamSchema');
const User = require('../models/userModel');
const getCountdown = require('../utils/countDown');
const UserMatch = require('../models/UserMatchStore');
const redisClient = require('../utils/redisClient'); // Assuming your client is exported from here
const SERIES_MATCHES_CACHE_TTL = 3600; // Cache TTL for matches within a series: 1 hour (in seconds)
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
    if (!userId) {
        return res.status(401).json({ message: 'User not authenticated.' });
    }

    const participations = await ContestParticipation.find({ user: userId }).lean();
    if (!participations || participations.length === 0) {
      return res.json({ upcoming: [], live: [], completed: [], cancelled: [] });
    }

    const matchIds = [...new Set(participations.map(p => p.matchId?.toString().trim()).filter(Boolean))];
    const userContestIds = [...new Set(participations.map(p => p.contestId?.toString()).filter(Boolean))];

    const allContests = await Contest.find({ _id: { $in: userContestIds } }).lean();
    const templateIds = [...new Set(allContests.map(c => c.contestTemplateId?.toString()).filter(Boolean))];

    const [
      allParticipationsInContests,
      allPlayerPerformances,
      upcomingMatchDetails,
      recentMatchDetails,
      allSquads,
      allContestTemplates
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

    const categorizedMatches = { upcoming: [], live: [], completed: [], cancelled: [] };

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

      // --- CRITICAL CHANGE START: allEnrichedTeams no longer carries rank/prizeWon ---
      // This array will be the source for general 'userTeams' and 'opponentTeams'
      // It includes base points, players, and match-level total points.
      let allEnrichedTeams = [];
      participantsForThisMatch.forEach(p => {
        const team = teamsById.get(p.teamId?.toString());
        if (team) {
          // Note: isWinner, prizeWon, rank are NOT added here.
          allEnrichedTeams.push({ ...enrichTeam(team, performancesByMatch[mid] || {}, playerDetailsMap.get(mid) || new Map()), user: p.user, contestId: p.contestId });
        }
      });

      // Populate userTeams and opponentTeams for the match overview (unique teams)
      // These will NOT have contest-specific rank/isWinner/prizeWon attached
      const userTeamsMapForOverview = new Map();
      allEnrichedTeams.filter(t => t.user?._id?.toString() === userId.toString()).forEach(team => {
          if (!userTeamsMapForOverview.has(team._id.toString())) {
              userTeamsMapForOverview.set(team._id.toString(), team);
          }
      });
      const userTeams = Array.from(userTeamsMapForOverview.values());
      
      const opponentTeamsMapForOverview = new Map();
      allEnrichedTeams.filter(t => t.user?._id?.toString() !== userId.toString()).forEach(team => {
          if (!opponentTeamsMapForOverview.has(team._id.toString())) {
              opponentTeamsMapForOverview.set(team._id.toString(), team);
          }
      });
      const opponentTeams = Array.from(opponentTeamsMapForOverview.values());
      // --- CRITICAL CHANGE END ---


      // --- Calculate Ranks (this part remains largely the same, but for all teams) ---
      const finalRanksByContest = new Map(); // Maps contestId -> (Map: teamId -> rank)
      if (matchDetails.matchStarted) {
        const contestIdsInMatch = [...new Set(participantsForThisMatch.map(p => p.contestId.toString()))];
        for (const contestId of contestIdsInMatch) {
          // Use allEnrichedTeams for sorting as it has totalPoints
          const contestParticipants = allEnrichedTeams.filter(team => team.contestId.toString() === contestId);
          contestParticipants.sort((a, b) => b.totalPoints - a.totalPoints);
          
          const teamRankMap = new Map(); // Map to store teamId to rank for this specific contest
          let currentRank = 1;
          for (let i = 0; i < contestParticipants.length; i++) {
            if (i > 0 && contestParticipants[i].totalPoints < contestParticipants[i - 1].totalPoints) {
              currentRank = i + 1;
            }
            teamRankMap.set(contestParticipants[i]._id.toString(), currentRank);
          }
          finalRanksByContest.set(contestId, teamRankMap);
        }
      }
      
      // --- Create allFullyEnrichedTeams (now with contest-specific rank/isWinner/prizeWon) ---
      // This array will be the source for contest-specific leaderboards.
      const allFullyEnrichedTeams = allEnrichedTeams.map(team => {
        const contest = contestDetailsMap.get(team.contestId.toString());
        const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;
        const prizeBreakdown = generatePrizeBreakdown(contestTemplate);

        let teamRank = finalRanksByContest.get(team.contestId.toString())?.get(team._id.toString()) || team.rank || null;
        let isWinner = false;
        let prizeWon = 0;

        if (matchDetails.matchEnded && teamRank !== null) {
            // Find other teams in the SAME contest with the SAME rank for tie-breaking prize logic
            const tiedPlayers = allEnrichedTeams.filter( // Use allEnrichedTeams here to get all participants for tie check
                t => t.contestId.toString() === team.contestId.toString() &&
                     (finalRanksByContest.get(t.contestId.toString())?.get(t._id.toString()) === teamRank)
            );
            const tieCount = tiedPlayers.length;

            if (tieCount > 1) {
                const occupiedRanks = Array.from({ length: tieCount }, (_, i) => teamRank + i);
                const totalTiedPrize = prizeBreakdown.filter(b => occupiedRanks.includes(b.rank)).reduce((sum, b) => sum + b.prize, 0);
                prizeWon = parseFloat((totalTiedPrize / tieCount).toFixed(2));
            } else {
                const winningRank = prizeBreakdown.find(b => b.rank === teamRank);
                if (winningRank) prizeWon = winningRank.prize;
            }
            isWinner = prizeWon > 0;
        }

        return { ...team, rank: teamRank, isWinner, prizeWon }; // Add calculated rank and prize
      });


      // --- NEW: Populate contestLeaderboards for drill-down view ---
      const contestLeaderboards = new Map(); // Map: contestId -> Array of ALL teams (user's and opponents') for that contest
      const contestIdsInMatch = [...new Set(participantsForThisMatch.map(p => p.contestId.toString()))];
      for (const contestId of contestIdsInMatch) {
          const teamsForThisContest = allFullyEnrichedTeams
              .filter(team => team.contestId.toString() === contestId)
              .sort((a, b) => a.rank - b.rank); // Sort by rank for display
          contestLeaderboards.set(contestId, teamsForThisContest);
      }
      // --- END NEW ---


      // `userContestDetails` remains the primary source for the user's specific contest entries
      // It is already correctly picking up the `isWinner`, `prizeWon`, and `rank` from `allFullyEnrichedTeams`
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

          const enrichedTeamDataForThisContest = allFullyEnrichedTeams.find(
            t => t._id.toString() === p.teamId.toString() && t.contestId.toString() === p.contestId.toString()
          );

          const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;

          return {
            ...p, // Original participation data
            // Override with calculated/enriched data relevant to this specific contest participation
            totalPoints: enrichedTeamDataForThisContest?.totalPoints || p.totalPoints,
            rank: enrichedTeamDataForThisContest?.rank || p.rank,
            isWinner: enrichedTeamDataForThisContest?.isWinner || false,
            prizeWon: enrichedTeamDataForThisContest?.prizeWon || 0,
            
            // Contest-specific details
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
        userTeamsCount: userTeams.length, // Count of unique user teams for the match
        userContestDetails,
        userTeams,        // Unique user teams for this match (no contest-specific rank/prize)
        opponentTeams,    // Unique opponent teams for this match (no contest-specific rank/prize)
        contestLeaderboards: Object.fromEntries(contestLeaderboards), // Full leaderboard per contestId
        displayTimeIST: formatInTimeZone(new Date(matchDetails.dateTimeGMT), 'Asia/Kolkata', 'h:mm a'),
        countdown: getCountdown(new Date(matchDetails.dateTimeGMT)),
      };
      
      const allUserContestsAreCancelled = userContestDetails.every(c => c.status === 'cancelled');

      if (allUserContestsAreCancelled) {
        categorizedMatches.cancelled.push(matchMeta);
      } else if (matchDetails.matchEnded) {
        categorizedMatches.completed.push(matchMeta);
      } else if (matchDetails.matchStarted) {
        categorizedMatches.live.push(matchMeta);
      } else {
        categorizedMatches.upcoming.push(matchMeta);
      }
      console.log(`[getMyMatches] matchId: ${mid} → userContestDetails (status/winner/prize):`, userContestDetails.map(c => ({ status: c.status, isWinner: c.isWinner, prizeWon: c.prizeWon, rank: c.rank })));
      
    }

    categorizedMatches.upcoming.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
    categorizedMatches.live.sort((a, b) => new Date(a.dateTimeGMT) - new Date(b.dateTimeGMT));
    categorizedMatches.completed.sort((a, b) => new Date(b.dateTimeGMT) - new Date(a.dateTimeGMT));
    categorizedMatches.cancelled.sort((a, b) => new Date(b.dateTimeGMT) - new Date(a.dateTimeGMT));

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

// In controllers/cricketController.js (around line 510)
function formatToIST(dateInput) { // Renamed parameter to be more general
  if (!dateInput) return null;

  let date;
  if (dateInput instanceof Date) {
    // If it's already a Date object, use it directly
    date = dateInput;
  } else if (typeof dateInput === 'string') {
    // If it's a string, ensure it's in a format Date constructor understands,
    // like ISO 8601, and append 'Z' if it's a local time string to ensure UTC interpretation
    date = new Date(dateInput.endsWith('Z') ? dateInput : dateInput + 'Z');
  } else {
    console.error(`Could not format date to IST: Invalid input type. Expected string or Date, got ${typeof dateInput}`);
    return null; // Handle unexpected types
  }
  
  // Also, add a check for invalid dates
  if (isNaN(date.getTime())) {
    console.error(`Could not format date to IST: Invalid date value derived from ${dateInput}`);
    return null;
  }

  try {
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
    console.error(`Could not format date to IST: ${dateInput}`, error);
    return null;
  }
}

// If you put this in the same file as getCountdown, you can export both:
// module.exports = { getCountdown, formatToIST };