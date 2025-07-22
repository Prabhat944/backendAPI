const express = require('express');
const router = express.Router();
const multer = require('multer'); // ✅ --- THIS LINE IS THE FIX ---
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
  sendOtp,
  verifyOtp,
  googleLogin,
  facebookLogin,
  uploadProfileImage,
  logout,
  validateToken,
  searchUsers,
  getUserDetailsById
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = multer({ dest: 'uploads/' });
const {  
  otpLimiter,
  loginLimiter,
  uploadLimiter,
  generalLimiter // For general Browse actions
} = require('../middleware/rateLimiters');

console.log('---------s')
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.post('/send-otp', otpLimiter, sendOtp);
router.post('/verify-otp', loginLimiter, verifyOtp);
router.post('/google-login', loginLimiter, googleLogin);
router.post('/facebook-login', loginLimiter, facebookLogin);
router.post('/logout', authMiddleware, logout);
router.post(
  '/upload-profile-image',
  authMiddleware,
  uploadLimiter,
  upload.single('profileImage'),
  uploadProfileImage
);
router.post('/users/validate-token', generalLimiter, validateToken);
router.get('/search', authMiddleware, generalLimiter, searchUsers);
router.get('/:id', authMiddleware, generalLimiter, getUserDetailsById);
module.exports = router;
