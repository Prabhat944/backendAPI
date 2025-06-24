const Contest = require('../models/Contest');

/**
 * Clones a given base contest robustly.
 * @param {Object} baseContest - The original Mongoose contest document to be cloned.
 * @returns {Promise<Object>} - The newly created and saved contest document.
 */
const cloneContest = async (baseContest) => {
  if (!baseContest || !baseContest._id) {
    throw new Error('Invalid base contest passed for cloning');
  }

  // Convert the Mongoose document to a plain JavaScript object
  // This copies all the fields like title, contestTemplateId, prizeBreakupType, etc.
  const contestData = baseContest.toObject();

  // Create the new contest object
  const newContest = new Contest({
    ...contestData, // 1. Spread all fields from the original contest

    // 2. IMPORTANT: Override the fields that MUST be different for a clone
    _id: undefined,         // Let Mongoose generate a fresh, unique _id
    filledSpots: 0,         // Reset the spots
    participants: [],       // Reset the participants
    status: 'upcoming',     // Ensure the status is reset
    createdAt: undefined,   // Let Mongoose set new timestamps
    updatedAt: undefined,
    __v: undefined,
    
    // 3. Point to the original base contest ID.
    // If the baseContest already has a baseContestId, use it. Otherwise, use the baseContest's own _id.
    baseContestId: contestData.baseContestId || contestData._id,
  });

  try {
    const saved = await newContest.save();
    console.log(`✅ Cloned new contest from base: ${baseContest._id} → ${saved._id}`);
    return saved;
  } catch (error) {
    // The error message from Mongoose will be very specific.
    console.error('❌ Error cloning contest:', error.message);
    throw error;
  }
};

module.exports = { cloneContest };