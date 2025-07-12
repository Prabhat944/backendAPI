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
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const BlacklistedToken = require('../models/BlacklistedToken');

const JWT_SECRET = process.env.JWT_SECRET;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

// This is your main middleware for users. It remains unchanged.
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const isBlacklisted = await BlacklistedToken.exists({ token: token });
    if (isBlacklisted) {
      return res.status(401).json({ message: 'Token is blacklisted. Please log in again.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');   
    if (!user) return res.status(404).json({ message: 'User not found' });

    req.token = token;
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error('Auth middleware error:', err);
    res.status(500).json({ message: 'Authentication failed' });
  }
};

// This is the new middleware for internal routes. It also remains unchanged.
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


// 👇 --- THE NEW EXPORT METHOD ---
// We attach `protectInternal` as a property of the main `authMiddleware` function.
authMiddleware.protectInternal = protectInternal;

// Now, we export `authMiddleware` as the default.
// This makes the change non-breaking for all your existing files.
module.exports = authMiddleware;