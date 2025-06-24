const User = require('../models/userModel');
const OTP = require('../models/otpModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const sendEmail = require('../utils/sendEmail');
const generateReferCode = require('../utils/referCode');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const { sendOTPViaSMS } = require('../utils/sendSms'); // adjust path if needed
const axios = require('axios');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');


const JWT_SECRET = process.env.JWT_SECRET;
// Signup
exports.signup = async (req, res) => {
  const { name, email, mobile, password, referCode } = req.body;
  try {
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
  }
    const existingUser = await User.findOne({ $or: [{ email }, { mobile }] });
    console.log('Existing User:', existingUser);
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

    if (referCode) {
      const referrer = await User.findOne({ referCode });
      if (referrer) {
        newUser.referredBy = referCode;
        referrer.referralCount += 1;
        newUser.referralCounted = true;
        await referrer.save();
      }
    }

    await newUser.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


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

//Send OTP
exports.sendOtp = async (req, res) => {
  const { mobile, referCode } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
console.log('cehck the otp here', otp);
  try {
    await OTP.findOneAndUpdate(
      { mobile },
      { otp, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOTPViaSMS(mobile, otp);

    let user = await User.findOne({ mobile });
    console.log('check the user here fot otp', user)
    if (!user) {
      
      // --- FINAL, ROBUST NAME GENERATION ---

      // Step 1: Generate the creative base name
      const adjectives = ['Swift', 'Mighty', 'Clever', 'Brave', 'Dashing', 'Royal', 'Super', 'Grand', 'Fearless', 'Agile', 'Prime'];
      const nouns = ['Striker', 'Captain', 'Challenger', 'Knight', 'Eagle', 'Titan', 'Panther', 'King', 'Master', 'Star', 'Lion'];
      const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
      const baseName = `${randomAdjective}${randomNoun}`;

      // Step 2: Manually create a new, unique ObjectId for our new user.
      const newUserId = new mongoose.Types.ObjectId();
      
      // Step 3: Create the guaranteed unique name using this new ID.
      const finalName = `${baseName}_${newUserId.toString().slice(-5)}`;
console.log('check final name here', finalName);
      // Step 4: Create the new user instance with ALL data provided at once.
      user = new User({
        _id: newUserId, // Explicitly set the new ID
        name: finalName,  // Explicitly set the new name
        mobile,
        signupMode: 'otp',
        referCode: generateReferCode(),
      });
      console.log('check the user here', user);
      // --- END OF NEW LOGIC ---

      // Step 5: Handle referrals and save the user
      if (referCode) {
        const referrer = await User.findOne({ referCode });
        if (referrer) {
          user.referredBy = referCode;
          referrer.referralCount += 1;
          await referrer.save();
          user.referralCounted = true;
        }
      }

      await user.save();
    }

    res.json({ message: 'OTP sent successfully' });

  } catch (err) {
    console.error('❌ sendOtp Error:', err);
    res.status(500).json({ message: err.message || 'Failed to send OTP' });
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
      // Verify access token and get user info
      const fbURL = `https://graph.facebook.com/v12.0/${userID}?fields=id,name,email&access_token=${accessToken}`;
      const { data } = await axios.get(fbURL);
  
      if (!data || !data.email) {
        return res.status(400).json({ message: 'Unable to retrieve Facebook user data' });
      }
  
      let user = await User.findOne({ email: data.email });
  
      if (!user) {
        // Create new user
        user = await User.create({
          name: data.name,
          email: data.email,
          password: null, // No password needed
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
  
      // 1. Check if a file was actually uploaded.
      // The file is available at req.file thanks to the 'multer' middleware we'll set up.
      if (!req.file) {
        return res.status(400).json({ message: 'No image file provided.' });
      }
  
      // 2. Upload the file to Cloudinary.
      // The 'path' property points to the temporary location where multer saved the file.
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'fantasy_app_profiles', // Optional: Organizes uploads into a specific folder
        resource_type: 'image',
        transformation: [ // Optional: Auto-transforms the image for optimization
          { width: 250, height: 250, gravity: "face", crop: "fill" }
        ]
      });
  
      // 3. Once the upload is complete, we don't need the temporary file anymore.
      fs.unlinkSync(req.file.path);
  
      // 4. Update the user's document with the secure URL from Cloudinary.
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { profileImage: result.secure_url } },
        { new: true } // 'new: true' returns the updated document
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
      // If a temp file was created but an error occurred, try to delete it.
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      res.status(500).json({ message: 'Image upload failed.', error: error.message });
    }
  };