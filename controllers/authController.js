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

const BlacklistedToken = require('../models/BlacklistedToken');

const JWT_SECRET = process.env.JWT_SECRET;
// This URL must point to your Wallet Service.
// You confirmed the User Service is on 5001, so the Wallet service is likely on 3000 or another port.
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:3000'; 

// --- Internal Helper Function to Call Wallet Service ---
const triggerReferralBonus = async (referrerId, refereeId) => {
  try {
    if (!referrerId || !refereeId) {
      console.error('Missing referrerId or refereeId');
      return;
    }
    
    console.log(`Attempting to trigger referral bonus for referrer: ${referrerId} and referee: ${refereeId}`);
    
    const response = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/referral-bonus`, {
      referrerId: referrerId.toString(), // Ensure string format
      refereeId: refereeId.toString()    // Ensure string format
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`✅ Successfully notified Wallet Service. Response:`, response.data);
  } catch (error) {
    console.error(`🔴 CRITICAL ERROR: Failed to call Wallet Service.`, {
      status: error.response?.status,
      data: error.response?.data,
      message: error.message
    });
  }
};


// Signup
exports.signup = async (req, res) => {
  const { name, email, mobile, password, referCode } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    if (existingUser) return res.status(400).json({ message: 'User already exists' });

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

    let referrer = null; // Variable to hold the referrer if found

    if (referCode) {
      referrer = await User.findOne({ referCode });
      if (referrer) {
        newUser.referredBy = referCode;
        referrer.referralCount += 1;
        newUser.referralCounted = true;
        await referrer.save();
      }
    }

    // ✅ --- FIX --- ✅
    // Save the new user to the database BEFORE triggering the bonus.
    await newUser.save(); 

    // Now that the user is saved, if a valid referrer was found, trigger the bonus.
    if (referrer) {
      triggerReferralBonus(referrer._id, newUser._id);
    }
    // --- END OF FIX ---

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


//Send OTP
exports.sendOtp = async (req, res) => {
  const { mobile, referCode } = req.body;
  // const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otp = mobile === '8826893866' ? Math.floor(100000 + Math.random() * 900000).toString() : "554433";

  try {
    await OTP.findOneAndUpdate(
      { mobile },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOTPViaSMS(mobile, otp);

    let user = await User.findOne({ mobile });
    
    if (!user) {
      const adjectives = ['Swift', 'Mighty', 'Clever', 'Brave', 'Dashing', 'Royal', 'Super', 'Grand', 'Fearless', 'Agile', 'Prime'];
      const nouns = ['Striker', 'Captain', 'Challenger', 'Knight', 'Eagle', 'Titan', 'Panther', 'King', 'Master', 'Star', 'Lion'];
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const baseName = `${randomAdjective}${randomNoun}`;

      const newUserId = new mongoose.Types.ObjectId();
      const finalName = `${baseName}_${newUserId.toString().slice(-5)}`;

      user = new User({
        _id: newUserId,
        name: finalName,
        mobile,
        signupMode: 'otp',
        referCode: generateReferCode(),
      });

      let referrer = null; // Variable to hold the referrer

      if (referCode) {
        referrer = await User.findOne({ referCode });
        if (referrer) {
          user.referredBy = referCode;
          referrer.referralCount += 1;
          await referrer.save();
          user.referralCounted = true;
        }
      }

      // ✅ --- FIX --- ✅
      // Save the new user to the database BEFORE triggering the bonus.
      await user.save();

      // Now that the user is saved, if a valid referrer was found, trigger the bonus.
      if (referrer) {
        triggerReferralBonus(referrer._id, user._id);
      }
      // --- END OF FIX ---
    }

    res.json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error('❌ sendOtp Error:', err);
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
  }
};

// --- ALL OTHER FUNCTIONS (login, logout, getUserById, etc.) remain unchanged ---

// Login
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({
      $or: [{ email }]
    });
    if (!user) return res.status(400).json({ message: 'User not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// Logout
exports.logout = async (req, res) => {
  const token = req.token; 

  if (!token) {
    return res.status(400).json({ message: 'No token found in request. User not authenticated.' });
  }

  try {
    const decodedToken = jwt.decode(token);

    if (!decodedToken || !decodedToken.exp) {
      return res.status(400).json({ message: 'Invalid token format or missing expiry.' });
    }

    const expiresAt = new Date(decodedToken.exp * 1000);

    await BlacklistedToken.create({ token, expiresAt });

    console.log(`User ${req.user._id} logged out. Token blacklisted until ${expiresAt.toLocaleString()}.`);
    res.status(200).json({ message: 'Logged out successfully.' });

  } catch (err) {
    console.error('Error during logout/token blacklisting:', err);
    res.status(500).json({ message: 'Failed to log out due to server error.' });
  }
};


// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '15m' });
    const resetLink = `http://localhost:5000/api/auth/reset-password/${token}`;
    await sendEmail(email, 'Reset Your Password', `Click here: ${resetLink}`);
    res.json({ message: 'Password reset email sent' });
  } catch (err) {
    res.status(500).json({ message: 'Error sending email' });
  }
};

// Reset Password
exports.resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(decoded.userId, { password: hashed });
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    res.status(400).json({ message: 'Invalid or expired token' });
  }
};
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findOne({ _id: req.params.id }).select('-password'); // ✅ FIXED
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error in getUserById:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

  // Verify OTP 
exports.verifyOtp = async (req, res) => {
    const { mobile, otp } = req.body;
    try {
      const record = await OTP.findOne({ mobile, otp });
  
      if (!record) {
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }
  
      const user = await User.findOne({ mobile });
  
      if (!user) {
        return res.status(404).json({ message: 'User not found. Please resend OTP.' });
      }
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
  
    } catch (err) {
      res.status(500).json({ message: 'OTP verification failed' });
    }
};
  
  // Google Login
exports.googleLogin = async (req, res) => {
    const { idToken } = req.body;
  
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
  
      const { email, name } = ticket.getPayload();
  
      let user = await User.findOne({ email });
      if (!user) user = await User.create({ email, name });
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
    } catch (err) {
      res.status(401).json({ message: 'Google login failed' });
    }
  };

  // Facebook Login
exports.facebookLogin = async (req, res) => {
    const { accessToken, userID } = req.body;
  
    if (!accessToken || !userID) {
      return res.status(400).json({ message: 'Access Token and UserID are required' });
    }
  
    try {
      const fbURL = `https://graph.facebook.com/v12.0/${userID}?fields=id,name,email&access_token=${accessToken}`;
      const { data } = await axios.get(fbURL);
  
      if (!data || !data.email) {
        return res.status(400).json({ message: 'Unable to retrieve Facebook user data' });
      }
  
      let user = await User.findOne({ email: data.email });
  
      if (!user) {
        user = await User.create({
          name: data.name,
          email: data.email,
          password: null,
          mobile: null,
        });
      }
  
      const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token });
    } catch (err) {
      console.error('Facebook login error:', err.message);
      res.status(500).json({ message: 'Facebook login failed' });
    }
  };

exports.getCurrentUser = async (req, res) => {
    try {
      res.json(req.user);
    } catch (err) {
      res.status(500).json({ message: 'Failed to get user profile' });
    }
  };
  
exports.updateUser = async (req, res) => {
    const { name, email, mobile } = req.body;
    try {
      const user = await User.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });
  
      if (name) user.name = name;
      if (email) user.email = email;
      if (mobile) user.mobile = mobile;
  
      await user.save();
      res.json({ message: 'User updated successfully', user });
    } catch (err) {
      res.status(500).json({ message: 'Failed to update user info' });
    }
  };
  
  exports.uploadProfileImage = async (req, res) => {
    try {
      const userId = req.user._id;
  
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
      }
  
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'fantasy_app_profiles',
        resource_type: 'image',
        transformation: [
          { width: 250, height: 250, gravity: "face", crop: "fill" }
        ]
      });
  
      await fs.unlink(req.file.path);
  
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { profileImage: result.secure_url } },
        { new: true }
      ).select('profileImage');
  
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found.' });
      }
  
      res.status(200).json({
        message: 'Profile image uploaded successfully.',
        profileImage: updatedUser.profileImage
      });
  
    } catch (error) {
      console.error('Error uploading profile image:', error);
      if (req.file && req.file.path) {
        try {
            await fs.unlink(req.file.path);
        } catch (unlinkErr) {
            console.error('Error deleting temp file:', unlinkErr);
        }
      }
      res.status(500).json({ message: 'Image upload failed.', error: error.message });
    }
  };

  exports.validateToken = async (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(400).json({ message: 'Token is required for validation.' });
    }

    try {
        // 1. Check if the token has been blacklisted (logged out)
        const isBlacklisted = await BlacklistedToken.exists({ token: token });
        if (isBlacklisted) {
            return res.status(401).json({ message: 'Token is blacklisted.' });
        }

        // 2. Verify the JWT signature and expiry
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // 3. Check if the user still exists in the database
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 4. If all checks pass, return the user's data
        // This confirms to the other service that the token is valid.
        res.status(200).json(user);

    } catch (err) {
        // Handle specific JWT errors
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json({ message: 'Invalid token' });
        }
        
        // Catch any other unexpected errors
        console.error('Token validation error:', err);
        res.status(500).json({ message: 'Token validation failed.' });
    }
};