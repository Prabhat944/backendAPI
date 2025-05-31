const Player = require('../models/Player');
const Series = require('../models/Series');
const { matchSquad } = require('../services/cricketService');

const savePlayersForMatch = async (matchId, seriesId) => {
  const { squad } = await matchSquad(matchId);

  for (const team of squad) {
    for (const player of team.players) {
      await Player.updateOne(
        { playerId: player.id, seriesId },
        {
          playerId: player.id,
          name: player.name,
          image: player.image,
          role: player.role,
          teamName: team.name,
          seriesId,
        },
        { upsert: true }
      );
    }
  }
};

module.exports = savePlayersForMatch;
