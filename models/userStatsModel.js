const mongoose = require('mongoose');

const userStatsSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true, // Ensures one stats document per user
    },
    totalContestsParticipated: { type: Number, default: 0 },
    totalMatchesPlayed: { type: Number, default: 0 },
    totalWins: { type: Number, default: 0 },
    totalLosses: { type: Number, default: 0 },
    totalWinning: { type: Number, default: 0 },
    winningPercentage: { type: Number, default: 0 },
    lastCalculated: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

const UserStats = mongoose.model('UserStats', userStatsSchema);

module.exports = UserStats;