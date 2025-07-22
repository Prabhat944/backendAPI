const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const { generalLimiter, sensitiveActionLimiter } = require('../middleware/rateLimiters');
const User = require('../models/userModel')


router.get('/me', authMiddleware, generalLimiter, authController.getCurrentUser);
router.put('/update', authMiddleware, sensitiveActionLimiter, authController.updateUser);
// In User Service
router.get('/by-id/:userId', async (req, res) => {
    console.log('Incoming user lookup for:', req.params.userId);
    try {
      const user = await User.findById(req.params.userId);
      console.log('Found user:', user ? user._id : 'none');
      
      if (!user) {
        console.warn('User not found');
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json(user);
    } catch (err) {
      console.error('User lookup error:', err);
      res.status(500).json({ message: 'Server error' });
    }
  });

module.exports = router;
