// // jobs/calculateMatchResultsCron.js

// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const RecentMatch = require('../models/RecentMatch');
// const Contest = require('../models/Contest');
// const ContestParticipation = require('../models/ContestParticipation');
// const Team = require('../models/TeamSchema');
// const PlayerPerformance = require('../models/PlayerPerformanceSchema');

// // Helper to generate prize breakdown
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

// // Helper to calculate total points for a single fantasy team
// const calculateTeamPoints = (team, matchPerformancesMap) => {
//     let totalPoints = 0;
//     if (!team.players || !Array.isArray(team.players)) {
//         return 0;
//     }
//     team.players.forEach(player => {
//         const playerIdStr = player.playerId ? player.playerId.toString() : player.toString();
//         const performance = matchPerformancesMap.get(playerIdStr);
//         let currentPoints = parseFloat(performance?.points || 0);
        
//         if (team.captain && team.captain.toString() === playerIdStr) currentPoints *= 2;
//         if (team.viceCaptain && team.viceCaptain.toString() === playerIdStr) currentPoints *= 1.5;
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

//         if (matchesToProcess.length === 0) {
//             console.log('✅ No new match results to calculate. Exiting.');
//             return;
//         }

//         for (const match of matchesToProcess) {
//             console.log(`⚙️ Processing results for Match ID: ${match._id} (${match.name})`);

//             const allPlayerPerformances = await PlayerPerformance.find({ matchId: match._id }).lean();
//             if (allPlayerPerformances.length === 0) {
//                 console.warn(`⚠️ No player performances for match ${match._id}. Marking as processed.`);
//                 await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//                 continue;
//             }

//             const matchPerformancesMap = new Map(allPlayerPerformances.map(p => [p.playerId.toString(), p]));

//             const contestsInMatch = await Contest.find({ matchId: match._id, status: { $ne: 'cancelled' } })
//                 .populate('contestTemplateId').lean();

//             if (contestsInMatch.length === 0) {
//                 console.log(`ℹ️ No active contests for match ${match._id}. Marking as processed.`);
//                 await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//                 continue;
//             }

//             const contestIdsInMatch = contestsInMatch.map(c => c._id);
//             const allContestParticipations = await ContestParticipation.find({ contestId: { $in: contestIdsInMatch } }).lean();
//             const teamIdsInMatch = [...new Set(allContestParticipations.map(p => p.teamId.toString()))];
//             const allTeams = await Team.find({ _id: { $in: teamIdsInMatch } }).lean();
//             const teamsMap = new Map(allTeams.map(t => [t._id.toString(), t]));

//             for (const contest of contestsInMatch) {
//                 console.log(`➡️ Processing contest ${contest._id} (${contest.type})`);
                
//                 const participationsForThisContest = allContestParticipations.filter(p => p.contestId.toString() === contest._id.toString());
//                 if (participationsForThisContest.length === 0) {
//                     await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//                     continue;
//                 }

//                 const teamsWithCalculatedPoints = participationsForThisContest.map(p => {
//                     const team = teamsMap.get(p.teamId.toString());
//                     if (!team) return null;
//                     const points = calculateTeamPoints(team, matchPerformancesMap);
//                     return { ...p, totalPoints: points };
//                 }).filter(Boolean);

//                 // --- LOGIC BRANCHING BASED ON CONTEST TYPE ---
//                 if (contest.type === 'TEAM_CONTEST') {
//                     console.log(`--- Running TEAM_CONTEST logic for ${contest._id} ---`);
//                     let totalPointsTeamA = 0, totalPointsTeamB = 0;
//                     const membersTeamA = [], membersTeamB = [];

//                     teamsWithCalculatedPoints.forEach(p => {
//                         if (p.contestTeam === 'A') {
//                             totalPointsTeamA += p.totalPoints;
//                             membersTeamA.push(p);
//                         } else if (p.contestTeam === 'B') {
//                             totalPointsTeamB += p.totalPoints;
//                             membersTeamB.push(p);
//                         }
//                     });

//                     console.log(`Team A Score: ${totalPointsTeamA}, Team B Score: ${totalPointsTeamB}`);
                    
//                     let winners = [], losers = [], prizePerWinner = 0;
//                     const totalPrize = contest.prize || 0;

//                     if (totalPointsTeamA > totalPointsTeamB) {
//                         winners = membersTeamA;
//                         losers = membersTeamB;
//                     } else if (totalPointsTeamB > totalPointsTeamA) {
//                         winners = membersTeamB;
//                         losers = membersTeamA;
//                     } else { // It's a tie
//                         winners = [...membersTeamA, ...membersTeamB];
//                     }

//                     prizePerWinner = winners.length > 0 ? parseFloat((totalPrize / winners.length).toFixed(2)) : 0;
                    
//                     const bulkOps = [];
//                     winners.forEach(p => bulkOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: { totalPoints: p.totalPoints, rank: 1, isWinner: true, prizeWon: prizePerWinner, status: 'completed' } } } }));
//                     losers.forEach(p => bulkOps.push({ updateOne: { filter: { _id: p._id }, update: { $set: { totalPoints: p.totalPoints, rank: 2, isWinner: false, prizeWon: 0, status: 'completed' } } } }));

//                     if (bulkOps.length > 0) {
//                         await ContestParticipation.bulkWrite(bulkOps);
//                         console.log(`✅ Updated ${bulkOps.length} participations for TEAM_CONTEST ${contest._id}.`);
//                     }

//                 } else {
//                     // ✅ ELSE: Your existing logic for all other contest types remains unchanged.
//                     console.log(`--- Running standard ranking logic for ${contest._id} ---`);

//                     teamsWithCalculatedPoints.sort((a, b) => b.totalPoints - a.totalPoints);
//                     const prizeBreakdown = generatePrizeBreakdown(contest.contestTemplateId);
//                     const bulkOps = [];
//                     let lastPoints = -1, lastRank = 0;

//                     for (let i = 0; i < teamsWithCalculatedPoints.length; i++) {
//                         const currentTeam = teamsWithCalculatedPoints[i];
//                         const currentRank = (currentTeam.totalPoints === lastPoints) ? lastRank : i + 1;
//                         lastPoints = currentTeam.totalPoints;
//                         lastRank = currentRank;
                        
//                         let prizeWon = 0, isWinner = false;
//                         const prizeEntry = prizeBreakdown.find(pb => pb.rank === currentRank);
//                         if (prizeEntry) {
//                             const tiedPlayers = teamsWithCalculatedPoints.filter(t => t.totalPoints === currentTeam.totalPoints);
//                             prizeWon = parseFloat((prizeEntry.prize / tiedPlayers.length).toFixed(2));
//                             isWinner = true;
//                         }

//                         bulkOps.push({ updateOne: { filter: { _id: currentTeam._id }, update: { $set: { totalPoints: currentTeam.totalPoints, rank: currentRank, isWinner, prizeWon, status: 'completed' } } } });
//                     }
                    
//                     if (bulkOps.length > 0) {
//                         await ContestParticipation.bulkWrite(bulkOps);
//                         console.log(`✅ Updated ${bulkOps.length} participations for contest ${contest._id}.`);
//                     }
//                 }

//                 await Contest.updateOne({ _id: contest._id }, { $set: { status: 'completed' } });
//             }

//             await RecentMatch.updateOne({ _id: match._id }, { $set: { resultsProcessed: true } });
//             console.log(`✅ Finished processing results for Match ${match._id}.`);
//         }
//     } catch (error) {
//         console.error('🔥 Critical error in calculateMatchResults cron:', error);
//     }
//     console.log(`[${new Date().toLocaleString()}] ✅ Match results calculation cron finished.`);
//     console.log('===========================================');
// };

// const start = () => {
//     // Check for an active Mongoose connection before scheduling the cron
//     if (mongoose.connection.readyState === 1) { // 1 means connected
//         cron.schedule('* * * * *', calculateMatchResults);
//         console.log('⏳ Cron scheduled: Match results calculation every minute.');
//     } else {
//         mongoose.connection.once('open', () => {
//             cron.schedule('* * * * *', calculateMatchResults);
//             console.log('⏳ Cron scheduled: Match results calculation every minute.');
//         });
//     }

//     mongoose.connection.on('error', err => {
//         console.error('❌ MongoDB connection error in match results cron:', err);
//     });
// };

// // Start the cron scheduling process
// start();

// module.exports = { start, calculateMatchResults }; // Export for potential manual triggering