// // authMiddleware.js
// const jwt = require('jsonwebtoken');
// const User = require('../models/userModel');
// const BlacklistedToken = require('../models/BlacklistedToken'); // Import the new model
// const JWT_SECRET = process.env.JWT_SECRET;

// const authMiddleware = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer '))
//     return res.status(401).json({ message: 'No token provided' });

//   const token = authHeader.split(' ')[1];

//   try {
//     // 1. Check if the token is blacklisted
//     const isBlacklisted = await BlacklistedToken.exists({ token: token });
//     if (isBlacklisted) {
//       return res.status(401).json({ message: 'Token is blacklisted. Please log in again.' });
//     }

//     // 2. Verify the JWT
//     const decoded = jwt.verify(token, JWT_SECRET);
//     const user = await User.findById(decoded.userId).select('-password');   
//     if (!user) return res.status(404).json({ message: 'User not found' });

//     // Attach token and user to request for potential use in logout or other middleware
//     req.token = token; // Store the actual token string
//     req.user = user;
//     next();
//   } catch (err) {
//     // Handle specific JWT errors
//     if (err.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Token expired' });
//     }
//     if (err.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token' });
//     }
//     // Catch any other unexpected errors
//     console.error('Auth middleware error:', err);
//     res.status(500).json({ message: 'Authentication failed' });
//   }
// };

// module.exports = authMiddleware;

// authMiddleware.js
// authMiddleware.js
// In your middleware file (e.g., authMiddleware.js)

const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const BlacklistedToken = require('../models/BlacklistedToken');

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

// Main middleware for user authentication
// const authMiddleware = async (req, res, next) => {
//   const authHeader = req.headers.authorization;
//   if (!authHeader || !authHeader.startsWith('Bearer ')) {
//     return res.status(401).json({ message: 'No token provided' });
//   }

//   const token = authHeader.split(' ')[1];

//   try {
//     // 1. Your existing blacklist check (good for explicit logout)
//     const isBlacklisted = await BlacklistedToken.exists({ token: token });
//     if (isBlacklisted) {
//       return res.status(401).json({ message: 'Token is blacklisted. Please log in again.' });
//     }

//     // 2. Verify the JWT signature and expiration
//     const decoded = jwt.verify(token, JWT_SECRET);

//     // 3. Find the user from the database
//     const user = await User.findById(decoded.userId).select('-password');   
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // ✅ --- START OF UPDATE --- ✅
//     // 4. Enforce single session: Check if the token from the request
//     // matches the token saved in the user's record.
//     if (user.token !== token) {
//       // If they don't match, it means the user has logged in from another device.
//       // Deny access for this (older) token.
//       return res.status(401).json({ message: 'Session expired. Please log in again.' });
//     }
//     // ✅ --- END OF UPDATE --- ✅

//     // 5. If all checks pass, attach user and token to the request
//     req.token = token;
//     req.user = user;
//     next();

//   } catch (err) {
//     if (err.name === 'TokenExpiredError') {
//       return res.status(401).json({ message: 'Token expired' });
//     }
//     if (err.name === 'JsonWebTokenError') {
//       return res.status(401).json({ message: 'Invalid token' });
//     }
//     console.error('Auth middleware error:', err);
//     res.status(500).json({ message: 'Authentication failed' });
//   }
// };
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');   
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    console.log('\n--- AUTH MIDDLEWARE CHECK ---');
    console.log(`Route being accessed: ${req.path}`);
    console.log(`Token from Postman/Emulator: ...${token.slice(-10)}`);
    console.log(`Token stored in Database: ...${user.token ? user.token.slice(-10) : 'NOT FOUND'}`);
    console.log(`Are tokens the same? ${user.token === token}`);
    console.log('---------------------------\n');
    // ✅ --- THIS IS THE DOOR LOCK CHECK --- ✅
    // Does the key the user presented (`token` from the request)
    // match the newest key we have on file (`user.token` from the DB)?
    if (user.token !== token) {
      // If not, REJECT. This is an old key from a different device.
      return res.status(401).json({ message: 'Session expired. You have been logged out because you logged in on another device.' });
    }
    // ✅ --- END OF THE DOOR LOCK CHECK --- ✅
    
    // If the key is correct, let the user in.
    req.token = token;
    req.user = user;
    next();

  } catch (err) {
    // This catches generally invalid or expired keys
    return res.status(401).json({ message: 'Authentication failed. Please log in again.' });
  }
};
// Your internal protection middleware (no changes needed)
const protectInternal = (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    }

    if (token && token === INTERNAL_API_TOKEN) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized for this internal route.' });
    }
};

// Attaching the internal middleware property (no changes needed)
authMiddleware.protectInternal = protectInternal;

// Default export (no changes needed)
module.exports = authMiddleware;