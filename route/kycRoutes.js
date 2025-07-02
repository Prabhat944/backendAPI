// routes/kycRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/upload'); // Multer middleware
const kycController = require('../controllers/kycController');

// Submit PAN details (with optional image upload)
router.post(
    '/submit-pan',
    authMiddleware,
    upload.single('panImage'), // 'panImage' is the field name from your frontend form
    kycController.submitPanDetails
);

// Submit Bank details (with optional image upload)
router.post(
    '/submit-bank',
    authMiddleware,
    upload.single('passbookImage'), // 'passbookImage' is the field name from your frontend form
    kycController.submitBankDetails
);

// Get current KYC status and submitted details for the user
router.get('/status', authMiddleware, kycController.getKycStatus);

// Admin Routes (Optional: Need separate admin authentication middleware)
// router.post('/admin/update-pan-status', adminAuthMiddleware, kycController.updatePanStatusAdmin);
// router.post('/admin/update-bank-status', adminAuthMiddleware, kycController.updateBankStatusAdmin);


module.exports = router;