// controllers/kycController.js
const User = require('../models/userModel');
const cloudinary = require('cloudinary').v2; // For file uploads
const fs = require('fs'); // For deleting local files after upload

// Optional: Import a KYC service client if you integrate with a third-party API
// const kycApiClient = require('../utils/kycApiClient'); // A hypothetical client for external KYC verification

/**
 * @desc Submit PAN details for KYC verification
 * @route POST /api/kyc/submit-pan
 * @access Private (User Auth)
 * @body {string} panNumber, {string} nameOnPan, {string} dob (YYYY-MM-DD format)
 * @file {Express.Multer.File} panImage (optional)
 */
exports.submitPanDetails = async (req, res) => {
    const userId = req.user._id;
    const { panNumber, nameOnPan, dob } = req.body; // dob should be a string in YYYY-MM-DD
    const panImage = req.file; // From multer middleware

    if (!panNumber || !nameOnPan || !dob) {
        return res.status(400).json({ message: 'PAN number, name on PAN, and Date of Birth are required.' });
    }

    // Basic PAN format validation (Example, enhance with more strict regex if needed)
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid PAN number format.' });
    }
    // Basic DOB format check (e.g., YYYY-MM-DD) and age check (e.g., > 18 years)
    const dobDate = new Date(dob);
    if (isNaN(dobDate.getTime())) { // Check if date is valid
        return res.status(400).json({ message: 'Invalid Date of Birth format. Use YYYY-MM-DD.' });
    }
    const age = new Date().getFullYear() - dobDate.getFullYear();
    if (age < 18) { // Assuming minimum age is 18
        return res.status(400).json({ message: 'You must be at least 18 years old to verify PAN.' });
    }

    let imageUrl = null;
    if (panImage) {
        try {
            // Upload PAN image to Cloudinary
            const result = await cloudinary.uploader.upload(panImage.path, {
                folder: `kyc/pan/${userId}`, // Organize uploads
                resource_type: 'image',
                transformation: [{ width: 800, height: 600, crop: "limit" }] // Resize/optimize
            });
            imageUrl = result.secure_url;
            fs.unlinkSync(panImage.path); // Delete local temp file
        } catch (uploadError) {
            console.error('Error uploading PAN image to Cloudinary:', uploadError);
            return res.status(500).json({ message: 'Failed to upload PAN image.' });
        }
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            // Clean up uploaded image if user not found after upload
            if (imageUrl) await cloudinary.uploader.destroy(imageUrl.split('/').pop().split('.')[0]); // Basic cleanup
            return res.status(404).json({ message: 'User not found.' });
        }

        // Prevent resubmission if already verified/pending
        if (user.pan.status === 'Verified' || user.pan.status === 'Pending') {
            return res.status(400).json({ message: `PAN is already ${user.pan.status}.` });
        }

        user.pan = {
            number: panNumber.toUpperCase(),
            nameOnPan: nameOnPan,
            dob: dobDate,
            imageUrl: imageUrl,
            status: 'Pending', // Set status to pending for review/external verification
            rejectionReason: null // Clear previous rejection reason
        };

        // Optional: Call external PAN verification API here
        // const panVerificationResult = await kycApiClient.verifyPan(panNumber, nameOnPan);
        // if (panVerificationResult.isValid && panVerificationResult.matchesName) {
        //     user.pan.status = 'Verified';
        // } else {
        //     user.pan.status = 'Rejected';
        //     user.pan.rejectionReason = panVerificationResult.reason || 'PAN details did not match records.';
        // }

        await user.save(); // pre-save hook will update kycStatus

        res.status(200).json({ message: 'PAN details submitted for verification.', kycStatus: user.kycStatus, panStatus: user.pan.status });

    } catch (error) {
        console.error('Error submitting PAN details:', error);
        // Clean up uploaded image if database save fails
        if (imageUrl) await cloudinary.uploader.destroy(imageUrl.split('/').pop().split('.')[0]);
        res.status(500).json({ message: 'Failed to submit PAN details.' });
    }
};

/**
 * @desc Submit Bank Account details for KYC verification
 * @route POST /api/kyc/submit-bank
 * @access Private (User Auth)
 * @body {string} accountNumber, {string} ifscCode, {string} accountHolderName, {string} bankName
 * @file {Express.Multer.File} passbookImage (optional)
 */
exports.submitBankDetails = async (req, res) => {
    const userId = req.user._id;
    const { accountNumber, ifscCode, accountHolderName, bankName } = req.body;
    const passbookImage = req.file;

    if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
        return res.status(400).json({ message: 'Account number, IFSC code, account holder name, and bank name are required.' });
    }
    // Basic IFSC format validation
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase())) {
        return res.status(400).json({ message: 'Invalid IFSC code format.' });
    }

    let imageUrl = null;
    if (passbookImage) {
        try {
            const result = await cloudinary.uploader.upload(passbookImage.path, {
                folder: `kyc/bank/${userId}`,
                resource_type: 'image',
                transformation: [{ width: 800, height: 600, crop: "limit" }]
            });
            imageUrl = result.secure_url;
            fs.unlinkSync(passbookImage.path);
        } catch (uploadError) {
            console.error('Error uploading passbook image to Cloudinary:', uploadError);
            return res.status(500).json({ message: 'Failed to upload passbook image.' });
        }
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            if (imageUrl) await cloudinary.uploader.destroy(imageUrl.split('/').pop().split('.')[0]);
            return res.status(404).json({ message: 'User not found.' });
        }

        if (user.bankAccount.status === 'Verified' || user.bankAccount.status === 'Pending') {
            return res.status(400).json({ message: `Bank account is already ${user.bankAccount.status}.` });
        }

        user.bankAccount = {
            accountNumber: accountNumber,
            ifscCode: ifscCode.toUpperCase(),
            accountHolderName: accountHolderName,
            bankName: bankName,
            passbookImageUrl: imageUrl,
            status: 'Pending',
            rejectionReason: null
        };

        // Optional: Call external Bank verification API here (e.g., Penny Drop Test)
        // const bankVerificationResult = await kycApiClient.verifyBank(accountNumber, ifscCode);
        // if (bankVerificationResult.isValid && bankVerificationResult.matchesName) {
        //     user.bankAccount.status = 'Verified';
        // } else {
        //     user.bankAccount.status = 'Rejected';
        //     user.bankAccount.rejectionReason = bankVerificationResult.reason || 'Bank account details could not be verified.';
        // }

        await user.save(); // pre-save hook will update kycStatus

        res.status(200).json({ message: 'Bank details submitted for verification.', kycStatus: user.kycStatus, bankStatus: user.bankAccount.status });

    } catch (error) {
        console.error('Error submitting Bank details:', error);
        if (imageUrl) await cloudinary.uploader.destroy(imageUrl.split('/').pop().split('.')[0]);
        res.status(500).json({ message: 'Failed to submit bank details.' });
    }
};

/**
 * @desc Get user's current KYC status and details
 * @route GET /api/kyc/status
 * @access Private (User Auth)
 */
exports.getKycStatus = async (req, res) => {
    const userId = req.user._id;
    try {
        const user = await User.findById(userId).select('kycStatus canWithdraw pan bankAccount');
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        res.status(200).json({
            kycStatus: user.kycStatus,
            canWithdraw: user.canWithdraw,
            pan: user.pan,
            bankAccount: user.bankAccount
        });
    } catch (error) {
        console.error('Error fetching KYC status:', error);
        res.status(500).json({ message: 'Failed to fetch KYC status.' });
    }
};

// Admin endpoints (Optional, for manual review/status updates)
// You would need an admin role/middleware to protect these routes
exports.updatePanStatusAdmin = async (req, res) => {
    const { userId, status, rejectionReason } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found.' });

        user.pan.status = status;
        user.pan.rejectionReason = rejectionReason || null;
        await user.save();
        res.status(200).json({ message: `PAN status updated to ${status} for user ${userId}.`, kycStatus: user.kycStatus, panStatus: user.pan.status });
    } catch (error) {
        console.error('Error updating PAN status (admin):', error);
        res.status(500).json({ message: 'Failed to update PAN status.' });
    }
};
// Similar updateBankStatusAdmin function would be needed