const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Your JWT auth middleware
const userProfileController = require('../controllers/userProfileController');

router.get('/me/detailed', authMiddleware, userProfileController.getDetailedUserProfile);

module.exports = router;