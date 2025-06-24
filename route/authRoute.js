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
  uploadProfileImage
} = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = multer({ dest: 'uploads/' });

console.log('---------s')
router.post('/signup', signup);
router.post('/login', login);
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password/:token', resetPassword);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/google-login', googleLogin);
router.post('/facebook-login', facebookLogin);
router.post(
  '/upload-profile-image',
  authMiddleware,
  upload.single('profileImage'),
  uploadProfileImage
);


module.exports = router;
