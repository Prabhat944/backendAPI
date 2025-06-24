// models/userModel.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    required: function () {
      return this.signupMode === 'email';
    },
  },
  password: {
    type: String,
    required: function () {
      return this.signupMode === 'email';
    },
  },
  // ✅ --- NEW FIELD ADDED ---
  // This will store the URL of the user's uploaded profile picture.
  profileImage: {
    type: String,
    default: '' // Defaults to an empty string if no image is uploaded
  },
  mobile: {
    type: String,
    required: function () {
      return this.signupMode === 'otp';
    },
  },
  referCode: {
    type: String,
  },
  referredBy: {
    type: String,
  },
  referralCount: {
    type: Number,
    default: 0,
  },
  referralCounted: {
    type: Boolean,
    default: false,
  },
  signupMode: {
    type: String,
    enum: ['email', 'otp'],
    required: true,
  },
});

module.exports = mongoose.model('User', userSchema);