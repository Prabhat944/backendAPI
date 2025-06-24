// In your user profile controller

const User = require('../models/userModel'); // Adjust path as needed
const UserContestOutcome = require('../models/UserContestOutcome'); // Adjust path as needed

// Helper function to calculate stats for a given userId
const calculateUserStats = async (userId) => {
  const totalContestsParticipated = await UserContestOutcome.countDocuments({
    user: userId,
    resultStatus: { $in: ['WIN', 'LOSS', 'DRAW'] }
  });
  const totalWins = await UserContestOutcome.countDocuments({ user: userId, resultStatus: 'WIN' });
  const totalLosses = await UserContestOutcome.countDocuments({ user: userId, resultStatus: 'LOSS' });

  let winningPercentage = 0;
  if (totalContestsParticipated > 0) {
    winningPercentage = parseFloat(((totalWins / totalContestsParticipated) * 100).toFixed(2));
  }

  return {
    totalContestsParticipated,
    totalWins,
    totalLosses,
    winningPercentage,
  };
};


exports.getDetailedUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    const currentUser = await User.findById(userId).select('-password');
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUserStats = await calculateUserStats(userId);

    // ✅ --- THIS IS THE FIX ---
    // We now use an inclusive projection, listing all the fields we want.
    // By not including 'password', it is automatically excluded.
    const referredUsers = await User.find({ referredBy: currentUser.referCode })
      .select('_id name email mobile signupMode profileImage');

    const referredUsersWithStats = [];
    for (const referredUser of referredUsers) {
      const stats = await calculateUserStats(referredUser._id);
      referredUsersWithStats.push({
        _id: referredUser._id,
        name: referredUser.name,
        email: referredUser.email,
        mobile: referredUser.mobile,
        signupMode: referredUser.signupMode,
        profileImage: referredUser.profileImage,
        stats: stats,
      });
    }

    res.json({
      user: {
        _id: currentUser._id,
        name: currentUser.name,
        email: currentUser.email,
        mobile: currentUser.mobile,
        profileImage: currentUser.profileImage,
        referCode: currentUser.referCode,
        referralCount: currentUser.referralCount,
      },
      stats: currentUserStats,
      referredUsers: referredUsersWithStats,
    });

  } catch (error) {
    console.error('Error in getDetailedUserProfile:', error);
    res.status(500).json({ message: 'Failed to fetch detailed user profile', error: error.message });
  }
};
