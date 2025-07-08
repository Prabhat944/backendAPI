// File: scripts/createTeamContestTemplates.js

const mongoose = require('mongoose');
const ContestTemplate = require('../models/ContestTemplate');
require('dotenv').config();

// --- Main Configuration ---

// Your standard 12% commission rate
const COMMISSION_RATE = 0.12;

/**
 * Calculates the entry fee and actual prize for a team contest.
 * @param {number} desiredPrize - The prize pool you want to offer.
 * @param {number} totalSpots - The total number of players in the contest.
 * @returns {object} - Contains the calculated entryFeePerUser and actualPrize.
 */
const calculateTeamContest = (desiredPrize, totalSpots) => {
  if (totalSpots <= 0) return { entryFeePerUser: 0, actualPrize: 0, commission: 0 };
  const totalEntryAmount = desiredPrize / (1 - COMMISSION_RATE);
  const entryFeePerUser = Math.ceil(totalEntryAmount / totalSpots);
  const actualPrize = Math.floor(entryFeePerUser * totalSpots * (1 - COMMISSION_RATE));
  const commission = (entryFeePerUser * totalSpots) - actualPrize;
  return { entryFeePerUser, actualPrize, commission };
};

// --- Template Definitions ---
// ✅ Easily add or modify your Team Contests here!
const teamContestTemplatesData = [
  {
    desiredPrize: 1000,
    title: "Team Battle ₹1k Prize",
    teamContestConfig: { teams: 2, spotsPerTeam: 2 }, // 4 spots total
    maxTeamsPerUser: 2,
    signupBonusAllowedPercentage: 5,
  },
  {
    desiredPrize: 2000,
    title: "Team Battle ₹2k Prize",
    teamContestConfig: { teams: 2, spotsPerTeam: 2 }, // 4 spots total
    maxTeamsPerUser: 2,
    signupBonusAllowedPercentage: 5,
  },
  {
    desiredPrize: 5000,
    title: "Team Battle ₹5k Prize",
    teamContestConfig: { teams: 2, spotsPerTeam: 2 }, // 4 spots total
    maxTeamsPerUser: 2,
    signupBonusAllowedPercentage: 10,
  },
  {
    desiredPrize: 10000,
    title: "Team Battle ₹10k Prize",
    teamContestConfig: { teams: 2, spotsPerTeam: 2 }, // 4 spots total
    maxTeamsPerUser: 2,
    signupBonusAllowedPercentage: 10,
  },
  {
    desiredPrize: 3000,
    title: "Team Squads (3v3)", // 3 vs 3 contest
    teamContestConfig: { teams: 2, spotsPerTeam: 3 }, // 6 spots total
    maxTeamsPerUser: 3,
    signupBonusAllowedPercentage: 5,
  },
  {
    desiredPrize: 7500,
    title: "Team Squads ₹7.5k Prize (3v3)",
    teamContestConfig: { teams: 2, spotsPerTeam: 3 }, // 6 spots total
    maxTeamsPerUser: 3,
    signupBonusAllowedPercentage: 10,
  }
];

const createTemplates = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected...\n');

        // Loop through the configuration array and create each template
        for (const config of teamContestTemplatesData) {
            
            const totalSpots = config.teamContestConfig.teams * config.teamContestConfig.spotsPerTeam;
            const { entryFeePerUser, actualPrize, commission } = calculateTeamContest(config.desiredPrize, totalSpots);

            await ContestTemplate.findOneAndUpdate(
                { title: config.title },
                {
                    $set: {
                        type: "TEAM_CONTEST",
                        entryFee: entryFeePerUser,
                        totalSpots: totalSpots,
                        prize: actualPrize,
                        prizeBreakupType: "winnerTakesAll",
                        prizeDistribution: [],
                        isActive: true,
                        maxTeamsPerUser: config.maxTeamsPerUser,
                        signupBonusAllowedPercentage: config.signupBonusAllowedPercentage,
                        teamContestConfig: config.teamContestConfig
                    }
                },
                { upsert: true, new: true, runValidators: true }
            );

            console.log(`✅ Saved Template: ${config.title} | Entry: ₹${entryFeePerUser}, Prize: ₹${actualPrize}, Spots: ${totalSpots}`);
        }

        console.log('\n🎉 All Team Contest templates processed successfully!');
        mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
};

createTemplates();