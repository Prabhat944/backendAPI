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
  profileImage: {
    type: String,
    default: ''
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
  token: { type: String }, 
  // ✅ --- START OF KYC FIELDS ADDED ---
  // (As per your provided desired structure, combining elements from both our discussions)

  pan: { // Permanent Account Number details
    number: {
      type: String,
      trim: true,
      uppercase: true,
      default: '' // Default to empty string if not provided
    },
    nameOnPan: { // Name as per PAN card
        type: String,
        trim: true,
        default: ''
    },
    dob: { // Date of Birth as per PAN/Aadhaar (for age verification)
        type: Date,
        default: null
    },
    imageUrl: { // URL to uploaded PAN card image
        type: String,
        default: ''
    },
    status: { // Verification status of PAN
        type: String,
        enum: ['Unverified', 'Pending', 'Verified', 'Rejected'],
        default: 'Unverified'
    },
    rejectionReason: { type: String, default: '' } // Why it was rejected
  },

  bankAccount: { // Bank details for withdrawals
    accountNumber: {
        type: String,
        trim: true,
        default: ''
    },
    ifscCode: {
        type: String,
        trim: true,
        uppercase: true,
        default: ''
    },
    accountHolderName: { // Name as per bank account
        type: String,
        trim: true,
        default: ''
    },
    bankName: { // Name of the bank (optional but good for UI)
        type: String,
        trim: true,
        default: ''
    },
    passbookImageUrl: { // URL to uploaded passbook/cheque image
        type: String,
        default: ''
    },
    status: { // Verification status of Bank Account
        type: String,
        enum: ['Unverified', 'Pending', 'Verified', 'Rejected'],
        default: 'Unverified'
    },
    rejectionReason: { type: String, default: '' }
  },

  // Overall KYC Status (summarizes all verifications)
  kycStatus: { // This combines the verification status of PAN and Bank.
    type: String,
    enum: ['Not Started', 'Pending', 'Partially Verified', 'Verified', 'Rejected'],
    default: 'Not Started'
  },
  // Optional: Is a withdrawal allowed? (often depends on KYC status)
  canWithdraw: {
      type: Boolean,
      default: false
  },

  // Your previously existing KYC-related fields if you want to keep them for specific purposes
  // NOTE: 'upiId' and 'aadhaar' are separate verification steps often done *in addition* to PAN/Bank,
  // or as alternatives. If your main KYC relies on PAN+Bank, these might be optional/additional layers.
  upiId: { // UPI ID for direct bank transfers/payments (if separate from main bank account)
    type: String,
    trim: true,
    default: ''
  },
  
  aadhaar: { // Aadhaar details for additional verification (last 4 digits + verification status)
    numberLast4: { type: String, default: '' }, 
    isVerified: { type: Boolean, default: false }
  },

  // ✅ --- END OF KYC FIELDS ADDED ---
  
}, {
  timestamps: true // Keep this for createdAt and updatedAt
});

// Pre-save hook to update kycStatus and canWithdraw based on PAN and Bank status
userSchema.pre('save', function(next) {
    if (this.isModified('pan.status') || this.isModified('bankAccount.status')) {
        if (this.pan.status === 'Verified' && this.bankAccount.status === 'Verified') {
            this.kycStatus = 'Verified';
            this.canWithdraw = true;
        } else if (this.pan.status === 'Rejected' || this.bankAccount.status === 'Rejected') {
            this.kycStatus = 'Rejected';
            this.canWithdraw = false;
        } else if (this.pan.status === 'Pending' || this.bankAccount.status === 'Pending') {
            // If either is pending, overall KYC is pending
            this.kycStatus = 'Pending';
            this.canWithdraw = false;
        } else if (this.pan.status === 'Verified' || this.bankAccount.status === 'Verified') {
            // If one is verified but the other is Unverified/Pending
            this.kycStatus = 'Partially Verified';
            this.canWithdraw = false;
        } else {
            // Both are Unverified
            this.kycStatus = 'Not Started';
            this.canWithdraw = false;
        }
    }
    // Update timestamps on every save
    this.updatedAt = Date.now(); // This line is typically handled by `timestamps: true`, but if you had it explicitly, ensure it doesn't conflict.
    next();
});

module.exports = mongoose.model('User', userSchema);