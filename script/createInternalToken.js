// generate-internal-token.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

if (JWT_SECRET === 'your_jwt_secret_key') {
    console.warn("⚠️ WARNING: You are using the fallback JWT secret. Ensure your .env has a secure JWT_SECRET set.");
}

// ✅ Payload only marks it as internal request — no userId or role
const payload = {
    isSystemInternal: true, // This is what your auth middleware checks
};

// Optional: You can also add metadata like service name
// payload.service = 'contestService';

const options = {
    expiresIn: '365d', // Token valid for 1 year
};

try {
    const internalToken = jwt.sign(payload, JWT_SECRET, options);
    console.log("\n✅ Generated Internal Wallet Service Token:\n");
    console.log(internalToken);
    console.log("\n🔐 Paste this into your .env as INTERNAL_WALLET_SERVICE_TOKEN in the Contest Service.");
} catch (error) {
    console.error("❌ Error generating token:", error.message);
}
