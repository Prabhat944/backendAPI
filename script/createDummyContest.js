// script/createDummyContest.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Contest = require('../models/Contest');

dotenv.config();

async function createDummyContest() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    const match = "8ec39b39-0b6c-4604-946c-5615dd5e8e6e";

    const contest = new Contest({
      // ✨ ADD THIS REQUIRED FIELD
      contestTemplateId: '683d57e401e83bd919a0063d', // <-- Provide a valid template ID

      matchId: match,
      entryFee: 370,
      totalSpots: 3,
      filledSpots: 0,
      prize: 1000,
      title: 'T20',
      participants: [],
      prizeBreakupType: 'winnerTakesAll',
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