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

// Helper function to enrich a team with player details and calculate total points
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
      ContestParticipation.find({ contestId: { $in: userContestIds } }).populate('user', 'name profileImage').lean(),
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
      
      const participantsForThisMatch = allParticipationsInContests.filter(p => p.matchId?.toString() === mid);
      if (participantsForThisMatch.length === 0) continue;

      let allEnrichedTeamsRaw = [];
      participantsForThisMatch.forEach(p => {
        const team = teamsById.get(p.teamId?.toString());
        if (team) {
          allEnrichedTeamsRaw.push({ 
            ...enrichTeam(team, performancesByMatch[mid] || {}, playerDetailsMap.get(mid) || new Map()), 
            user: p.user, 
            contestId: p.contestId,
            contestTeam: p.contestTeam
          });
        }
      });
      
      const finalRanksByContest = new Map();
      if (matchDetails.matchStarted) {
        const contestIdsInMatch = [...new Set(participantsForThisMatch.map(p => p.contestId.toString()))];
        for (const contestId of contestIdsInMatch) {
          const contest = contestDetailsMap.get(contestId);
          const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;
          const contestParticipants = allEnrichedTeamsRaw.filter(team => team.contestId.toString() === contestId);

          if (contestTemplate?.type === 'TEAM_CONTEST') {
              const teamScores = contestParticipants.reduce((acc, team) => {
                  if (!acc[team.contestTeam]) acc[team.contestTeam] = 0;
                  acc[team.contestTeam] += team.totalPoints;
                  return acc;
              }, {});
              const sortedTeams = Object.entries(teamScores).sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
              const teamRankings = new Map();
              sortedTeams.forEach(([teamName], index) => teamRankings.set(teamName, index + 1));
              const teamRankMap = new Map();
              contestParticipants.forEach(team => {
                  teamRankMap.set(team._id.toString(), teamRankings.get(team.contestTeam));
              });
              finalRanksByContest.set(contestId, teamRankMap);
          } else {
              contestParticipants.sort((a, b) => b.totalPoints - a.totalPoints);
              const teamRankMap = new Map();
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
      }

      const allFullyEnrichedTeams = allEnrichedTeamsRaw.map(team => {
          const contestId = team.contestId.toString();
          const rank = finalRanksByContest.get(contestId)?.get(team._id.toString()) || null;
          let prizeWon = 0;

          if (matchDetails.matchEnded && rank !== null) {
              const contest = contestDetailsMap.get(contestId);
              const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;
              const prizeBreakdown = generatePrizeBreakdown(contestTemplate);

              const teamsAtSameRank = allEnrichedTeamsRaw.filter(
                  t => t.contestId.toString() === contestId &&
                       (finalRanksByContest.get(contestId)?.get(t._id.toString()) === rank)
              );
              const tieCount = teamsAtSameRank.length;

              if (tieCount > 0) {
                  const occupiedRanks = Array.from({ length: tieCount }, (_, i) => rank + i);
                  const totalTiedPrize = prizeBreakdown
                      .filter(b => occupiedRanks.includes(b.rank))
                      .reduce((sum, b) => sum + b.prize, 0);
                  
                  prizeWon = parseFloat((totalTiedPrize / tieCount).toFixed(2));
              }
          }
          return { ...team, rank, prizeWon, isWinner: prizeWon > 0 };
      });
      
      const userContestDetailsGrouped = new Map();
      const userParticipationsForMatch = participantsForThisMatch.filter(
        p => p.user?._id?.toString() === userId.toString()
      );

      for (const p of userParticipationsForMatch) {
        const contest = contestDetailsMap.get(p.contestId.toString());
        const contestTemplate = contest ? contestTemplatesMap.get(contest.contestTemplateId.toString()) : null;
        
        if (contest?.status === 'cancelled') {
            userContestDetailsGrouped.set(p._id.toString(), {
                _id: p._id,
                contestId: p.contestId,
                status: 'cancelled',
                teamName: teamsById.get(p.teamId.toString())?.teamName || '',
                entryFee: contest?.entryFee || 0
            });
            continue;
        }

        const enrichedTeamData = allFullyEnrichedTeams.find(
            t => t._id.toString() === p.teamId.toString() && t.contestId.toString() === p.contestId.toString()
        );

        const contestIdStr = p.contestId.toString();

        if (contestTemplate?.type === 'TEAM_CONTEST') {
            if (userContestDetailsGrouped.has(contestIdStr)) {
                const existing = userContestDetailsGrouped.get(contestIdStr);
                existing.prizeWon += enrichedTeamData?.prizeWon || 0;
                existing.entryFee += contestTemplate?.entryFee || 0;
                if(enrichedTeamData) existing.userTeamNames.push(enrichedTeamData.teamName);
            } else {
                userContestDetailsGrouped.set(contestIdStr, {
                    ...p,
                    rank: enrichedTeamData?.rank,
                    prizeWon: enrichedTeamData?.prizeWon || 0,
                    contestPrize: contestTemplate?.prize || 0,
                    contestType: contestTemplate?.type,
                    entryFee: contestTemplate?.entryFee || 0,
                    totalSpots: contestTemplate?.totalSpots || 0,
                    prizeBreakdown: generatePrizeBreakdown(contestTemplate),
                    teamName: `Team ${p.contestTeam}`,
                    userTeamNames: enrichedTeamData ? [enrichedTeamData.teamName] : [],
                });
            }
        } else {
            userContestDetailsGrouped.set(p._id.toString(), {
                ...p,
                rank: enrichedTeamData?.rank,
                prizeWon: enrichedTeamData?.prizeWon || 0,
                contestPrize: contestTemplate?.prize || 0,
                contestType: contestTemplate?.type,
                entryFee: contestTemplate?.entryFee || 0,
                totalSpots: contestTemplate?.totalSpots || 0,
                prizeBreakdown: generatePrizeBreakdown(contestTemplate),
                teamName: enrichedTeamData?.teamName || '',
            });
        }
      }

      userContestDetailsGrouped.forEach(entry => {
          entry.isWinner = entry.prizeWon > 0;
      });

      const userContestDetails = Array.from(userContestDetailsGrouped.values());
      
      if (userContestDetails.length === 0) continue;

      const userTeamsForMatch = allFullyEnrichedTeams.filter(t => t.user?._id?.toString() === userId.toString());
      const opponentTeamsForMatch = allFullyEnrichedTeams.filter(t => t.user?._id?.toString() !== userId.toString());

      const contestLeaderboards = new Map();
      const contestIdsInMatchForLeaderboard = [...new Set(participantsForThisMatch.map(p => p.contestId.toString()))];
      for (const contestId of contestIdsInMatchForLeaderboard) {
          const teamsForThisContest = allFullyEnrichedTeams
              .filter(team => team.contestId.toString() === contestId)
              .sort((a, b) => (a.rank || Infinity) - (b.rank || Infinity));
          contestLeaderboards.set(contestId, teamsForThisContest);
      }

      const matchMeta = {
        ...matchDetails,
        userTeamsCount: userTeamsForMatch.length,
        userContestDetails,
        userTeams: userTeamsForMatch,
        opponentTeams: opponentTeamsForMatch,
        contestLeaderboards: Object.fromEntries(contestLeaderboards),
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

const enrichTeamWithPlayers = (team, performances, playerDetailsMap) => {
  const teamObj = team.toObject ? team.toObject() : team;
  let totalPoints = 0;

  // --- DEBUG LOG to see the structure of your team's player list ---
  console.log('--- DEBUG: Processing Team.players array ---', teamObj.players);

  const enrichedPlayers = teamObj.players.map(playerObject => {
      // The player's ID might be directly on the object or nested.
      // This line handles both cases: `playerObject.playerId` or just `playerObject` itself.
      const playerIdStr = (playerObject.playerId || playerObject)?.toString();

      if (!playerIdStr) {
          console.error('--- DEBUG: Found a player record without an ID ---', playerObject);
          return null; // Skip malformed records
      }

      const performance = performances[playerIdStr];
      const details = playerDetailsMap.get(playerIdStr);
      const basePoints = performance?.points || 0;
      let finalPoints = basePoints;
      let role = playerObject.role || null; // Get role from the player object if it exists

      if (playerIdStr === teamObj.captain?.toString()) {
          finalPoints = basePoints * 2;
          role = 'Captain';
      } else if (playerIdStr === teamObj.viceCaptain?.toString()) {
          finalPoints = basePoints * 1.5;
          role = 'Vice-Captain';
      }
      
      totalPoints += finalPoints;

      return {
          playerId: playerIdStr,
          name: details?.name || 'Unknown Player',
          playerImg: details?.playerImg || 'https://h.cricapi.com/img/icon512.png',
          role: role,
          points: parseFloat(finalPoints.toFixed(2)),
          basePoints: basePoints,
      };
  }).filter(Boolean); // Remove any nulls from malformed records

  return { ...teamObj, players: enrichedPlayers, totalPoints: parseFloat(totalPoints.toFixed(2)) };
};


// --- FINAL, CORRECTED CONTROLLER FUNCTION ---
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

  const userParticipationStubs = await ContestParticipation.find({ user: userId, matchId }).lean();
  if (userParticipationStubs.length === 0) {
    return res.json({
      countdown: getCountdown(matchDetails.dateTimeGMT),
      displayTimeIST: formatToIST(matchDetails.dateTimeGMT),
      count: 0,
      participations: [],
      contestLeaderboards: {}
    });
  }

  const contestIds = [...new Set(userParticipationStubs.map(p => p.contestId))];

  const [
      allContestDetails,
      allParticipationsInContests,
      playerPerformances,
      squadData
  ] = await Promise.all([
      Contest.find({ _id: { $in: contestIds } }).select('title entryFee totalSpots prize filledSpots prizeBreakupType prizeDistribution').lean(),
      ContestParticipation.find({ contestId: { $in: contestIds } }).populate('user', 'name').lean(),
      PlayerPerformance.find({ matchId }).lean(),
      squadList.findOne({ _id: matchId }).lean()
  ]);
  
  const teamIds = [...new Set(allParticipationsInContests.map(p => p.teamId?.toString()).filter(Boolean))];
  const teams = await Team.find({ _id: { $in: teamIds } }).lean();

  const teamsById = new Map(teams.map(t => [t._id.toString(), t]));
  const performancesByPlayerId = playerPerformances.reduce((acc, p) => {
      if(p.playerId) acc[p.playerId.toString()] = p;
      return acc;
  }, {});
  const playerDetailsMap = new Map(squadData?.squad.flatMap(team => team.players).map(player => [player.id, player]) || []);

  const allEnrichedTeams = allParticipationsInContests.map(p => {
      const team = teamsById.get(p.teamId?.toString());
      if (!team) return null;
      const enrichedTeam = enrichTeamWithPlayers(team, performancesByPlayerId, playerDetailsMap);
      return { ...enrichedTeam, user: p.user, contestId: p.contestId, rank: null };
  }).filter(Boolean);

  const contestLeaderboards = {};
  for (const contestId of contestIds) {
      const contestIdStr = contestId.toString();
      const contestParticipants = allEnrichedTeams
          .filter(team => team.contestId.toString() === contestIdStr)
          .sort((a, b) => b.totalPoints - a.totalPoints);
          
      let currentRank = 1;
      for (let i = 0; i < contestParticipants.length; i++) {
          if (i > 0 && contestParticipants[i].totalPoints < contestParticipants[i-1].totalPoints) {
              currentRank = i + 1;
          }
          contestParticipants[i].rank = currentRank;
      }
      contestLeaderboards[contestIdStr] = contestParticipants;
  }

  // --- RESTORED LOGIC to build the `participations` array correctly ---
  const contestsById = new Map(allContestDetails.map(c => [c._id.toString(), c]));
  const enrichedParticipations = userParticipationStubs.map(userP => {
    const contestIdStr = userP.contestId.toString();
    const contestLeaderboard = contestLeaderboards[contestIdStr] || [];
    const userFullTeam = contestLeaderboard.find(t => t._id.toString() === userP.teamId.toString());
    
    const opponentTeams = contestLeaderboard
      .filter(t => t._id.toString() !== userP.teamId.toString())
      .map(op => ({ userName: op.user?.name, teamName: op.teamName }));

    const userTeamInfo = {
        userName: userFullTeam?.user.name || 'You',
        teamName: userFullTeam?.teamName || 'Unnamed Team',
    };
    
    const contestDetails = contestsById.get(contestIdStr) || {};
    if(contestDetails) {
      contestDetails.prizeBreakdown = generatePrizeBreakdown(contestDetails);
    }

    return {
      _id: userP._id,
      teamId: userP.teamId,
      totalPoints: userFullTeam?.totalPoints || 0,
      rank: userFullTeam?.rank || null,
      isWinner: false, 
      prizeWon: 0,
      contestDetails: contestDetails,
      userTeam: userTeamInfo,
      opponentTeams: opponentTeams,
    };
  });

  res.json({
    countdown: getCountdown(matchDetails.dateTimeGMT),
    displayTimeIST: formatToIST(matchDetails.dateTimeGMT),
    count: enrichedParticipations.length,
    participations: enrichedParticipations,
    contestLeaderboards: contestLeaderboards,
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