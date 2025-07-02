// models/ContestTemplate.js

const mongoose = require('mongoose');

const contestTemplateSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['GRAND', 'MINI_GL', 'SMALL', 'H2H', 'WINNER_TAKE_ALL'], required: true },
  entryFee: { type: Number, required: true, min: 0 },
  totalSpots: { type: Number, required: true, min: 2 },
  prize: { type: Number, required: true, min: 0 },
  matchType: { type: String, enum: ['ALL', 'T20', 'ODI', 'TEST'], default: 'ALL' },
  
  maxTeamsPerUser: { type: Number, default: 1 },
  // REMOVE THIS FIELD: `allowSignupBonus` is now replaced by `signupBonusAllowedPercentage`
  // allowSignupBonus: { type: Boolean, default: false },

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
  // The correct field for controlling signup bonus usage
  signupBonusAllowedPercentage: {
    type: Number,
    default: 0, // 0% by default, meaning no signup bonus can be used
    min: 0,
    max: 100
  },
});

contestTemplateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('ContestTemplate', contestTemplateSchema);