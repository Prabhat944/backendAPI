// // jobs/calculateMatchResultsCron.js

// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const RecentMatch = require('../models/RecentMatch'); // Adjust path to your Match model
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');
// const Team = require('../models/TeamSchema'); // Assuming your Team model
// const PlayerPerformance = require('../models/PlayerPerformanceSchema'); // Assuming your PlayerPerformance model

// // Helper to generate prize breakdown (from your getMyMatches)
// const generatePrizeBreakdown = (contestTemplate) => {
//     if (!contestTemplate) return [];
//     const { prizeBreakupType, prizeDistribution, prize } = contestTemplate;
//     switch (prizeBreakupType) {
//         case 'winnerTakesAll':
//             return [{ rank: 1, prize: prize || 0 }];
//         case 'fixedAmountSplit':
//             return (prizeDistribution || []).map(dist => ({ rank: dist.rank, prize: dist.amount }));
//         case 'percentageSplit':
//             return (prizeDistribution || []).map(dist => ({ rank: dist.rank, prize: parseFloat(((dist.percentage / 100) * (prize || 0)).toFixed(2)) }));
//         default:
//             return [];
//     }
// };

// // Helper to calculate total points for a team (from your getMyMatches, slightly adapted)
// const calculateTeamPoints = (team, matchPerformancesMap) => {
//     let totalPoints = 0;
    
//     // Ensure team.players is an array and contains player objects with 'playerId'
//     // If team.players is just an array of playerIds, you would need to populate the players in the Team model first
//     if (!team.players || !Array.isArray(team.players)) {
//         console.warn(`Team ${team._id} has invalid or no players array.`);
//         return 0; // Or throw an error depending on desired strictness
//     }

//     team.players.forEach(player => {
//         const playerIdStr = player.playerId ? player.playerId.toString() : player.toString(); // Handle both object.playerId and simple playerId string
//         const performance = matchPerformancesMap.get(playerIdStr);
        
//         let currentPoints = parseFloat(performance?.points || 0);
        
//         // Apply Captain/Vice-Captain multipliers
//         if (team.captain && team.captain.toString() === playerIdStr) {
//             currentPoints *= 2;
//         }
//         if (team.viceCaptain && team.viceCaptain.toString() === playerIdStr) {
//             currentPoints *= 1.5;
//         }
//         totalPoints += currentPoints;
//     });
//     return parseFloat(totalPoints.toFixed(2));
// };

// const calculateMatchResults = async () => {
//     const currentTime = new Date();
//     console.log(`===========================================`);
//     console.log(`[${currentTime.toLocaleString()}] 📊 Starting match results calculation cron...`);

//     try {
//         const matchesToProcess = await RecentMatch.find({
//             matchEnded: true,
//             resultsProcessed: { $ne: true }
//         }).lean();

//         console.log(`🔍 Found ${matchesToProcess.length} matches to calculate results for.`);

//         if (matchesToProcess.length === 0) {
//             console.log('✅ No new match results to calculate. Exiting.');
//             return;
//         }

//         for (const match of matchesToProcess) {
//             console.log(`⚙️ Processing results for Match ID: ${match._id} (${match.name})`);

//             console.log(`Fetching player performances for match ${match._id}`);
//             const allPlayerPerformances = await PlayerPerformance.find({ matchId: match._id }).lean();
//             console.log(`Found ${allPlayerPerformances.length} player performances.`);
            
//             if (allPlayerPerformances.length === 0) {
//                 console.warn(`⚠️ No player performances found for match ${match._id}. Cannot calculate results. Marking match as processed to avoid repeated checks.`);
//                 // If no player performance data, it means we can't calculate results.
//                 // It's usually safe to mark as processed to prevent infinite loops if data is truly missing.
//                 await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//                 continue; // Move to next match
//             }

//             const matchPerformancesMap = new Map(); // Map playerId to performance object
//             allPlayerPerformances.forEach(p => matchPerformancesMap.set(p.playerId.toString(), p));


//             console.log(`Fetching contests for match ${match._id}`);
//             const contestsInMatch = await Contest.find({ 
//                 matchId: match._id,
//                 status: { $ne: 'cancelled' } // Only process results for non-cancelled contests
//             }).populate('contestTemplateId').lean(); // Populate template for prize breakdown
//             console.log(`Found ${contestsInMatch.length} active contests for match ${match._id}.`);

//             if (contestsInMatch.length === 0) {
//                 console.log(`ℹ️ No active contests found for match ${match._id}. Marking match as processed for results.`);
//                 await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//                 continue;
//             }

//             // Fetch all participations and teams for these contests
//             const contestIdsInMatch = contestsInMatch.map(c => c._id);
            
//             // Find all participations linked to these contests
//             const allContestParticipations = await ContestParticipation.find({
//                 contestId: { $in: contestIdsInMatch }
//             }).lean();

//             // Collect all unique team IDs from these participations
//             const teamIdsInMatch = [...new Set(allContestParticipations.map(p => p.teamId.toString()))];
            
//             // Fetch all unique teams for this match/contests
//             const allTeams = await Team.find({ _id: { $in: teamIdsInMatch } }).lean();
//             const teamsMap = new Map(allTeams.map(t => [t._id.toString(), t]));

//             // Process each contest
//             for (const contest of contestsInMatch) {
//                 console.log(`➡️ Processing contest ${contest._id} for match ${match._id}`);
//                 const participationsForThisContest = allContestParticipations.filter(p => 
//                     p.contestId.toString() === contest._id.toString()
//                 );
//                 console.log(`Found ${participationsForThisContest.length} participations in contest ${contest._id}.`);

//                 if (participationsForThisContest.length === 0) {
//                     console.log(`ℹ️ Contest ${contest._id} has no participants. Marking contest as completed.`);
//                     await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } }); // Mark contest as completed
//                     continue;
//                 }

//                 // 1. Calculate points for each team in this contest
//                 const teamsWithCalculatedPoints = participationsForThisContest.map(p => {
//                     const team = teamsMap.get(p.teamId.toString());
//                     if (!team) {
//                         console.warn(`⚠️ Team ${p.teamId} not found for participation ${p._id}. Skipping points calculation for this participation.`);
//                         // Do not return null, return an object so it's included but can be filtered later.
//                         // Or ensure `teamsMap` always has valid teams for participations.
//                         return null; // Skip this one for calculation
//                     }
//                     if (!team.players || team.players.length === 0) { 
//                         console.warn(`⚠️ Team ${team._id} has no players defined. Skipping points calculation.`);
//                         return null;
//                     }

//                     console.log(`Calculating points for team ${team._id} (Participation: ${p._id}).`);
//                     const points = calculateTeamPoints(team, matchPerformancesMap);
//                     console.log(`Calculated points for team ${team._id}: ${points}`);
//                     return { participationId: p._id, totalPoints: points, teamId: team._id.toString() };
//                 }).filter(Boolean); // Remove any null entries resulting from missing teams/players


//                 if (teamsWithCalculatedPoints.length === 0) {
//                      console.warn(`⚠️ No valid teams with points for contest ${contest._id} after calculation. Skipping rank calculation and marking contest completed.`);
//                      await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//                      // Also update participations to 'completed' even if points are 0
//                      await ContestParticipation.updateMany(
//                          { _id: { $in: participationsForThisContest.map(p => p._id) } },
//                          { $set: { status: 'completed', totalPoints: 0, rank: null, isWinner: false, prizeWon: 0 } }
//                      );
//                      continue;
//                 }

//                 console.log(`Teams in contest ${contest._id} after initial point calculation:`, teamsWithCalculatedPoints);

//                 // 2. Sort teams by points to determine ranks
//                 teamsWithCalculatedPoints.sort((a, b) => b.totalPoints - a.totalPoints);
//                 console.log(`Teams in contest ${contest._id} after sorting for ranks:`, teamsWithCalculatedPoints);


//                 // 3. Determine ranks, winners, and prizeWon
//                 const contestPrizeBreakdown = generatePrizeBreakdown(contest.contestTemplateId);
//                 console.log(`Prize breakdown for contest ${contest._id}:`, contestPrizeBreakdown);
//                 const participationsToUpdateBulk = []; // Store updates for bulkWrite

//                 let lastPoints = -1; // Use a value that totalPoints won't naturally be
//                 let lastRank = 0;

//                 for (let i = 0; i < teamsWithCalculatedPoints.length; i++) {
//                     const currentTeam = teamsWithCalculatedPoints[i];
                    
//                     // Assign rank: handle ties
//                     if (currentTeam.totalPoints === lastPoints) {
//                         currentRank = lastRank; // Same rank as previous if points are equal
//                     } else {
//                         currentRank = i + 1; // New rank
//                         lastPoints = currentTeam.totalPoints;
//                         lastRank = currentRank;
//                     }

//                     let prizeWon = 0;
//                     let isWinner = false;

//                     // Calculate prize for the current rank (handling ties for prize splitting)
//                     // Find all entries in prizeBreakdown that match or fall into the current rank's prize range
//                     const prizeEntryForRank = contestPrizeBreakdown.find(pb => pb.rank === currentRank);
                    
//                     if (prizeEntryForRank && prizeEntryForRank.prize > 0) {
//                         // Check if multiple players share this rank
//                         const tiedPlayersAtThisExactRank = teamsWithCalculatedPoints.filter(t => t.totalPoints === currentTeam.totalPoints);
                        
//                         // If there are ties, distribute the prize for this rank (and potentially subsequent ranks if prize structure allows sharing)
//                         // For 'winnerTakesAll' or simple fixed-rank prizes, just distribute `prizeEntryForRank.prize` among tied players.
//                         // For more complex prize distributions across multiple tied ranks, you'd need sophisticated logic.
//                         // For simple H2H 'winnerTakesAll', it's just prizeEntryForRank.prize / tiedPlayersAtThisExactRank.length
//                         prizeWon = parseFloat((prizeEntryForRank.prize / tiedPlayersAtThisExactRank.length).toFixed(2));
//                         isWinner = true;
//                     }
                    
//                     // Collect update operations
//                     console.log(`Updating participation ${currentTeam.participationId}: Points: ${currentTeam.totalPoints}, Rank: ${currentRank}, Winner: ${isWinner}, Prize: ${prizeWon}`);
//                     participationsToUpdateBulk.push({
//                         updateOne: {
//                             filter: { _id: currentTeam.participationId },
//                             update: { 
//                                 $set: {
//                                     totalPoints: currentTeam.totalPoints,
//                                     rank: currentRank,
//                                     isWinner: isWinner,
//                                     prizeWon: prizeWon,
//                                     status: 'completed' // This assumes schema enum includes 'completed'
//                                 }
//                             }
//                         }
//                     });
//                 }

//                 // 4. Update ContestParticipation documents in bulk
//                 if (participationsToUpdateBulk.length > 0) {
//                     await ContestParticipation.bulkWrite(participationsToUpdateBulk);
//                     console.log(`✅ Updated ${participationsToUpdateBulk.length} participations for contest ${contest._id}.`);
//                 } else {
//                     console.log(`ℹ️ No participations needed update for contest ${contest._id}.`);
//                 }

//                 // 5. Update Contest status to 'completed'
//                 await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//                 console.log(`✅ Contest ${contest._id} status set to 'completed'.`);
//             }

//             // Mark the match as processed after all its contests are handled
//             await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//             console.log(`✅ Finished processing results for Match ${match._id}.`);
//         }
//     } catch (error) {
//         console.error('🔥 Critical error in calculateMatchResults cron:', error.message, error.stack);
//         // If a critical error occurs, you might NOT want to set resultsProcessed: true
//         // until the problem is fixed and manually re-triggered.
//         // Or you might log it as 'resultsProcessingFailed: true' and retry next time.
//     }

//     console.log(`[${currentTime.toLocaleString()}] ✅ Match results calculation cron finished.`);
//     console.log('===========================================');
// };

// const start = () => {
//     mongoose.connection.once('open', () => {
//         cron.schedule('* * * * *', calculateMatchResults); // Every minute
//         console.log('⏳ Cron scheduled: Match results calculation every minute.');
//     });

//     mongoose.connection.on('error', err => {
//         console.error('❌ MongoDB connection error in match results cron:', err);
//     });
// };

// module.exports = { start };

// start();