const calculatePoints = require('./calculatePoints');
const PlayerPerformance = require('../models/PlayerPerformanceSchema');

/**
 * Parses match BBB (ball-by-ball) array and updates player performances.
 * @param {Array} bbb - Array of ball-by-ball events.
 * @param {String} matchId - ID of the match.
 * @param {String} format - Format of the match: 'T20', 'ODI', etc.
 */
async function parseMatchData(bbb, matchId, format) {
  const playerStats = {};
  const overWiseBowlerRuns = {};
  const bowlerBallCounts = {};

  // --- Step 1: Initialize player stats structures ---
  // Iterate through all balls once to ensure all batsmen, bowlers, and potential fielders
  // have their initial stats objects created. This prevents "undefined" errors later.
  for (const ball of bbb) {
    // Initialize batsman stats
    if (!playerStats[ball.batsman.id]) {
      playerStats[ball.batsman.id] = {
        batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDuck: false, strikeRate: 0 },
        bowling: { wickets: 0, overs: 0, runsConceded: 0, maidenOvers: 0, economy: 0 },
        fielding: { catches: 0, stumpings: 0, runOuts: 0 }, // Add runOuts for future if needed
      };
    }

    // Initialize bowler stats
    if (!playerStats[ball.bowler.id]) {
      playerStats[ball.bowler.id] = {
        batting: { runs: 0, ballsFaced: 0, fours: 0, sixes: 0, isDuck: false, strikeRate: 0 },
        bowling: { wickets: 0, overs: 0, runsConceded: 0, maidenOvers: 0, economy: 0 },
        fielding: { catches: 0, stumpings: 0, runOuts: 0 },
      };
    }

    // --- IMPORTANT NOTE for Fielding: ---
    // Your current API response provides 'catcher' by name (e.g., "Hetmyer"), not by ID.
    // To accurately track fielding stats by player ID, you'll need to:
    // 1. Get a mapping of player names to IDs (e.g., from a 'squad' or 'player info' API endpoint for the match).
    // 2. Or, modify your API integration to retrieve catcher IDs directly in the ball-by-ball data.
    // For now, fielding stats for catchers will only be updated if their ID already exists from batting/bowling.
    // If you need to store runOutThrower/runOutCatcher, your 'ball' object needs to provide their IDs.
  }

  // --- Step 2: Process each ball event to accumulate raw stats ---
  for (const ball of bbb) {
    const { batsman, bowler, runs, extras, dismissal, catcher, over, penalty } = ball;

    // **Batting stats**
    const batsmanStats = playerStats[batsman.id].batting;
    batsmanStats.runs += runs;
    batsmanStats.ballsFaced += 1; // Every legal delivery faced
    if (runs === 4) batsmanStats.fours += 1;
    if (runs === 6) batsmanStats.sixes += 1;

    // **Bowling stats**
    const bowlerStats = playerStats[bowler.id].bowling;
    const totalRunsOnBall = runs + extras; // Runs scored off the bat + extras
    bowlerStats.runsConceded += totalRunsOnBall;

    // Track runs conceded per over for maiden over calculation
    // 'over' field from API is 0-indexed, so over 1 is 'over: 0'
    const overKey = `${bowler.id}_${over}`;
    if (!overWiseBowlerRuns[overKey]) {
      overWiseBowlerRuns[overKey] = 0;
    }
    // For maiden, generally 0 runs off bat AND 0 extras. If extras should break maiden, keep this.
    overWiseBowlerRuns[overKey] += totalRunsOnBall;

    // Increment legitimate balls bowled for overs calculation
    // A 'penalty' like 'wide' or 'no ball' doesn't count towards the bowler's overs.
    if (!penalty || (penalty !== 'wide' && penalty !== 'no ball')) {
       if (!bowlerBallCounts[bowler.id]) {
           bowlerBallCounts[bowler.id] = 0;
       }
       bowlerBallCounts[bowler.id]++;
    }

    // **Wicket Detection (FIXED!)**
    if (dismissal) {
      // Define dismissals where the bowler gets credit for a wicket
      const bowlerCreditedDismissals = [
        'bowled', 'lbw', 'catch', 'caught and bowled', 'stumped', 'hit wicket'
      ];

      // Check if the dismissal type is one that credits the bowler
      // and if it's not a run out (which is a fielding dismissal, not bowler's wicket)
      if (bowlerCreditedDismissals.includes(dismissal.toLowerCase()) && dismissal.toLowerCase() !== 'run out') {
         bowlerStats.wickets += 1;
      }
    }

    // **Fielding stats (Requires catcher ID mapping)**
    // If you manage to map catcher name to ID, you can uncomment and use this:
    /*
    if (catcher && playerStats[catcher.id]) {
        playerStats[catcher.id].fielding.catches += 1;
    }
    // Add logic for stumpings and run-outs if your 'ball' object provides sufficient detail (e.g., stumper ID, runOutThrower ID etc.)
    */
  }

  // --- Step 3: Post-loop calculations (Maidens, Overs, Strike Rate, Economy) ---

  // Calculate maiden overs
  for (const key in overWiseBowlerRuns) {
    // If the total runs conceded in an over was 0
    if (overWiseBowlerRuns[key] === 0) {
      const [bowlerId] = key.split('_');
      // Ensure the bowler exists in playerStats before incrementing
      if (playerStats[bowlerId]) {
        playerStats[bowlerId].bowling.maidenOvers += 1;
      }
    }
  }

  // Convert total balls bowled into cricket 'overs' format (X.Y where Y is balls)
  for (const bowlerId in bowlerBallCounts) {
    if (playerStats[bowlerId]) {
      const totalBalls = bowlerBallCounts[bowlerId];
      const completedOvers = Math.floor(totalBalls / 6);
      const remainingBalls = totalBalls % 6;
      // Store overs as a string or number that represents X.Y format
      playerStats[bowlerId].bowling.overs = parseFloat(`${completedOvers}.${remainingBalls}`);
    }
  }

  // --- Step 4: Finalize stats (Duck, SR, Economy) and Save/Update to MongoDB ---
  for (const playerId in playerStats) {
    const stats = playerStats[playerId];

    // Determine if batsman got a duck (faced balls but scored 0 runs)
    if (stats.batting.ballsFaced > 0 && stats.batting.runs === 0) {
      stats.batting.isDuck = true;
    } else {
      stats.batting.isDuck = false;
    }

    // Calculate Strike Rate (SR) for batting
    const runsScored = stats.batting.runs;
    const ballsFaced = stats.batting.ballsFaced;
    stats.batting.strikeRate = ballsFaced > 0 ? ((runsScored / ballsFaced) * 100).toFixed(2) : 0;

    // Calculate Economy Rate for bowling (FIXED for accuracy)
    const runsConceded = stats.bowling.runsConceded;
    const totalBallsBowledForEconomy = bowlerBallCounts[playerId] || 0; // Use total legitimate balls
    stats.bowling.economy = totalBallsBowledForEconomy > 0 ? (runsConceded / totalBallsBowledForEconomy * 6).toFixed(2) : 0;


    // Calculate points using the 'calculatePoints' function
    const points = calculatePoints(stats, format);

    // Save or update player performance in MongoDB
    await PlayerPerformance.findOneAndUpdate(
      { playerId, matchId }, // Query: Find document by player ID and match ID
      {
        // Data to set/update
        playerId,
        matchId,
        format,
        batting: stats.batting,
        bowling: stats.bowling,
        fielding: stats.fielding,
        points,
        createdAt: new Date(), // Set on creation
        updatedAt: new Date()  // Always update this timestamp
      },
      {
        upsert: true, // If no document matches, create a new one
        new: true     // Return the updated/new document after the operation
      }
    );
  }
}

module.exports = parseMatchData;