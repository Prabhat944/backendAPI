// At the top of your file, import the logger
const logger = require('../utils/logger'); 

const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');
const generateReferCode = require('../utils/referCode');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { sendOTPViaSMS } = require('../utils/sendSms');
const axios = require('axios');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs').promises;
const redisClient = require('../utils/redisClient');
const BlacklistedToken = require('../models/BlacklistedToken');

const JWT_SECRET = process.env.JWT_SECRET;
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3000';

// --- Internal Helper Function to Call Wallet Service ---
const triggerReferralBonus = async (referrerId, refereeId) => {
  try {
    if (!referrerId || !refereeId) {
      logger.error('triggerReferralBonus validation failed: Missing referrerId or refereeId.');
      return;
    }

    logger.info('Attempting to trigger referral bonus.', { referrerId, refereeId });

    const response = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/referral-bonus`, {
      referrerId: referrerId.toString(),
      refereeId: refereeId.toString()
    }, {
      headers: { 'Content-Type': 'application/json' }
    });

    logger.info('Successfully notified Wallet Service for referral bonus.', { data: response.data });
  } catch (error) {
    logger.error('CRITICAL ERROR: Failed to call Wallet Service.', {
      referrerId,
      refereeId,
      error: {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      }
    });
  }
};

// Signup
exports.signup = async (req, res) => {
  const { name, email, mobile, password, referCode } = req.body;
  logger.info('Signup attempt started.', { email, mobile });

  try {
    if (!name || !email || !password) {
      logger.warn('Signup validation failed: Missing required fields.', { email });
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) {
      logger.warn('Signup failed: User already exists.', { email, mobile });
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      mobile,
      password: hashedPassword,
      referCode: generateReferCode(name),
      signupMode: 'email',
      referralCounted: false,
    });

    let referrer = null;
    if (referCode) {
      referrer = await User.findOne({ referCode });
      if (referrer) {
        newUser.referredBy = referCode;
        referrer.referralCount += 1;
        newUser.referralCounted = true;
        await referrer.save();
        logger.info('Referral code applied successfully.', { refereeEmail: email, referrerCode: referCode });
      }
    }

    await newUser.save();
    if (referrer) {
      triggerReferralBonus(referrer._id, newUser._id);
    }

    logger.info('User registered successfully.', { userId: newUser._id, email });
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    logger.error('Error during user signup.', {
      email,
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ message: 'Server error' });
  }
};

// Send OTP
exports.sendOtp = async (req, res) => {
  const { mobile, referCode } = req.body;
  logger.info('Send OTP request received.', { mobile });

  const otp = mobile === '8826893866' ? Math.floor(100000 + Math.random() * 900000).toString() : "554433";

  try {
    await OTP.findOneAndUpdate({ mobile }, { otp, createdAt: new Date() }, { upsert: true, new: true });
    await sendOTPViaSMS(mobile, otp);

    let user = await User.findOne({ mobile });
    if (!user) {
      logger.info('New user detected via OTP. Creating new user account.', { mobile });
      const adjectives = ['Swift', 'Mighty', 'Clever', 'Brave', 'Dashing', 'Royal', 'Super', 'Grand', 'Fearless', 'Agile', 'Prime'];
      const nouns = ['Striker', 'Captain', 'Challenger', 'Knight', 'Eagle', 'Titan', 'Panther', 'King', 'Master', 'Star', 'Lion'];
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const baseName = `${randomAdjective}${randomNoun}`;
      const newUserId = new mongoose.Types.ObjectId();
      const finalName = `${baseName}_${newUserId.toString().slice(-5)}`;

      user = new User({ _id: newUserId, name: finalName, mobile, signupMode: 'otp', referCode: generateReferCode() });

      let referrer = null;
      if (referCode) {
        referrer = await User.findOne({ referCode });
        if (referrer) {
          user.referredBy = referCode;
          referrer.referralCount += 1;
          await referrer.save();
          user.referralCounted = true;
          logger.info('Referral code applied successfully for new OTP user.', { mobile, referrerCode: referCode });
        }
      }
      await user.save();
      if (referrer) {
        triggerReferralBonus(referrer._id, user._id);
      }
      logger.info('New user created successfully via OTP.', { userId: user._id, mobile });
    }

    logger.info('OTP sent successfully.', { mobile });
    res.json({ message: 'OTP sent successfully' });
  } catch (err) {
    logger.error('Failed to send OTP.', {
      mobile,
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
};

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  logger.info('Login attempt started.', { email });

  try {
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn('Login failed: User not found.', { email });
      return res.status(400).json({ message: 'User not found' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      logger.warn('Login failed: Invalid credentials.', { email, userId: user._id });
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
    logger.info('User logged in successfully.', { userId: user._id, email });
    res.json({ token });
  } catch (err) {
    logger.error('Error during login.', {
      email,
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout
exports.logout = async (req, res) => {
  const token = req.token;
  logger.info('Logout attempt started.', { userId: req.user?._id });

  if (!token) {
    logger.warn('Logout failed: No token found in request.');
    return res.status(400).json({ message: 'No token found in request. User not authenticated.' });
  }

  try {
    const decodedToken = jwt.decode(token);
    if (!decodedToken || !decodedToken.exp) {
      logger.warn('Logout failed: Invalid token format.', { userId: req.user?._id });
      return res.status(400).json({ message: 'Invalid token format or missing expiry.' });
    }

    const expiresAt = new Date(decodedToken.exp * 1000);
    await BlacklistedToken.create({ token, expiresAt });

    logger.info('User logged out successfully. Token blacklisted.', { userId: req.user._id });
    res.status(200).json({ message: 'Logged out successfully.' });
  } catch (err) {
    logger.error('Error during logout/token blacklisting.', {
      userId: req.user?._id,
      error: { message: err.message, stack: err.stack }
    });
    res.status(500).json({ message: 'Failed to log out due to server error.' });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
    const { mobile, otp } = req.body;
    logger.info('OTP verification attempt.', { mobile });

    try {
      const record = await OTP.findOne({ mobile, otp });
      if (!record) {
        logger.warn('OTP verification failed: Invalid or expired OTP.', { mobile });
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      const user = await User.findOne({ mobile });
      if (!user) {
        logger.warn('OTP verification failed: User not found after valid OTP.', { mobile });
        return res.status(404).json({ message: 'User not found. Please resend OTP.' });
      }

      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
      await redisClient.set(`session:${user._id}`, token);
      user.token = token;
      await user.save();
      await OTP.deleteOne({ _id: record._id });

      logger.info('OTP verified successfully, user logged in.', { userId: user._id, mobile });
      res.json({ token, message: "Login successful! You are now logged in on this device." });
    } catch (err) {
      logger.error('Error during OTP verification.', {
        mobile,
        error: { message: err.message, stack: err.stack }
      });
      res.status(500).json({ message: 'OTP verification failed' });
    }
};

// Upload Profile Image
exports.uploadProfileImage = async (req, res) => {
    const userId = req.user._id;
    logger.info('Profile image upload attempt.', { userId });

    try {
      if (!req.file) {
        logger.warn('Image upload failed: No file provided.', { userId });
        return res.status(400).json({ message: 'No image file provided.' });
      }

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'fantasy_app_profiles',
        resource_type: 'image',
        transformation: [{ width: 250, height: 250, gravity: "face", crop: "fill" }]
      });

      await fs.unlink(req.file.path);

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { profileImage: result.secure_url } },
        { new: true }
      ).select('profileImage');

      if (!updatedUser) {
        logger.error('Image upload failed: User not found after upload.', { userId });
        return res.status(404).json({ message: 'User not found.' });
      }

      logger.info('Profile image uploaded successfully.', { userId, imageUrl: updatedUser.profileImage });
      res.status(200).json({ message: 'Profile image uploaded successfully.', profileImage: updatedUser.profileImage });
    } catch (error) {
      logger.error('Error uploading profile image.', {
        userId,
        error: { message: error.message, stack: error.stack }
      });
      if (req.file?.path) {
        try { await fs.unlink(req.file.path); } catch (unlinkErr) {
            logger.error('Error deleting temporary file after failed upload.', { error: { message: unlinkErr.message, stack: unlinkErr.stack } });
        }
      }
      res.status(500).json({ message: 'Image upload failed.', error: error.message });
    }
};

// Validate Token
exports.validateToken = async (req, res) => {
    const { token } = req.body;
    logger.info('Token validation request received.');

    try {
        if (!token) {
            logger.warn('Token validation failed: No token provided.');
            return res.status(400).json({ message: 'Token is required for validation.' });
        }

        const isBlacklisted = await BlacklistedToken.exists({ token: token });
        if (isBlacklisted) {
            logger.warn('Token validation failed: Token is blacklisted.');
            return res.status(401).json({ message: 'Token is blacklisted.' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            logger.warn('Token validation failed: User not found.', { userId: decoded.userId });
            return res.status(404).json({ message: 'User not found.' });
        }

        logger.info('Token validated successfully.', { userId: user._id });
        res.status(200).json(user);
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            logger.warn('Token validation failed: Token expired.');
            return res.status(401).json({ message: 'Token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
            logger.warn('Token validation failed: Invalid token signature.');
            return res.status(401).json({ message: 'Invalid token' });
        }
        
        logger.error('Unexpected error during token validation.', {
            error: { message: err.message, stack: err.stack }
        });
        res.status(500).json({ message: 'Token validation failed.' });
    }
};


// --- The remaining functions are also instrumented with logging ---

// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
    const { email } = req.body;
    logger.info('Password reset requested.', { email });
    try {
        const user = await User.findOne({ email });
        if (!user) {
            logger.warn('Password reset failed: User not found.', { email });
            return res.status(404).json({ message: 'User not found' });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });
        const resetLink = `http://localhost:5000/api/auth/reset-password/${token}`;
        await sendEmail(email, 'Reset Your Password', `Click here: ${resetLink}`);
        logger.info('Password reset email sent successfully.', { email });
        res.json({ message: 'Password reset email sent' });
    } catch (err) {
        logger.error('Error sending password reset email.', { email, error: { message: err.message, stack: err.stack }});
        res.status(500).json({ message: 'Error sending email' });
    }
};

// Reset Password
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;
    logger.info('Attempting to reset password.');
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const hashed = await bcrypt.hash(newPassword, 10);
        await User.findByIdAndUpdate(decoded.userId, { password: hashed });
        logger.info('Password reset successful.', { userId: decoded.userId });
        res.json({ message: 'Password reset successful' });
    } catch (err) {
        logger.warn('Password reset failed: Invalid or expired token.');
        res.status(400).json({ message: 'Invalid or expired token' });
    }
};

// Get User By ID
exports.getUserById = async (req, res) => {
    const userId = req.params.id;
    logger.info('Fetching user by ID.', { userId });
    try {
        const user = await User.findById(userId).select('-password');
        if (!user) {
            logger.warn('User not found by ID.', { userId });
            return res.status(404).json({ message: 'User not found' });
        }
        logger.info('Successfully fetched user by ID.', { userId });
        res.status(200).json(user);
    } catch (error) {
        logger.error('Error fetching user by ID.', { userId, error: { message: error.message, stack: error.stack } });
        res.status(500).json({ message: 'Server error' });
    }
};

// Google Login
exports.googleLogin = async (req, res) => {
    const { idToken } = req.body;
    logger.info('Google login attempt started.');
    try {
        const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
        const { email, name } = ticket.getPayload();
        let user = await User.findOne({ email });
        if (!user) {
            logger.info('New user via Google Login. Creating account.', { email });
            user = await User.create({ email, name });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
        logger.info('Google login successful.', { userId: user._id, email });
        res.json({ token });
    } catch (err) {
        logger.error('Google login failed.', { error: { message: err.message, stack: err.stack } });
        res.status(401).json({ message: 'Google login failed' });
    }
};

// Facebook Login
exports.facebookLogin = async (req, res) => {
    const { accessToken, userID } = req.body;
    logger.info('Facebook login attempt started.', { userID });
    try {
        if (!accessToken || !userID) {
            logger.warn('Facebook login failed: Missing token or userID.');
            return res.status(400).json({ message: 'Access Token and UserID are required' });
        }
        const fbURL = `https://graph.facebook.com/v12.0/${userID}?fields=id,name,email&access_token=${accessToken}`;
        const { data } = await axios.get(fbURL);
        if (!data || !data.email) {
            logger.error('Facebook login failed: Could not retrieve email from FB graph.', { userID });
            return res.status(400).json({ message: 'Unable to retrieve Facebook user data' });
        }
        let user = await User.findOne({ email: data.email });
        if (!user) {
            logger.info('New user via Facebook Login. Creating account.', { email: data.email });
            user = await User.create({ name: data.name, email: data.email });
        }
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
        logger.info('Facebook login successful.', { userId: user._id, email: data.email });
        res.json({ token });
    } catch (err) {
        logger.error('Facebook login failed.', { userID, error: { message: err.message, stack: err.stack } });
        res.status(500).json({ message: 'Facebook login failed' });
    }
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
    const userId = req.user._id;
    logger.info('Fetching current user profile.', { userId });
    try {
        res.json(req.user);
    } catch (err) {
        logger.error('Failed to get current user profile.', { userId, error: { message: err.message, stack: err.stack }});
        res.status(500).json({ message: 'Failed to get user profile' });
    }
};

// Update User
exports.updateUser = async (req, res) => {
    const userId = req.user._id;
    logger.info('User update attempt.', { userId });
    try {
        const user = await User.findById(userId);
        if (!user) {
            logger.warn('User update failed: User not found.', { userId });
            return res.status(404).json({ message: 'User not found' });
        }
        const { name, email, mobile } = req.body;
        if (name) user.name = name;
        if (email) user.email = email;
        if (mobile) user.mobile = mobile;
        await user.save();
        logger.info('User updated successfully.', { userId });
        res.json({ message: 'User updated successfully', user });
    } catch (err) {
        logger.error('Failed to update user info.', { userId, error: { message: err.message, stack: err.stack }});
        res.status(500).json({ message: 'Failed to update user info' });
    }
};

// Search Users
exports.searchUsers = async (req, res) => {
    const currentUserId = req.user.id;
    const searchTerm = req.query.search;
    logger.info('User search performed.', { currentUserId, searchTerm });
    try {
        const query = searchTerm ? {
            $or: [
                { name: { $regex: searchTerm, $options: 'i' } },
                { email: { $regex: searchTerm, $options: 'i' } },
            ],
        } : {};
        const users = await User.find(query).find({ _id: { $ne: currentUserId } }).select('id name profileImage');
        logger.info(`User search found ${users.length} results.`, { currentUserId, searchTerm });
        res.json(users);
    } catch (err) {
        logger.error('Error during user search.', { currentUserId, searchTerm, error: { message: err.message, stack: err.stack } });
        res.status(500).json({ message: 'Server error' });
    }
};

// Get User Details By ID (for internal service communication)
exports.getUserDetailsById = async (req, res) => {
    const userId = req.params.id;
    logger.info('Fetching user details for inter-service communication.', { userId });
    try {
        const user = await User.findById(userId).select('name profileImage');
        if (user) {
            res.json(user);
        } else {
            logger.warn('User details not found.', { userId });
            res.status(404).json({ message: 'User not found' });
        }
    } catch(err) {
        logger.error('Error fetching user details.', { userId, error: { message: err.message, stack: err.stack } });
        res.status(500).json({ message: 'Server error' });
    }
};