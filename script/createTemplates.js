// File: scripts/createMegaContest90k.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path if necessary
require('dotenv').config();

// ✅ CORRECTED DISTRIBUTION: Prize pool of ₹90,000 distributed among the top 48 players (60% of 80)
const megaContestPrizeDistribution = [
    { "rank": 1, "amount": 25000 },
    { "rank": 2, "amount": 15000 },
    { "rank": 3, "amount": 10000 },
    { "rank": 4, "amount": 6000 },
    { "rank": 5, "amount": 4000 },
    { "rank": 6, "amount": 1500 },  { "rank": 7, "amount": 1500 },  { "rank": 8, "amount": 1500 },  { "rank": 9, "amount": 1500 },  { "rank": 10, "amount": 1500 },
    { "rank": 11, "amount": 800 },  { "rank": 12, "amount": 800 },  { "rank": 13, "amount": 800 },  { "rank": 14, "amount": 800 },  { "rank": 15, "amount": 800 },
    { "rank": 16, "amount": 800 },  { "rank": 17, "amount": 800 },  { "rank": 18, "amount": 800 },  { "rank": 19, "amount": 800 },  { "rank": 20, "amount": 800 },
    { "rank": 21, "amount": 500 },  { "rank": 22, "amount": 500 },  { "rank": 23, "amount": 500 },  { "rank": 24, "amount": 500 },  { "rank": 25, "amount": 500 },
    { "rank": 26, "amount": 500 },  { "rank": 27, "amount": 500 },  { "rank": 28, "amount": 500 },  { "rank": 29, "amount": 500 },  { "rank": 30, "amount": 500 },
    { "rank": 31, "amount": 500 },  { "rank": 32, "amount": 500 },  { "rank": 33, "amount": 500 },  { "rank": 34, "amount": 500 },  { "rank": 35, "amount": 500 },
    { "rank": 36, "amount": 500 },  { "rank": 37, "amount": 500 },  { "rank": 38, "amount": 500 },  { "rank": 39, "amount": 500 },  { "rank": 40, "amount": 500 },
    { "rank": 41, "amount": 500 },  { "rank": 42, "amount": 500 },  { "rank": 43, "amount": 500 },  { "rank": 44, "amount": 500 },  { "rank": 45, "amount": 500 },
    { "rank": 46, "amount": 500 },  { "rank": 47, "amount": 500 },  { "rank": 48, "amount": 500 }
];

const proContestPrizeDistribution = [
    { "rank": 1, "amount": 15000 },
    { "rank": 2, "amount": 10000 },
    { "rank": 3, "amount": 7500 },
    { "rank": 4, "amount": 5000 },
    { "rank": 5, "amount": 3000 },
    { "rank": 6, "amount": 1000 },
    { "rank": 7, "amount": 1000 },
    { "rank": 8, "amount": 1000 },
    { "rank": 9, "amount": 1000 },
    { "rank": 10, "amount": 1000 },
    { "rank": 11, "amount": 900 },
    { "rank": 12, "amount": 900 },
    { "rank": 13, "amount": 900 },
    { "rank": 14, "amount": 900 },
    { "rank": 15, "amount": 900 }
];
const createContestTemplate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected...');

        // Using findOneAndUpdate with upsert:true is a safe way to create or update a template.
        // It will find the template by its unique title and update it, or create it if it doesn't exist.
        await ContestTemplate.findOneAndUpdate(
            { title: "Mega Contest 50k (Top 60%)" },
            {
                $set: {
                    type: "MINI_GL",
                    entryFee: 2500,
                    totalSpots: 25,
                    prize: 50000,
                    matchType: "ALL",
                    prizeBreakupType: "fixedAmountSplit",
                    prizeDistribution: proContestPrizeDistribution,
                    isActive: true,
                    // ✅ --- ADDED THIS LINE ---
                    maxTeamsPerUser: 2 // Allows users to join with up to 10 different teams
                }
            },
            { upsert: true, new: true }
        );

        console.log(`✅ Successfully created or updated the "Mega Contest 90k (Top 60%)" template!`);

        mongoose.connection.close();
    } catch (error) {
        console.error('Error creating contest template:', error.message);
        process.exit(1);
    }
};

createContestTemplate();
