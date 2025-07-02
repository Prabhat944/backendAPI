const PlayerSeasonStats = require('../models/PlayerSeasonStats');
const RecentMatch = require('../models/RecentMatch');
const Series = require('../models/UpcomingSeries');

const updatePlayerSeasonStats = async (matchId, matchPlayersData) => {
  console.log(`[Player Stats Service] Updating season stats for match: ${matchId}`);

  try {
    const match = await RecentMatch.findOne({ _id: matchId }).select('series_id').lean();
    if (!match || !match.series_id) {
      console.warn(`[⚠️ Series Info Missing] Cannot update player season stats for match ${matchId}`);
      return;
    }

    const series = await Series.findOne({ _id: match.series_id }).select('name').lean();
    if (!series || !series.name) {
      console.warn(`[⚠️ Series Name Missing] Cannot update stats - series not found for ${match.series_id}`);
      return;
    }

    const seasonId = match.series_id;
    const seasonName = series.name;

    if (!Array.isArray(matchPlayersData) || matchPlayersData.length === 0) {
      console.warn(`[⚠️ No player data provided for match: ${matchId}]`);
      return;
    }

    for (const player of matchPlayersData) {
      const { playerId, name, playerImg = '', basePoints, role } = player;

      if (basePoints == null || isNaN(basePoints)) {
        console.warn(`[⚠️ Invalid basePoints] Skipping player ${playerId}`);
        continue;
      }

      try {
        await PlayerSeasonStats.updateOne(
          { playerId, seasonId },
          [
            {
              $set: {
                playerName: name,
                playerImg: playerImg,
                seasonName: seasonName,
                rolesPlayed: {
                  $setUnion: [
                    { $ifNull: ['$rolesPlayed', []] },
                    [role]
                  ]
                },
                totalPoints: {
                  $add: [{ $ifNull: ['$totalPoints', 0] }, basePoints]
                },
                totalMatchesPlayed: {
                  $add: [{ $ifNull: ['$totalMatchesPlayed', 0] }, 1]
                },
                averagePoints: {
                  $round: [
                    {
                      $cond: [
                        {
                          $eq: [
                            { $add: [{ $ifNull: ['$totalMatchesPlayed', 0] }, 1] },
                            0
                          ]
                        },
                        0,
                        {
                          $divide: [
                            { $add: [{ $ifNull: ['$totalPoints', 0] }, basePoints] },
                            { $add: [{ $ifNull: ['$totalMatchesPlayed', 0] }, 1] }
                          ]
                        }
                      ]
                    },
                    2
                  ]
                }
              }
            }
          ],
          { upsert: true }
        );        

        console.log(`✅ Updated stats for ${name} (${playerId}) | +${basePoints} pts`);

      } catch (updateErr) {
        console.error(`[❌ Error] Updating ${playerId} in ${seasonName}:`, updateErr);
      }
    }

    console.log(`[✔️ DONE] Player season stats updated for match ${matchId}`);

  } catch (error) {
    console.error(`[❌ Global Error] During season stats update for match ${matchId}:`, error);
  }
};

module.exports = {
  updatePlayerSeasonStats
};
