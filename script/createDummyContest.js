const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Contest = require('../models/Contest');

dotenv.config();

async function createDummyContest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const match = "96127afb-1268-47ad-b4d0-62112b4709b2";

    const contest = new Contest({
      matchId: match,
      entryFee: 370,
      totalSpots: 3,
      filledSpots: 0,
      prize: 1000,
      title: 'Test Contest #1',
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
