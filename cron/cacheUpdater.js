const cron = require('node-cron');
const redisClient = require('../utils/redisClient'); // Your Redis client from the previous step
const Match = require('../models/UpcomingMatches'); // Your Mongoose Match model

/**
 * Fetches upcoming matches from MongoDB and caches them in Redis.
 * This function will be executed by the cron scheduler.
 */
const cacheUpcomingMatches = async () => {
  console.log('--- 🏃 Running cron job: Caching upcoming matches ---');
  try {
    // 1. Fetch fresh data from MongoDB
    // Get matches happening in the future, sort by date, limit to a reasonable number.
    const upcomingMatches = await Match.find({
      dateTimeGMT: { $gt: new Date() }
    })
    .sort({ dateTimeGMT: 'asc' })
    .limit(50) // Cache the next 50 upcoming matches
    .lean(); // .lean() makes the query much faster as it returns plain JS objects

    if (upcomingMatches.length > 0) {
      // 2. Save the data to Redis
      // We use SETEX to set the data with an automatic expiration time (e.g., 10 minutes).
      // This ensures the cache doesn't become stale if the cron job fails.
      const cacheKey = 'cache:upcoming_matches';
      const cacheValue = JSON.stringify(upcomingMatches);
      const expirationInSeconds = 10 * 60; // 10 minutes

      await redisClient.setEx(cacheKey, expirationInSeconds, cacheValue);
      console.log(`✅ Successfully cached ${upcomingMatches.length} upcoming matches.`);
    } else {
      console.log('No upcoming matches found to cache.');
    }

  } catch (error) {
    console.error('❌ Error during upcoming matches cron job:', error);
  } finally {
    console.log('--- Cron job finished ---');
  }
};

/**
 * Initializes and starts the cron job scheduler.
 */
const start = () => {
  // This cron expression means "run this task every 5 minutes".
  cron.schedule('*/5 * * * *', cacheUpcomingMatches);
  
  // Optional: Run the job once immediately on server start
  cacheUpcomingMatches();
};

module.exports = {
  start
};