// File: scripts/createWinnerTakeAllTemplates.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path if necessary
require('dotenv').config();

// --- Main Configuration ---

// Commission rate is the same as your H2H script
const COMMISSION_RATE = 0.12; 

// A new, generic function to calculate entry fees and prizes for any number of spots
const calculateWTA = (desiredPrize, totalSpots) => {
  const totalEntryAmount = desiredPrize / (1 - COMMISSION_RATE);
  const entryFeePerUser = Math.ceil(totalEntryAmount / totalSpots);
  const actualPrize = Math.floor(entryFeePerUser * totalSpots * (1 - COMMISSION_RATE));
  const commission = (entryFeePerUser * totalSpots) - actualPrize;
  return { entryFeePerUser, actualPrize, commission };
};

// --- Template Definitions ---

// ✅ 1. Your fixed old templates (These will not be changed)
const threeMemberTemplates = [
    { prize: 100,    entryFee: 38,    title: "3-Member WTA ₹100" },
    { prize: 150,    entryFee: 57,    title: "3-Member WTA ₹150" },
    { prize: 200,    entryFee: 76,    title: "3-Member WTA ₹200" },
    { prize: 300,    entryFee: 114,   title: "3-Member WTA ₹300" },
    { prize: 400,    entryFee: 153,   title: "3-Member WTA ₹400" },
    { prize: 500,    entryFee: 191,   title: "3-Member WTA ₹500" },
    { prize: 1000,   entryFee: 380,   title: "3-Member WTA ₹1k" },
    { prize: 1500,   entryFee: 571,   title: "3-Member WTA ₹1.5k" },
    { prize: 3000,   entryFee: 1143,  title: "3-Member WTA ₹3k" },
    { prize: 4000,   entryFee: 1524,  title: "3-Member WTA ₹4k" },
    { prize: 5000,   entryFee: 1905,  title: "3-Member WTA ₹5k" },
    { prize: 10000,  entryFee: 3700,  title: "3-Member WTA ₹10k" },
    { prize: 15000,  entryFee: 5800,  title: "3-Member WTA ₹15k" },
    { prize: 19500,  entryFee: 7429,  title: "3-Member WTA ₹19.5k" },
    { prize: 25000,  entryFee: 9600,  title: "3-Member WTA ₹25k" }
];

const fourMemberTemplates = [
    { prize: 100,    entryFee: 29,    title: "4-Member WTA ₹100" },
    { prize: 150,    entryFee: 43,    title: "4-Member WTA ₹150" },
    { prize: 200,    entryFee: 57,    title: "4-Member WTA ₹200" },
    { prize: 300,    entryFee: 86,    title: "4-Member WTA ₹300" },
    { prize: 400,    entryFee: 114,   title: "4-Member WTA ₹400" },
    { prize: 500,    entryFee: 143,   title: "4-Member WTA ₹500" },
    { prize: 1000,   entryFee: 280,   title: "4-Member WTA ₹1k" },
    { prize: 1500,   entryFee: 429,   title: "4-Member WTA ₹1.5k" },
    { prize: 3000,   entryFee: 857,   title: "4-Member WTA ₹3k" },
    { prize: 4000,   entryFee: 1143,  title: "4-Member WTA ₹4k" },
    { prize: 5000,   entryFee: 1429,  title: "4-Member WTA ₹5k" },
    { prize: 10000,  entryFee: 2840,  title: "4-Member WTA ₹10k" },
    { prize: 15000,  entryFee: 4286,  title: "4-Member WTA ₹15k" },
    { prize: 19500,  entryFee: 5571,  title: "4-Member WTA ₹19.5k" },
    { prize: 25000,  entryFee: 7143,  title: "4-Member WTA ₹25k" }
];

// ✅ 2. New bonus-enabled templates (you can add or change these as you like)
const newBonusThreeMemberTemplates = [
    { desiredPrize: 750, title: "3-Member WTA ₹750 (5% Bonus)", signupBonusAllowedPercentage: 5 },
    { desiredPrize: 2000, title: "3-Member WTA ₹2k (5% Bonus)", signupBonusAllowedPercentage: 5 },
    { desiredPrize: 1000, title: "3-Member WTA ₹1k (10% Bonus)", signupBonusAllowedPercentage: 10 },
    { desiredPrize: 3500, title: "3-Member WTA ₹3.5k (10% Bonus)", signupBonusAllowedPercentage: 10 },
];

const newBonusFourMemberTemplates = [
    { desiredPrize: 750, title: "4-Member WTA ₹750 (5% Bonus)", signupBonusAllowedPercentage: 5 },
    { desiredPrize: 2000, title: "4-Member WTA ₹2k (5% Bonus)", signupBonusAllowedPercentage: 5 },
    { desiredPrize: 1000, title: "4-Member WTA ₹1k (10% Bonus)", signupBonusAllowedPercentage: 10 },
    { desiredPrize: 3500, title: "4-Member WTA ₹3.5k (10% Bonus)", signupBonusAllowedPercentage: 10 },
];


const createWinnerTakeAllTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB connected...\n');

        // --- Step 1: Process OLD templates (no changes to your original logic) ---
        const allOldTemplates = [...threeMemberTemplates, ...fourMemberTemplates];
        for (const templateData of allOldTemplates) {
            const totalSpots = templateData.title.startsWith('3-Member') ? 3 : 4;
            await ContestTemplate.findOneAndUpdate(
                { title: templateData.title },
                {
                    $set: {
                        type: "WINNER_TAKE_ALL",
                        entryFee: templateData.entryFee,
                        totalSpots: totalSpots,
                        prize: templateData.prize,
                        matchType: "ALL",
                        prizeBreakupType: "winnerTakesAll",
                        prizeDistribution: [],
                        isActive: true,
                        signupBonusAllowedPercentage: 0 // Explicitly set to 0 for old templates
                    }
                },
                { upsert: true, new: true, runValidators: true }
            );
            console.log(`✅ Saved OLD template: ${templateData.title}`);
        }

        // --- Step 2: Process NEW bonus-enabled templates ---
        const allNewBonusTemplates = [
            ...newBonusThreeMemberTemplates.map(t => ({ ...t, totalSpots: 3 })),
            ...newBonusFourMemberTemplates.map(t => ({ ...t, totalSpots: 4 }))
        ];

        console.log('\n--- Processing new bonus templates ---\n');

        for (const config of allNewBonusTemplates) {
            const { entryFeePerUser, actualPrize, commission } = calculateWTA(config.desiredPrize, config.totalSpots);

            await ContestTemplate.findOneAndUpdate(
                { title: config.title },
                {
                    $set: {
                        type: "WINNER_TAKE_ALL",
                        entryFee: entryFeePerUser,
                        totalSpots: config.totalSpots,
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
            console.log(`✅ Saved BONUS template: ${config.title} | Spots: ${config.totalSpots}, Entry: ₹${entryFeePerUser}, Prize: ₹${actualPrize}, Comm: ₹${commission.toFixed(2)}`);
        }


        console.log('\n🎉 All Winner Take All templates processed successfully!');
        mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error creating contest templates:', error.message);
        process.exit(1);
    }
};

// Run the function to create all the templates
createWinnerTakeAllTemplates();