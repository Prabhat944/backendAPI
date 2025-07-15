// // Example: userProfileController.js (or wherever you prefer to keep this logic)

// const User = require('../models/userModel'); // Adjust this path to your User model
// const ContestParticipation = require('../models/ContestParticipation'); // Adjust this path to your ContestParticipation model
// const mongoose = require('mongoose');

// /**
//  * Calculates various statistics for a given user based on their ContestParticipation records.
//  * @param {mongoose.Types.ObjectId} userId - The ID of the user.
//  * @returns {Object} An object containing user stats.
//  */
// /**
//  * An EFFICIENT and reusable function to calculate statistics for ANY given user ID.
//  * @param {mongoose.Types.ObjectId} userId - The ID of the user to calculate stats for.
//  * @returns {Object} - An object containing the user's stats.
//  */
// const calculateUserStats = async (userId) => {
//   try {
//     // DB Call 1: Get the count of unique matches played (this query is efficient and best kept separate)
//     const uniqueMatchesPlayedResult = await ContestParticipation.aggregate([
//       { $match: { user: userId } },
//       { $group: { _id: '$matchId' } },
//       { $count: 'totalMatches' }
//     ]);
//     const totalMatchesPlayed = uniqueMatchesPlayedResult.length > 0 ? uniqueMatchesPlayedResult[0].totalMatches : 0;

//     // DB Call 2: Get all other stats in a single, powerful query
//     const statsResult = await ContestParticipation.aggregate([
//       {
//         // Start by finding all contest entries for the specified user
//         $match: { user: userId }
//       },
//       {
//         // Group them all into a single result to calculate stats
//         $group: {
//           _id: null, // Group all documents into one for a single summary
//           totalContestsParticipated: { $sum: 1 }, // Count every entry
//           totalWins: {
//             // Add 1 to the sum only if 'isWinner' is true
//             $sum: { $cond: ['$isWinner', 1, 0] }
//           },
//           totalLosses: {
//             // Add 1 to the sum only if 'status' is 'lost'
//             $sum: { $cond: [{ $eq: ['$status', 'lost'] }, 1, 0] }
//           },
//           totalWinning: {
//             // Add the prize amount to the sum only if 'isWinner' is true
//             $sum: { $cond: ['$isWinner', '$prizeWon', 0] }
//           }
//         }
//       }
//     ]);
    
//     // Extract the results from the aggregation, providing defaults if the user has no stats yet
//     const stats = statsResult[0] || { totalContestsParticipated: 0, totalWins: 0, totalLosses: 0, totalWinning: 0 };

//     // Calculate winning percentage from the aggregated results
//     let winningPercentage = 0;
//     if (stats.totalContestsParticipated > 0) {
//       winningPercentage = parseFloat(((stats.totalWins / stats.totalContestsParticipated) * 100).toFixed(2));
//     }

//     // Return all calculated statistics
//     return {
//       totalContestsParticipated: stats.totalContestsParticipated,
//       totalMatchesPlayed, // From our first query
//       totalWins: stats.totalWins,
//       totalLosses: stats.totalLosses,
//       totalWinning: stats.totalWinning,
//       winningPercentage,
//     };

//   } catch (error) {
//     console.error(`Error calculating stats for user ${userId}:`, error);
//     // Return a default object in case of an error
//     return {
//       totalContestsParticipated: 0,
//       totalMatchesPlayed: 0,
//       totalWins: 0,
//       totalLosses: 0,
//       totalWinning: 0,
//       winningPercentage: 0,
//     };
//   }
// };
// /**
//  * Express controller to get detailed user profile including statistics and referred users' stats.
//  * @param {Object} req - Express request object.
//  * @param {Object} res - Express response object.
//  */
// exports.getDetailedUserProfile = async (req, res) => {
//   try {
//     // Assuming req.user._id is populated by authentication middleware
//     const userId = req.user._id;

//     // Fetch the current user, excluding sensitive fields like password
//     const currentUser = await User.findById(userId).select('-password');
//     if (!currentUser) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Calculate statistics for the current user using the local function
//     const currentUserStats = await calculateUserStats(userId);
    
//     // Fetch referred users by checking their referCode
//     // Selecting only necessary fields for referred users
//     const referredUsers = await User.find({ referredBy: currentUser.referCode })
//       .select('_id name email mobile signupMode profileImage');

//     const referredUsersWithStats = [];
//     // Loop through referred users to calculate their individual stats
//     for (const referredUser of referredUsers) {
//       const stats = await calculateUserStats(referredUser._id);
//       referredUsersWithStats.push({
//         _id: referredUser._id,
//         name: referredUser.name,
//         email: referredUser.email,
//         mobile: referredUser.mobile,
//         signupMode: referredUser.signupMode,
//         profileImage: referredUser.profileImage,
//         stats: stats, // Attach the calculated stats for each referred user
//       });
//     }

//     // Construct the final response object
//     res.json({
//       user: {
//         _id: currentUser._id,
//         name: currentUser.name,
//         email: currentUser.email,
//         mobile: currentUser.mobile,
//         profileImage: currentUser.profileImage,
//         referCode: currentUser.referCode,
//         referralCount: currentUser.referralCount,
//         // --- New KYC and Bank Details with default values ---
//         kycStatus: currentUser.kycStatus || 'none',
//         bankDetails: currentUser.bankDetails || { accountHolderName: '', accountNumber: '', ifscCode: '', isVerified: false },
//         upiId: currentUser.upiId || '',
//         aadhaar: currentUser.aadhaar || { numberLast4: '', isVerified: false },
//       },
//       // Present the stats clearly with desired keys
//       stats: {
//         contestWon: currentUserStats.totalWins,                 // Renamed for clarity in API response
//         totalWinning: currentUserStats.totalWinning,             // Renamed for clarity in API response
//         matchPlayed: currentUserStats.totalMatchesPlayed,      // Renamed for clarity in API response
        
//         // Include the raw calculated fields as well if needed for more detail
//         totalContestsParticipated: currentUserStats.totalContestsParticipated,
//         totalWins: currentUserStats.totalWins,
//         totalLosses: currentUserStats.totalLosses,
//         winningPercentage: currentUserStats.winningPercentage,
//       },
//       referredUsers: referredUsersWithStats.map(referredUser => ({
//         ...referredUser,
//         stats: {
//           contestWon: referredUser.stats.totalWins,
//           totalWinning: referredUser.stats.totalWinning,
//           matchPlayed: referredUser.stats.totalMatchesPlayed,
          
//           totalContestsParticipated: referredUser.stats.totalContestsParticipated,
//           totalWins: referredUser.stats.totalWins,
//           totalLosses: referredUser.stats.totalLosses,
//           winningPercentage: referredUser.stats.winningPercentage,
//         }
//       })),
//     });

//   } catch (error) {
//     // Log the error for debugging purposes
//     console.error('Error in getDetailedUserProfile:', error);
//     // Send a 500 status response with an error message
//     res.status(500).json({ message: 'Failed to fetch detailed user profile', error: error.message });
//   }
// };

// exports.getPublicUserProfileById = async (req, res) => {
//   try {
//       // First, validate the ID format from the URL parameter
//       if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
//           return res.status(400).json({ message: 'Invalid user ID format.' });
//       }

//       // --- THIS IS THE FIX ---
//       // Convert the string from the URL into a proper MongoDB ObjectId
//       const profileUserId = new mongoose.Types.ObjectId(req.params.id);
      
//       // You can add a log here to be 100% sure
//       console.log(`Fetching public profile for ObjectId: ${profileUserId}`);

//       // Fetch the user's basic info
//       const user = await User.findById(profileUserId).select('-password');
//       if (!user) {
//           return res.status(404).json({ message: 'User not found' });
//       }

//       // Calculate stats for the user being viewed using our robust function
//       const stats = await calculateUserStats(profileUserId);

//       // Construct a response with only PUBLICLY SAFE data
//       const publicProfile = {
//           _id: user._id,
//           name: user.name,
//           profileImage: user.profileImage,
//           stats: {
//               contestWon: stats.totalWins,
//               totalWinning: stats.totalWinning,
//               matchPlayed: stats.totalMatchesPlayed,
//               totalContestsParticipated: stats.totalContestsParticipated
//           }
//       };

//       res.json(publicProfile);

//   } catch (error) {
//       console.error('Error in getPublicUserProfileById:', error);
//       res.status(500).json({ message: 'Failed to fetch public user profile', error: error.message });
//   }
// };

// userProfileController.js

// --- MODELS WE NEED ---
const User = require('../models/userModel');
const UserStats = require('../models/userStatsModel'); // We now read from this!
const mongoose = require('mongoose');

// The `calculateUserStats` function has been DELETED from this file.
// Its logic now lives in `services/statsService.js`.

// --- CONTROLLERS ---

/**
 * @desc    Get the logged-in user's OWN detailed profile.
 * @route   GET /api/users/profile/me
 * @access  Private
 */
exports.getDetailedUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // --- FASTER DATA FETCHING ---
    // Fetch user details and their pre-calculated stats in parallel.
    const [currentUser, currentUserStats] = await Promise.all([
      User.findById(userId).select('-password').lean(),
      UserStats.findOne({ user: userId }).lean()
    ]);

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Provide default stats for new users who haven't played yet.
    const stats = currentUserStats || { totalWins: 0, totalWinning: 0, totalMatchesPlayed: 0, totalContestsParticipated: 0, totalLosses: 0, winningPercentage: 0 };

    // --- FETCH REFERRED USERS AND THEIR STATS (also much faster now) ---
    const referredUsers = await User.find({ referredBy: currentUser.referCode })
      .select('_id name email mobile signupMode profileImage').lean();

    const referredUsersWithStats = await Promise.all(referredUsers.map(async (referredUser) => {
      const referredUserStats = await UserStats.findOne({ user: referredUser._id }).lean();
      const refStats = referredUserStats || { totalWins: 0, totalWinning: 0, totalMatchesPlayed: 0, totalContestsParticipated: 0, totalLosses: 0, winningPercentage: 0 };
      
      return {
        ...referredUser,
        stats: {
          contestWon: refStats.totalWins,
          totalWinning: refStats.totalWinning,
          matchPlayed: refStats.totalMatchesPlayed,
          totalContestsParticipated: refStats.totalContestsParticipated,
          totalWins: refStats.totalWins,
          totalLosses: refStats.totalLosses,
          winningPercentage: refStats.winningPercentage,
        }
      };
    }));

    // --- CONSTRUCT FINAL RESPONSE ---
    res.json({
      user: {
        ...currentUser,
        kycStatus: currentUser.kycStatus || 'none',
        bankDetails: currentUser.bankDetails || { accountHolderName: '', accountNumber: '', ifscCode: '', isVerified: false },
        upiId: currentUser.upiId || '',
        aadhaar: currentUser.aadhaar || { numberLast4: '', isVerified: false },
      },
      stats: {
        contestWon: stats.totalWins,
        totalWinning: stats.totalWinning,
        matchPlayed: stats.totalMatchesPlayed,
        totalContestsParticipated: stats.totalContestsParticipated,
        totalWins: stats.totalWins,
        totalLosses: stats.totalLosses,
        winningPercentage: stats.winningPercentage,
      },
      referredUsers: referredUsersWithStats,
    });

  } catch (error) {
    console.error('Error in getDetailedUserProfile:', error);
    res.status(500).json({ message: 'Failed to fetch detailed user profile' });
  }
};

/**
 * @desc    Get ANY user's public profile by their ID.
 * @route   GET /api/users/profile/:id
 * @access  Private
 */
exports.getPublicUserProfileById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID format.' });
    }
    const profileUserId = new mongoose.Types.ObjectId(req.params.id);

    // --- FASTER DATA FETCHING ---
    // Fetch user details and their pre-calculated stats in parallel.
    const [user, stats] = await Promise.all([
        User.findById(profileUserId).select('name profileImage').lean(),
        UserStats.findOne({ user: profileUserId }).lean()
    ]);

    if (!user) {
        return res.status(404).json({ message: 'User not found' });
    }

    // Default stats if a user has never played.
    const userStats = stats || { totalWins: 0, totalWinning: 0, totalMatchesPlayed: 0, totalContestsParticipated: 0 };

    // --- CONSTRUCT FINAL RESPONSE ---
    const publicProfile = {
        _id: user._id,
        name: user.name,
        profileImage: user.profileImage,
        stats: {
            contestWon: userStats.totalWins,
            totalWinning: userStats.totalWinning,
            matchPlayed: userStats.totalMatchesPlayed,
            totalContestsParticipated: userStats.totalContestsParticipated
        }
    };
    res.json(publicProfile);

  } catch (error) {
    console.error('Error in getPublicUserProfileById:', error);
    res.status(500).json({ message: 'Failed to fetch public user profile' });
  }
};