// File: scripts/createAllH2hTemplates.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path if necessary
require('dotenv').config();

// Constants
const COMMISSION_RATE = 0.12;
const calculateH2H = (desiredPrize) => {
  const totalEntryAmount = desiredPrize / (1 - COMMISSION_RATE);
  const entryFeePerUser = Math.ceil(totalEntryAmount / 2);
  const actualPrize = Math.floor(entryFeePerUser * 2 * (1 - COMMISSION_RATE));
  const commission = (entryFeePerUser * 2) - actualPrize;
  return { entryFeePerUser, actualPrize, commission };
};

// ✅ 1. Your fixed old templates (do not change these)
const h2hTemplatesData = [
  { prize: 100, entryFee: 57, title: "H2H ₹100 Prize" },
  { prize: 150, entryFee: 86, title: "H2H ₹150 Prize" },
  { prize: 200, entryFee: 114, title: "H2H ₹200 Prize" },
  { prize: 300, entryFee: 172, title: "H2H ₹300 Prize" },
  { prize: 400, entryFee: 229, title: "H2H ₹400 Prize" },
  { prize: 500, entryFee: 286, title: "H2H ₹500 Prize" },
  { prize: 1500, entryFee: 857, title: "H2H ₹1.5k Prize" },
  { prize: 3000, entryFee: 1714, title: "H2H ₹3k Prize" },
  { prize: 4000, entryFee: 2286, title: "H2H ₹4k Prize" },
  // Aggressive
  { prize: 5000, entryFee: 2799, title: "H2H ₹5k Prize" },
  { prize: 10000, entryFee: 5599, title: "H2H ₹10k Prize" },
  { prize: 15000, entryFee: 8499, title: "H2H ₹15k Prize" },
  { prize: 19500, entryFee: 11143, title: "H2H ₹19.5k Prize" },
  { prize: 25000, entryFee: 14286, title: "H2H ₹25k Prize" },
];

// ✅ 2. New bonus-enabled templates (fixing logic)
const newBonusH2hTemplates = [
  { desiredPrize: 750, title: "H2H ₹750 Prize (5% Bonus)", signupBonusAllowedPercentage: 5 },
  { desiredPrize: 2000, title: "H2H ₹2k Prize (5% Bonus)", signupBonusAllowedPercentage: 5 },
  { desiredPrize: 7500, title: "H2H ₹7.5k Prize (5% Bonus)", signupBonusAllowedPercentage: 5 },
  { desiredPrize: 1000, title: "H2H ₹1k Prize (10% Bonus)", signupBonusAllowedPercentage: 10 },
  { desiredPrize: 2500, title: "H2H ₹2.5k Prize (10% Bonus)", signupBonusAllowedPercentage: 10 },
  { desiredPrize: 3500, title: "H2H ₹3.5k Prize (10% Bonus)", signupBonusAllowedPercentage: 10 },
  { desiredPrize: 6000, title: "H2H ₹6k Prize (10% Bonus)", signupBonusAllowedPercentage: 10 },
  { desiredPrize: 12000, title: "H2H ₹12k Prize (10% Bonus)", signupBonusAllowedPercentage: 10 },
];

const createAllH2hTemplates = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected...\n');

    // Step 1: Insert old templates (no logic change)
    for (const template of h2hTemplatesData) {
      await ContestTemplate.findOneAndUpdate(
        { title: template.title },
        {
          $set: {
            type: "H2H",
            entryFee: template.entryFee,
            totalSpots: 2,
            prize: template.prize,
            matchType: "ALL",
            prizeBreakupType: "winnerTakesAll",
            prizeDistribution: [],
            isActive: true,
            signupBonusAllowedPercentage: 0
          }
        },
        { upsert: true, new: true, runValidators: true }
      );
      console.log(`✅ Saved OLD template: ${template.title}`);
    }

    // Step 2: Create bonus templates using correct entry logic
    for (const config of newBonusH2hTemplates) {
      const { entryFeePerUser, actualPrize, commission } = calculateH2H(config.desiredPrize);

      await ContestTemplate.findOneAndUpdate(
        { title: config.title },
        {
          $set: {
            type: "H2H",
            entryFee: entryFeePerUser,
            totalSpots: 2,
            prize: actualPrize,
            matchType: "ALL",
            prizeBreakupType: "winnerTakesAll",
            prizeDistribution: [],
            isActive: true,
            signupBonusAllowedPercentage: config.signupBonusAllowedPercentage
          }
        },
        { upsert: true, new: true, runValidators: true }
      );

      console.log(`✅ Saved BONUS template: ${config.title} | Entry ₹${entryFeePerUser}, Prize ₹${actualPrize}, Comm ₹${commission.toFixed(2)}`);
    }

    console.log('\n🎉 All H2H templates processed successfully!');
    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

createAllH2hTemplates();
