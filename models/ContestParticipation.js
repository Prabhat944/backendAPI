// const mongoose = require('mongoose');

// const contestParticipationSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   matchId: {
//     type: String,
//     required: true
//   },
//   contestId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Contest',
//     required: true
//   },
//   teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
//   contestTeam: { type: String },
//   joinedAt: {
//     type: Date,
//     default: Date.now
//   },
//   totalPoints: {
//     type: Number,
//     default: 0
//   },
//   rank: {
//     type: Number,
//     default: null
//   },
//   isWinner: {
//     type: Boolean,
//     default: false
//   },
//   prizeWon: {
//     type: Number,
//     default: 0,
//   },
//   deductionBreakdown: {
//     type: Object,
//     default: {}
//   },
//   status: {
//     type: String,
//     enum: ['joined', 'refunded', 'won', 'lost', 'pending_result'],
//     default: 'joined'
//   },
//   isWinningCredited: { type: Boolean, default: false },
//   transactionId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'WalletTransaction'
//   },
//   {
//     timestamps: true,
//     collection: 'contestparticipations', // This is now in the correct place
//   },
// });

// // In contestParticipationSchema.js
// contestParticipationSchema.index({ user: 1, matchId: 1, contestId: 1, teamId: 1 }, { unique: true });

// module.exports = mongoose.model('ContestParticipation', contestParticipationSchema);

const mongoose = require('mongoose');

const contestParticipationSchema = new mongoose.Schema(
  // --- Argument 1: An object with all your fields ---
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    matchId: {
      type: String,
      required: true
    },
    contestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Contest',
      required: true
    },
    teamId: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', required: true },
    contestTeam: { type: String },
    joinedAt: {
      type: Date,
      default: Date.now
    },
    totalPoints: {
      type: Number,
      default: 0
    },
    rank: {
      type: Number,
      default: null
    },
    isWinner: {
      type: Boolean,
      default: false
    },
    prizeWon: {
      type: Number,
      default: 0,
    },
    deductionBreakdown: {
      type: Object,
      default: {}
    },
    status: {
      type: String,
      enum: ['joined', 'refunded', 'won', 'lost', 'pending_result'],
      default: 'joined'
    },
    isWinningCredited: { type: Boolean, default: false },
    transactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction'
    },
    statsProcessed: {
      type: Boolean,
      default: false,
      index: true // Add an index for faster database lookups
  },
  },
  // --- Argument 2: A separate object for all options ---
  {
    timestamps: true,
    collection: 'contestparticipations' // This is now in the correct place
  }
);

// Your index definition remains the same
contestParticipationSchema.index({ user: 1, matchId: 1, contestId: 1, teamId: 1 }, { unique: true });

module.exports = mongoose.model('ContestParticipation', contestParticipationSchema);