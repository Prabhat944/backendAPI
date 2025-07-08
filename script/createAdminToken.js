// generate-admin-token.js
const jwt = require('jsonwebtoken');
require('dotenv').config(); // Load environment variables from .env file

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey'; // Use your actual secret from .env

if (JWT_SECRET === 'supersecretjwtkey') {
    console.warn("⚠️ WARNING: You are using a fallback JWT secret in generate-admin-token.js. Ensure your .env has a secure JWT_SECRET set.");
}

// Define the payload for an admin user
const adminPayload = {
    userId: '686240c67132066287f29f23', // Replace with a real or hypothetical admin user ID
    email: 'admin@yogesh5486singh@gmail.com',        // Replace with a real or hypothetical admin email
    isAdmin: true,                     // <--- THIS IS THE CRUCIAL FLAG FOR ADMIN AUTH
};

// Define token options (e.g., expiry)
const options = {
    expiresIn: '23h', // Admin tokens usually have shorter expiry for security
};

try {
    const adminToken = jwt.sign(adminPayload, JWT_SECRET, options);
    console.log("\n✅ Generated Admin User Token:\n");
    console.log(adminToken);
    console.log("\n🔐 Use this token in Postman/front-end for admin-restricted routes (e.g., /wallet/withdrawals/:id/status).");
    console.log("Remember to replace the userId and email in the script with actual admin details if applicable.");
} catch (error) {
    console.error("❌ Error generating admin token:", error.message);
}