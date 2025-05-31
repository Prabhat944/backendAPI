const mongoose = require('mongoose');

const contestSchema = new mongoose.Schema({
  matchId: String,
  entryFee: Number,
  totalSpots: Number,
  filledSpots: { type: Number, default: 0 },
  prize: Number,
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  baseContestId: { type: mongoose.Schema.Types.ObjectId, ref: 'Contest' },

  prizeBreakupType: {
    type: String,
    enum: ['winnerTakesAll', 'top3Split'],
    default: 'winnerTakesAll',
  },
  customPrizeBreakup: {
    type: [Number], // e.g. [70, 20, 10]
    default: [],
  }
});

module.exports = mongoose.model('Contest', contestSchema);
