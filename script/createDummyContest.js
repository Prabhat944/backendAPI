// scripts/createDummyContest.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Contest = require('../models/Contest');
// const Match = require('../models/Match'); // or wherever your Match model is

dotenv.config(); // if you're using .env for DB_URI

async function createDummyContest() {
  try {
    await mongoose.connect(process.env.MONGO_URI); // make sure .env has MONGO_URI

    // 🧪 Find any match to use its ID
    const match = "7de732eb-6821-492b-ace7-3f385b852719"; // or hardcode the matchId if you already have one
    // if (!match) throw new Error('No match found in DB');

    const contest = new Contest({
      matchId: match,
      entryFee: 370,
      totalSpots: 3,
      filledSpots: 0,
      prize: 1000,
      title: 'Test Contest #1',
      participants: [],
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
