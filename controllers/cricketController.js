const cricketDataService = require('../services/cricketService');
const ContestParticipation = require('../models/ContestParticipation');
const Team = require('../models/TeamSchema');
const getCountdown = require('../utils/countDown');
const UserMatch = require('../models/UserMatchStore');
const mongoose = require('mongoose');
const redisClient = require('../utils/redisClient'); // Assuming your client is exported from here
const SERIES_MATCHES_CACHE_TTL = 3600; // Cache TTL for matches within a series: 1 hour (in seconds)



exports.getUpcomingMatches = async (req, res) => {
  try {
    const seriesList = await cricketDataService.upcomingSeriesList();

    if (!Array.isArray(seriesList) || seriesList.length === 0) {
      console.log('[getUpcomingMatches] No series found from service.');
      return res.json([]);
    }

    let allMatchesCollected = [];

    for (const series of seriesList) {
      const seriesId = series.id; // Ensure 'series.id' is the correct series identifier
      if (!seriesId) {
        console.warn('[getUpcomingMatches] Found a series without an ID:', series);
        continue;
      }

      const redisKey = `series:${seriesId}:matches`;
      let matchesForThisSeries = [];

      try {
        const cachedMatchesString = await redisClient.get(redisKey);
        if (cachedMatchesString) {
          matchesForThisSeries = JSON.parse(cachedMatchesString);
          console.log(`[getUpcomingMatches] Cache HIT for series matches: ${seriesId}`);
        } else {
          console.log(`[getUpcomingMatches] Cache MISS for series matches: ${seriesId}`);
          const seriesInfoResponse = await cricketDataService.getSeriesById(seriesId); // Parameter here is seriesId

          // *** CRITICAL: Adjust path to match list in seriesInfoResponse ***
          if (seriesInfoResponse && seriesInfoResponse.data && Array.isArray(seriesInfoResponse.data.matchList)) {
            matchesForThisSeries = seriesInfoResponse.data.matchList;
          } else {
            console.warn(`[getUpcomingMatches] No 'matchList' array in series_info for ${seriesId}. Response:`, JSON.stringify(seriesInfoResponse ? seriesInfoResponse.data : 'No response data'));
            matchesForThisSeries = [];
          }
          // *****************************************************************

          if (matchesForThisSeries.length > 0) {
            await redisClient.setEx(redisKey, SERIES_MATCHES_CACHE_TTL, JSON.stringify(matchesForThisSeries));
            console.log(`[getUpcomingMatches] Cached matches for series ${seriesId}.`);
          }
        }
      } catch (error) {
        console.error(`[getUpcomingMatches] Error processing series ${seriesId}:`, error.message);
      }

      if (Array.isArray(matchesForThisSeries) && matchesForThisSeries.length > 0) {
        allMatchesCollected.push(...matchesForThisSeries);
      }
    }

    if (allMatchesCollected.length === 0) {
      console.log('[getUpcomingMatches] No matches collected.');
      return res.json([]);
    }

    const uniqueMatchesMap = new Map();
    allMatchesCollected.forEach(match => {
      if (match && match.id) {
        uniqueMatchesMap.set(match.id, match);
      }
    });
    const uniqueMatchesArray = Array.from(uniqueMatchesMap.values());

    // -------- ADDING FILTER FOR TRULY UPCOMING MATCHES --------
    const now = new Date();
    const trulyUpcomingMatches = uniqueMatchesArray.filter(match => {
      if (!match) return false;

      const matchDateStr = match.dateTimeGMT || match.start_time; // Ensure your match objects have one of these
      if (!matchDateStr) {
        console.warn(`[getUpcomingMatches] Match ID ${match.id || 'N/A'} lacks a date (dateTimeGMT/start_time). Excluding.`);
        return false;
      }

      const matchTime = new Date(matchDateStr);
      if (isNaN(matchTime.getTime())) {
        console.warn(`[getUpcomingMatches] Match ID ${match.id || 'N/A'} has invalid date: ${matchDateStr}. Excluding.`);
        return false;
      }

      // Condition 1: Match time must be in the future
      const isFuture = matchTime > now;

      // Condition 2: Check match status if available (recommended)
      // Ensure match.status is a field in your match objects from the API
      let statusIsAppropriateForUpcoming = true;
      if (match.status) {
        const lowerStatus = String(match.status).toLowerCase();
        // Define statuses that mean a match is NOT upcoming
        const nonUpcomingStatuses = ['completed', 'live', 'ended', 'cancelled', 'abandoned', 'result', 'nodata'];
        if (nonUpcomingStatuses.includes(lowerStatus)) {
          statusIsAppropriateForUpcoming = false;
        }
      }
      return isFuture && statusIsAppropriateForUpcoming;
    });
    // -----------------------------------------------------------

    if (trulyUpcomingMatches.length === 0) {
        console.log('[getUpcomingMatches] No truly upcoming matches found after filtering.');
        return res.json([]);
    }

    const enrichedMatches = trulyUpcomingMatches.map(match => { // Use trulyUpcomingMatches here
      const matchTime = match.dateTimeGMT || match.start_time;
      return {
        ...match,
        dateTime: matchTime,
        countdown: getCountdown(matchTime, 'future')
      };
    }).filter(Boolean);

    enrichedMatches.sort((a, b) => {
      const dateA = new Date(a.dateTime);
      const dateB = new Date(b.dateTime);
      // No need for isValidDate checks here if filtered correctly, but doesn't hurt
      return dateA - dateB;
    });

    return res.json(enrichedMatches);

  } catch (error) {
    console.error('[getUpcomingMatches] Top-level error:', error);
    return res.status(500).json({ message: 'Failed to fetch upcoming matches', error: error.message });
  }
};

/**
 * @desc Fetch recent matches
 */
exports.getRecentMatches = async (req, res) => {
  try {
    const matches = await cricketDataService.recentMatchesList();
    return res.json(matches);
  } catch (error) {
    console.error('[getRecentMatches]', error);
    return res.status(500).json({ message: 'Failed to fetch recent matches', error: error.message });
  }
};


exports.getMyMatches = async (req, res) => {
  try {
    const userId = req.user?._id;

    // Step 1: Get all participations for the user
    const participations = await ContestParticipation.find({ user: userId })
      .select('matchId contestId isWinner prizeWon rank totalPoints')
      .lean();

    if (participations.length === 0) {
      return res.json({ upcoming: [], live: [], completed: [] });
    }

    const matchIds = [...new Set(participations.map(p => p.matchId?.toString().trim()).filter(Boolean))];

    // --- THIS IS THE LOGIC I ACCIDENTALLY REMOVED. IT IS NOW RESTORED. ---
    const userContestDetailsByMatch = {};
    participations.forEach(p => {
      const mid = p.matchId.toString().trim();
      if (!userContestDetailsByMatch[mid]) {
        userContestDetailsByMatch[mid] = [];
      }
      userContestDetailsByMatch[mid].push({
        contestId: p.contestId.toString(),
        isWinner: p.isWinner,
        prizeWon: p.prizeWon,
        rank: p.rank,
        totalPoints: p.totalPoints
      });
    });

    const userTeams = await Team.find({ user: userId, matchId: { $in: matchIds } }).lean();
    const teamsCountByMatch = {};
    const userTeamsByMatch = {};
    userTeams.forEach(team => {
      const mid = team.matchId.toString().trim();
      teamsCountByMatch[mid] = (teamsCountByMatch[mid] || 0) + 1;
      userTeamsByMatch[mid] = userTeamsByMatch[mid] || [];
      userTeamsByMatch[mid].push({
        _id: team._id.toString(),
        players: team.players,
        captain: team.captain,
        viceCaptain: team.viceCaptain
      });
    });
    // --- END OF RESTORED LOGIC ---

    // Fetching external match data
    const [recentMatchesResponse, upcomingMatchesResponse] = await Promise.all([
      cricketDataService.recentMatchesList(),
      cricketDataService.upcomingSeriesList()
    ]);

    const externalMatches = [...(recentMatchesResponse?.data || []), ...(upcomingMatchesResponse?.data || [])];
    const externalMatchMap = {};
    externalMatches.forEach(m => {
      const mid = (m.match_id || m.id)?.toString();
      if (mid) externalMatchMap[mid] = m;
    });

    // --- Fallback to saved match data ---
    const savedMatches = await UserMatch.find({ user: userId, matchId: { $in: matchIds } }).lean();
    const savedMatchMap = {};
    savedMatches.forEach(m => {
      savedMatchMap[m.matchId.toString().trim()] = m.matchInfo;
    });

    const categorizedMatches = { upcoming: [], live: [], completed: [] };

    for (const mid of matchIds) {
      console.log(`\n--- Processing Match ID: ${mid} ---`);

      const matchInfoFromExternal = externalMatchMap[mid];
      const matchInfoFromSaved = savedMatchMap[mid];

      console.log('Match found in external service?', matchInfoFromExternal ? '✅ Yes' : '❌ NO');
      console.log('Match found in saved UserMatch DB?', matchInfoFromSaved ? '✅ Yes' : '❌ NO');

      let matchDetailsToUse = null;
      if (matchInfoFromExternal) {
        matchDetailsToUse = matchInfoFromExternal;
      } else if (matchInfoFromSaved) {
        // Use the saved data if external is not available
        matchDetailsToUse = matchInfoFromSaved;
      }

      if (!matchDetailsToUse) {
        console.warn(`--> SKIPPING match ${mid} because NO details were found anywhere.`);
        continue;
      }
      
      // --- NEW LOG: Let's see the actual data being used for categorization ---
      console.log('Final match details being used:', matchDetailsToUse);

      // Categorization Logic
      const matchTime = matchDetailsToUse.dateTimeGMT || matchDetailsToUse.start_time || matchDetailsToUse.dateTime;
      const isStarted = matchDetailsToUse.matchStarted === true; // Stricter check
      const isEnded = matchDetailsToUse.matchEnded === true;   // Stricter check

      const matchMeta = {
        ...matchDetailsToUse,
        id: (matchDetailsToUse.id || matchDetailsToUse.match_id)?.toString().trim(),
        countdown: !isStarted && matchTime ? getCountdown(matchTime, 'future') : undefined,
        userTeamsCount: teamsCountByMatch[mid] || 0,
        userContestDetails: userContestDetailsByMatch[mid] || [],
        userTeams: userTeamsByMatch[mid] || []
      };

      if (!isStarted) {
        categorizedMatches.upcoming.push(matchMeta);
      } else if (isStarted && !isEnded) {
        categorizedMatches.live.push(matchMeta);
      } else if (isEnded) {
        categorizedMatches.completed.push(matchMeta);
      }
    }

    return res.json(categorizedMatches);

  } catch (error) {
    console.error('[getMyMatches] Error:', error);
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

    const userParticipations = await ContestParticipation.find({
      user: userId,
      matchId: matchId
    })
    .select('contestId isWinner prizeWon rank totalPoints teamId')
    // --- THIS LINE IS CORRECTED ---
    .populate('contestId', 'title entryFee totalSpots prize filledSpots prizeBreakupType') // CHANGED: 'prizePool' to 'prize' and added title/prizeBreakupType
    .lean();

    // The 'userParticipations' array will now look like this:
    // {
    //   ...participationFields,
    //   contestId: {
    //     _id: ...,
    //     title: "Daily H2H Clash #1",
    //     prize: 1000, // <--- The prize will now be included
    //     filledSpots: ...
    //   }
    // }
    
    res.json({
      count: userParticipations.length,
      participations: userParticipations,
    });

  } catch (error) {
    console.error('[getUserContestsForMatch] Error:', error);
    res.status(500).json({ message: 'Failed to fetch user contest data for the match', error: error.message });
  }
};