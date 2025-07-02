// models/SupportTicket.js
const mongoose = require('mongoose');

const supportTicketSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to your User model
        required: true,
        index: true // Index for efficient lookup by user
    },
    email: { // User's email, for convenience or if ticket submitted by non-logged-in user
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, 'Please fill a valid email address'] // Basic email regex
    },
    subject: {
        type: String,
        required: true,
        enum: ['Deposits', 'Withdrawals', 'KYC Error', 'Contest', 'Others', 'Technical Issue', 'Feedback', 'Referral Issue'], // Expand as needed
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: 10 // Minimum length for description
    },
    attachments: [{ // Array of URLs to uploaded files (e.g., Cloudinary URLs)
        type: String,
        trim: true
    }],
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
        default: 'Open'
    },
    // Optional: Fields for internal use by support team
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AdminUser' // If you have an Admin user model
    },
    resolutionNotes: {
        type: String,
        trim: true
    },
    // Optional: Priority
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    }
}, { timestamps: true }); // `createdAt` and `updatedAt` for tracking ticket lifecycle

module.exports = mongoose.model('SupportTicket', supportTicketSchema);