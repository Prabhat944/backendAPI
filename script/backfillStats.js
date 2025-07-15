const mongoose = require('mongoose');
const ContestParticipation = require('../models/ContestParticipation');
const { calculateLifetimeStats, updateUserStatsInDB } = require('./jobs/statsEngine'); // We will create this file next

// --- Your MongoDB Connection String ---
const DB_URI = 'mongodb+srv://prabhatkumar944:Aot123456@adda11.yi6i6av.mongodb.net/fantsy11?retryWrites=true&w=majority&appName=adda11';

const runBackfill = async () => {
    console.log('Connecting to database...');
    await mongoose.connect(DB_URI);
    console.log('Database connected. Starting backfill process...');

    try {
        // Find all unprocessed contest participations
        const unprocessedEntries = await ContestParticipation.find({ statsProcessed: false }).lean();
        
        if (unprocessedEntries.length === 0) {
            console.log('No old data to process. All records are up-to-date.');
            return;
        }

        // Get a unique list of users who need their stats recalculated
        const userIdsToUpdate = [...new Set(unprocessedEntries.map(entry => entry.user.toString()))];
        
        console.log(`Found ${unprocessedEntries.length} unprocessed records for ${userIdsToUpdate.length} users. Recalculating...`);

        // Recalculate and save stats for each user
        for (const userId of userIdsToUpdate) {
            const statsData = await calculateLifetimeStats(new mongoose.Types.ObjectId(userId));
            await updateUserStatsInDB(userId, statsData);
            console.log(`[SUCCESS] Backfilled stats for user: ${userId}`);
        }

        // Mark all old entries as processed
        await ContestParticipation.updateMany(
            { statsProcessed: false },
            { $set: { statsProcessed: true } }
        );

        console.log('--- Backfill Complete! All historical data has been processed. ---');

    } catch (error) {
        console.error('An error occurred during the backfill process:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Database disconnected.');
    }
};

runBackfill();