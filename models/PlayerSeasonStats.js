// models/PlayerSeasonStats.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const playerSeasonStatsSchema = new Schema({
    playerId: {
        type: String, // Or ObjectId if you have a Player model
        required: true,
        index: true // Index for efficient lookups by player
    },
    playerName: { // For display purposes, denormalized
        type: String,
        required: true
    },
    playerImg: { // For display purposes, denormalized
        type: String,
        default: ''
    },
    // The "season" or "series" that these points belong to
    // You MUST have a way to identify a season/series (e.g., IPL 2024, CPL 2025)
    // This could be seriesId if your matches belong to series.
    seasonId: {
        type: String, // Or ObjectId if you have a Series model
        required: true,
        index: true
    },
    seasonName: { // e.g., "IPL 2025", "Big Bash League"
        type: String,
        required: true
    },
    totalMatchesPlayed: {
        type: Number,
        default: 0
    },
    totalPoints: { // Sum of basePoints from all matches played in this season
        type: Number,
        default: 0
    },
    averagePoints: { // totalPoints / totalMatchesPlayed
        type: Number,
        default: 0
    },
    // Optional: breakdown of roles played across the season
    rolesPlayed: [{ type: String }], // e.g., ['Batsman', 'Bowler', 'All-Rounder']
    
}, { timestamps: true });

// Compound index to ensure uniqueness per player per season and for efficient queries
playerSeasonStatsSchema.index({ playerId: 1, seasonId: 1 }, { unique: true });

module.exports = mongoose.model('PlayerSeasonStats', playerSeasonStatsSchema);