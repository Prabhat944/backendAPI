// File: scripts/createAllH2hTemplates.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate'); // Adjust path if necessary
require('dotenv').config();

// The final, complete configuration for all H2H contests.
// Includes standard ~12.5% rake and aggressive pricing for popular high-stakes contests.
const h2hTemplatesData = [
    { prize: 100,    entryFee: 57,     title: "H2H ₹100 Prize" },
    { prize: 150,    entryFee: 86,     title: "H2H ₹150 Prize" },
    { prize: 200,    entryFee: 114,    title: "H2H ₹200 Prize" },
    { prize: 300,    entryFee: 172,    title: "H2H ₹300 Prize" },
    { prize: 400,    entryFee: 229,    title: "H2H ₹400 Prize" },
    { prize: 500,    entryFee: 286,    title: "H2H ₹500 Prize" },
    { prize: 1500,   entryFee: 857,    title: "H2H ₹1.5k Prize" },
    { prize: 3000,   entryFee: 1714,   title: "H2H ₹3k Prize" },
    { prize: 4000,   entryFee: 2286,   title: "H2H ₹4k Prize" },
    // --- Aggressive Pricing Tier ---
    { prize: 5000,   entryFee: 2799,   title: "H2H ₹5k Prize" },
    { prize: 10000,  entryFee: 5599,   title: "H2H ₹10k Prize" },
    { prize: 15000,  entryFee: 8499,   title: "H2H ₹15k Prize" },
    // --- End Aggressive Tier ---
    { prize: 19500,  entryFee: 11143,  title: "H2H ₹19.5k Prize" },
    { prize: 25000,  entryFee: 14286,  title: "H2H ₹25k Prize" }
];


const createAllH2hTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected...');

        for (const templateData of h2hTemplatesData) {
            // Using findOneAndUpdate with upsert is a safe way to add or update templates
            // without creating duplicates if the script is run multiple times.
            await ContestTemplate.findOneAndUpdate(
                { title: templateData.title }, // Find by the unique title
                {
                    $set: {
                        type: "H2H",
                        entryFee: templateData.entryFee,
                        totalSpots: 2,
                        prize: templateData.prize,
                        matchType: "ALL",
                        prizeBreakupType: "winnerTakesAll",
                        prizeDistribution: [],
                        isActive: true
                    }
                },
                { upsert: true, new: true } // Creates the doc if it doesn't exist, otherwise updates
            );
            console.log(`✅ Successfully processed template: ${templateData.title}`);
        }

        console.log('\nAll H2H contest templates have been created or updated!');
        mongoose.connection.close();
    } catch (error) {
        console.error('Error creating H2H contest templates:', error.message);
        process.exit(1);
    }
};

// Run the function to execute the script
createAllH2hTemplates();
