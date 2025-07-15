const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Your JWT auth middleware
const userProfileController = require('../controllers/userProfileController');

router.get('/me/detailed', authMiddleware, userProfileController.getDetailedUserProfile);
router.get('/profile/:id', authMiddleware, userProfileController.getPublicUserProfileById);

module.exports = router;