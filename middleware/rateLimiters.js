const rateLimit = require('express-rate-limit');

// A general limiter for most API calls.
// Allows 100 requests per 15 minutes from a single IP.
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: 'draft-7', // Recommended setting for RateLimit headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again after 15 minutes.'
});

// A stricter limiter for sensitive actions like joining contests or creating teams.
// Allows 20 requests per 15 minutes.
const sensitiveActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many attempts to join contests or create teams. Please try again later.'
});

// A very strict limiter for sending OTPs to prevent abuse ("OTP Bombing").
// Allows only 5 requests per 10 minutes.
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Too many OTP requests. Please try again after 10 minutes.'
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    limit: 20, // Limit each IP to 20 uploads per hour
    message: 'You have reached your upload limit, please try again after an hour.',
    standardHeaders: 'draft-7',
    legacyHeaders: false,
});

const loginLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	limit: 10, // Limit each IP to 10 login attempts per 15 mins
	message: 'Too many login attempts from this IP, please try again after 15 minutes',
	standardHeaders: 'draft-7',
	legacyHeaders: false,
});

module.exports = {
  generalLimiter,
  sensitiveActionLimiter,
  otpLimiter,
  uploadLimiter,
  loginLimiter
};