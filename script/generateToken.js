// generateInternalToken.js
const jwt = require('jsonwebtoken');

// IMPORTANT: Use the same JWT_SECRET from your .env files
const JWT_SECRET = 'supersecretjwtkey';

// 1. This payload contains the special flag your new middleware checks for.
const payload = {
  description: 'Token for internal service-to-service communication',
  isSystemInternal: true 
};

// 2. Set the token to be valid for 1 year.
const options = {
  expiresIn: '365d'
};

// 3. Generate the token.
const token = jwt.sign(payload, JWT_SECRET, options);

// 4. Print the final token to the console.
console.log('--- Your New Internal Service Token ---');
console.log(token);
console.log('------------------------------------');