const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  matchId: String,
  entryFee: Number,
  totalSpots: Number,
  filledSpots: { type: Number, default: 0 },
  prize: Number,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  baseContestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' }
});

module.exports = mongoose.model('Contest', contestSchema);
