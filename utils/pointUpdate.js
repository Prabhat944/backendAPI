/**
 * Calculates total points for a single team based on all player performances in a match.
 * @param {object} team - A user's team object containing { players, captain, viceCaptain }.
 * @param {Array} playerPerformances - An array of all player performance documents for the relevant match.
 * @returns {object} - An object containing the calculated { totalPoints, playersWithPoints }.
 */
function calculateTeamPoints(team, playerPerformances) {
    const CAPTAIN_MULTIPLIER = 2;
    const VICE_CAPTAIN_MULTIPLIER = 1.5;
  
    let totalPoints = 0;
  
    // Map through the players on the user's team
    const playersWithPoints = team.players.map(playerId => {
      // Find the performance record for this specific player
      const performance = playerPerformances.find(p => p.playerId.toString() === playerId.toString());
      const basePoints = performance ? performance.points : 0;
      let finalPoints = basePoints;
      let role = null;
  
      // Apply captain/vice-captain multipliers
      if (playerId.toString() === team.captain.toString()) {
        finalPoints = basePoints * CAPTAIN_MULTIPLIER;
        role = 'Captain';
      } else if (playerId.toString() === team.viceCaptain.toString()) {
        finalPoints = basePoints * VICE_CAPTAIN_MULTIPLIER;
        role = 'Vice-Captain';
      }
  
      totalPoints += finalPoints;
  
      return {
        playerId: playerId,
        // displayName: performance?.name || 'N/A', // Using displayName as discussed
        points: finalPoints,
        basePoints: basePoints,
        role: role,
      };
    });
  
    return { totalPoints, playersWithPoints };
  }
  
  module.exports = { calculateTeamPoints };