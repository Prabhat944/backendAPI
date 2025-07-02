// Example: userProfileController.js (or wherever you prefer to keep this logic)

const User = require('../models/userModel'); // Adjust this path to your User model
const ContestParticipation = require('../models/ContestParticipation'); // Adjust this path to your ContestParticipation model

/**
 * Calculates various statistics for a given user based on their ContestParticipation records.
 * @param {mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Object} An object containing user stats.
 */
const calculateUserStats = async (userId) => {
  // Calculate total unique matches played
  // Groups ContestParticipation entries by matchId to count unique matches.
  const uniqueMatchesPlayedResult = await ContestParticipation.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$matchId' } }, // Group by matchId to get unique match IDs
    { $count: 'totalMatches' }      // Count the number of unique matches
  ]);
  const totalMatchesPlayed = uniqueMatchesPlayedResult.length > 0 ? uniqueMatchesPlayedResult[0].totalMatches : 0;

  // Calculate total contests participated
  // This counts every contest entry the user has made.
  // Consider adding filters here if you only count resolved contests
  // e.g., status: { $in: ['won', 'lost', 'pending_result'] }
  const totalContestsParticipated = await ContestParticipation.countDocuments({
    user: userId,
  });

  // Calculate total wins and total winning amount
  // Filters for entries where 'isWinner' is true and sums 'prizeWon'.
  const winStats = await ContestParticipation.aggregate([
    { $match: { user: userId, isWinner: true } }, // Filters by user and where 'isWinner' is true
    {
      $group: {
        _id: null,
        totalWins: { $sum: 1 },         // Counts the number of winning entries
        totalWinningAmount: { $sum: '$prizeWon' } // Sums the 'prizeWon' for winning entries
      }
    }
  ]);
  const totalWins = winStats.length > 0 ? winStats[0].totalWins : 0;
  const totalWinning = winStats.length > 0 ? winStats[0].totalWinningAmount : 0;

  // Calculate total losses
  // Counts entries where the 'status' is explicitly 'lost'.
  const totalLosses = await ContestParticipation.countDocuments({
    user: userId,
    status: 'lost'
  });

  // Calculate winning percentage
  // Based on total wins out of total contests participated (individual contest entries).
  let winningPercentage = 0;
  if (totalContestsParticipated > 0) {
    winningPercentage = parseFloat(((totalWins / totalContestsParticipated) * 100).toFixed(2));
  }

  // Return all calculated statistics
  return {
    totalContestsParticipated, // Total individual contests user joined
    totalMatchesPlayed,        // Total unique matches user played
    totalWins,                 // Total contests won
    totalLosses,               // Total contests lost
    totalWinning,              // Total prize money won
    winningPercentage,
  };
};

/**
 * Express controller to get detailed user profile including statistics and referred users' stats.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
exports.getDetailedUserProfile = async (req, res) => {
  try {
    // Assuming req.user._id is populated by authentication middleware
    const userId = req.user._id;

    // Fetch the current user, excluding sensitive fields like password
    const currentUser = await User.findById(userId).select('-password');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate statistics for the current user using the local function
    const currentUserStats = await calculateUserStats(userId);
    
    // Fetch referred users by checking their referCode
    // Selecting only necessary fields for referred users
    const referredUsers = await User.find({ referredBy: currentUser.referCode })
      .select('_id name email mobile signupMode profileImage');

    const referredUsersWithStats = [];
    // Loop through referred users to calculate their individual stats
    for (const referredUser of referredUsers) {
      const stats = await calculateUserStats(referredUser._id);
      referredUsersWithStats.push({
        _id: referredUser._id,
        name: referredUser.name,
        email: referredUser.email,
        mobile: referredUser.mobile,
        signupMode: referredUser.signupMode,
        profileImage: referredUser.profileImage,
        stats: stats, // Attach the calculated stats for each referred user
      });
    }

    // Construct the final response object
    res.json({
      user: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        mobile: currentUser.mobile,
        profileImage: currentUser.profileImage,
        referCode: currentUser.referCode,
        referralCount: currentUser.referralCount,
        // --- New KYC and Bank Details with default values ---
        kycStatus: currentUser.kycStatus || 'none',
        bankDetails: currentUser.bankDetails || { accountHolderName: '', accountNumber: '', ifscCode: '', isVerified: false },
        upiId: currentUser.upiId || '',
        aadhaar: currentUser.aadhaar || { numberLast4: '', isVerified: false },
      },
      // Present the stats clearly with desired keys
      stats: {
        contestWon: currentUserStats.totalWins,                 // Renamed for clarity in API response
        totalWinning: currentUserStats.totalWinning,             // Renamed for clarity in API response
        matchPlayed: currentUserStats.totalMatchesPlayed,      // Renamed for clarity in API response
        
        // Include the raw calculated fields as well if needed for more detail
        totalContestsParticipated: currentUserStats.totalContestsParticipated,
        totalWins: currentUserStats.totalWins,
        totalLosses: currentUserStats.totalLosses,
        winningPercentage: currentUserStats.winningPercentage,
      },
      referredUsers: referredUsersWithStats.map(referredUser => ({
        ...referredUser,
        stats: {
          contestWon: referredUser.stats.totalWins,
          totalWinning: referredUser.stats.totalWinning,
          matchPlayed: referredUser.stats.totalMatchesPlayed,
          
          totalContestsParticipated: referredUser.stats.totalContestsParticipated,
          totalWins: referredUser.stats.totalWins,
          totalLosses: referredUser.stats.totalLosses,
          winningPercentage: referredUser.stats.winningPercentage,
        }
      })),
    });

  } catch (error) {
    // Log the error for debugging purposes
    console.error('Error in getDetailedUserProfile:', error);
    // Send a 500 status response with an error message
    res.status(500).json({ message: 'Failed to fetch detailed user profile', error: error.message });
  }
};