// models/BlacklistedToken.js
const mongoose = require('mongoose');

const blacklistedTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true, // Ensure no duplicate tokens are blacklisted
    },
    // Store the token's original expiration date. This is crucial.
    // The TTL index will use this to automatically remove expired tokens.
    expiresAt: {
        type: Date,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Create a TTL (Time-To-Live) index on the 'expiresAt' field.
// This will automatically delete documents from the collection once their 'expiresAt' date passes.
// This keeps your blacklist clean and prevents it from growing indefinitely.
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BlacklistedToken', blacklistedTokenSchema);