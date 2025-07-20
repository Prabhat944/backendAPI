const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerLeaderboardSchema = new Schema({
    playerId: { type: String, required: true },
    name: { type: String, required: true },
    points: { type: Number, default: 0 },
    playerImage: { type: String, default: '' },
    role: { type: String, default: '' },
}, { _id: false }); // _id is not needed for this sub-document

const MatchLeaderboardSchema = new Schema({
    // Use the matchId string (e.g., 'c70e3c23-...') as the primary identifier
    matchId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    leaderboard: [PlayerLeaderboardSchema],
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('MatchLeaderboard', MatchLeaderboardSchema);