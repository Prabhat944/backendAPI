const express = require('express');
const router = express.Router();
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  googleLogin,
  facebookLogin
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

console.log('---------s')
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google-login', googleLogin);
router.post('/facebook-login', facebookLogin);




module.exports = router;
