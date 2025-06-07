const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Contest = require('../models/Contest');

dotenv.config();

async function createDummyContest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const match = "f48d1b78-4912-4967-9c1a-20e177a8d08d";

    const contest = new Contest({
      matchId: match,
      entryFee: 370,
      totalSpots: 3,
      filledSpots: 0,
      prize: 1000,
      title: 'T20',
      participants: [],
      prizeBreakupType: 'winnerTakesAll',  // <-- Set winner takes all here
      // Optionally, if you want a custom split, use this:
      // prizeBreakupType: 'top3Split',
      // customPrizeBreakup: [70, 20, 10],
    });

    await contest.save();
    console.log('✅ Dummy contest created:', contest._id);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating dummy contest:', err.message);
    process.exit(1);
  }
}

createDummyContest();
