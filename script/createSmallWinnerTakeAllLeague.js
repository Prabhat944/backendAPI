// File: scripts/createWinnerTakeAllTemplates.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path if necessary
require('dotenv').config();

// Configuration for all 3-Member "Winner Take All" contests
const threeMemberTemplates = [
    { prize: 100,    entryFee: 38,    title: "3-Member WTA ₹100" },
    { prize: 150,    entryFee: 57,    title: "3-Member WTA ₹150" },
    { prize: 200,    entryFee: 76,    title: "3-Member WTA ₹200" },
    { prize: 300,    entryFee: 114,   title: "3-Member WTA ₹300" },
    { prize: 400,    entryFee: 153,   title: "3-Member WTA ₹400" },
    { prize: 500,    entryFee: 191,   title: "3-Member WTA ₹500" },
    // ✅ NEW: Added the 1k prize contest with the new fee
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

// Configuration for all 4-Member "Winner Take All" contests
const fourMemberTemplates = [
    { prize: 100,    entryFee: 29,    title: "4-Member WTA ₹100" },
    { prize: 150,    entryFee: 43,    title: "4-Member WTA ₹150" },
    { prize: 200,    entryFee: 57,    title: "4-Member WTA ₹200" },
    { prize: 300,    entryFee: 86,    title: "4-Member WTA ₹300" },
    { prize: 400,    entryFee: 114,   title: "4-Member WTA ₹400" },
    { prize: 500,    entryFee: 143,   title: "4-Member WTA ₹500" },
    // ✅ NEW: Added the 1k prize contest with the new fee
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


const createWinnerTakeAllTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected...');

        const allTemplates = [...threeMemberTemplates, ...fourMemberTemplates];

        for (const templateData of allTemplates) {
            const totalSpots = templateData.title.startsWith('3-Member') ? 3 : 4;

            await ContestTemplate.findOneAndUpdate(
                { title: templateData.title }, // Find by a unique field like title
                {
                    $set: {
                        type: "WINNER_TAKE_ALL", // ✅ Correctly sets the type
                        entryFee: templateData.entryFee,
                        totalSpots: totalSpots,
                        prize: templateData.prize,
                        matchType: "ALL",
                        prizeBreakupType: "winnerTakesAll",
                        prizeDistribution: [],
                        isActive: true
                    }
                },
                { upsert: true, new: true }
            );
            console.log(`✅ Successfully created or updated template: ${templateData.title}`);
        }

        console.log('\nAll 3-member and 4-member contest templates have been processed!');
        mongoose.connection.close();
    } catch (error) {
        console.error('Error creating contest templates:', error.message);
        process.exit(1);
    }
};

// Run the function to create all the templates
createWinnerTakeAllTemplates();
