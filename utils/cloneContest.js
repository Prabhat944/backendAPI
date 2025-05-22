const Contest = require('../models/Contest');

/**
 * Clones a given base contest.
 * @param {Object} baseContest - The original contest to be cloned.
 * @returns {Promise<Object>} - The newly created contest document.
 */
const cloneContest = async (baseContest) => {
  if (!baseContest || !baseContest._id) {
    throw new Error('Invalid base contest passed for cloning');
  }

  const newContest = new Contest({
    matchId: baseContest.matchId,
    entryFee: baseContest.entryFee,
    totalSpots: baseContest.totalSpots,
    filledSpots: 0,
    prize: baseContest.prize,
    participants: [],
    baseContestId: baseContest._id,
  });

  try {
    const saved = await newContest.save();
    console.log(`✅ Cloned new contest from base: ${baseContest._id} → ${saved._id}`);
    return saved;
  } catch (error) {
    console.error('❌ Error cloning contest:', error.message);
    throw error;
  }
};

module.exports = { cloneContest };
