// models/ContestTemplate.js
const mongoose = require('mongoose');

const contestTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['GRAND', 'MINI_GL', 'SMALL', 'H2H', 'WINNER_TAKE_ALL'], required: true },
  entryFee: { type: Number, required: true, min: 0 },
  totalSpots: { type: Number, required: true, min: 2 },
  prize: { type: Number, required: true, min: 0 },
  matchType: { type: String, enum: ['ALL', 'T20', 'ODI', 'TEST'], default: 'ALL' },
  
  // ✅ --- NEW FIELD ---
  // This field will control how many teams a single user can join a contest with.
  // Default is 1, which maintains the current behavior for all your existing H2H and other contests.
  maxTeamsPerUser: { type: Number, default: 1 },

  prizeBreakupType: {
    type: String,
    enum: ['winnerTakesAll', 'percentageSplit', 'fixedAmountSplit'],
    required: true,
    default: 'winnerTakesAll',
  },
  prizeDistribution: { 
    type: mongoose.Schema.Types.Mixed,
    default: [],
   },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

contestTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ContestTemplate', contestTemplateSchema);
