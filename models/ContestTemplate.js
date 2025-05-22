const mongoose = require('mongoose');

const contestTemplateSchema = new mongoose.Schema({
  type: { type: String, enum: ['GRAND', 'MEDIUM', 'SMALL'], required: true },
  entryFee: Number,
  totalSpots: Number,
  prize: Number,
  matchType: { type: String, enum: ['ALL', 'T20', 'ODI', 'TEST'], default: 'ALL' },
});

module.exports = mongoose.model('ContestTemplate', contestTemplateSchema);
