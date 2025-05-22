const mongoose = require('mongoose');

const playerPerformanceSchema = new mongoose.Schema({
  playerId: { type: String, required: true },
  matchId: { type: String, required: true },
  format: { type: String, enum: ['Test', 'ODI', 'T20', 'T10'], required: true },

  batting: {
    runs: { type: Number, default: 0 },
    ballsFaced: { type: Number, default: 0 },
    fours: { type: Number, default: 0 },
    sixes: { type: Number, default: 0 },
    isDuck: { type: Boolean, default: false },
  },

  bowling: {
    wickets: { type: Number, default: 0 },
    overs: { type: Number, default: 0 },
    runsConceded: { type: Number, default: 0 },
    maidenOvers: { type: Number, default: 0 },
  },

  fielding: {
    catches: { type: Number, default: 0 },
    stumpings: { type: Number, default: 0 },
    runOuts: { type: Number, default: 0 },
  },

  points: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('PlayerPerformance', playerPerformanceSchema);
