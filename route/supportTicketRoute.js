// routes/supportTicketRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Your auth middleware
const supportTicketController = require('../controllers/supportTicketController');
const upload = require('../middleware/upload'); // Multer upload middleware

// Route to create a new support ticket
// 'attachments' is the field name for your file input in the frontend form
// .array('attachments', 5) means it expects multiple files (up to 5)
// all under the field name 'attachments'
router.post(
    '/',
    authMiddleware, // User must be logged in to create a ticket
    upload.array('attachments', 5), // Allow up to 5 attachments
    supportTicketController.createSupportTicket
);

// Route to get all tickets for the authenticated user
router.get('/my', authMiddleware, supportTicketController.getUserTickets);

// Optional: Route to get a specific ticket by ID
router.get('/:ticketId', authMiddleware, supportTicketController.getTicketById);


module.exports = router;