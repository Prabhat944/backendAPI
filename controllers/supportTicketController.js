// controllers/supportTicketController.js
const SupportTicket = require('../models/SupportTicket');
const cloudinary = require('cloudinary').v2; // Assuming Cloudinary for file uploads
const fs = require('fs'); // For deleting local files after upload

// Configure Cloudinary (ensure this is done in your app's main setup or env vars)
// cloudinary.config({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET
// });

exports.createSupportTicket = async (req, res) => {
    // userId will come from authMiddleware, as this is a protected route
    const userId = req.user._id; 
    const { email, subject, description } = req.body;

    if (!email || !subject || !description) {
        return res.status(400).json({ message: 'Email, subject, and description are required.' });
    }

    if (description.length < 10) {
        return res.status(400).json({ message: 'Description must be at least 10 characters long.' });
    }

    // Handle file uploads (req.files will be populated by multer)
    let attachmentUrls = [];
    if (req.files && req.files.length > 0) {
        try {
            // Upload each file to Cloudinary
            for (const file of req.files) {
                const result = await cloudinary.uploader.upload(file.path, {
                    folder: `support_tickets/${userId}`, // Organize by user ID
                    resource_type: 'auto', // Auto-detect image/video/raw
                    use_filename: true,
                    unique_filename: false,
                    overwrite: false
                });
                attachmentUrls.push(result.secure_url);
                fs.unlinkSync(file.path); // Delete local temp file
            }
        } catch (uploadError) {
            console.error('Error uploading attachments to Cloudinary:', uploadError);
            // Even if upload fails, try to create the ticket without attachments
            // Or return error if attachments are mandatory
            return res.status(500).json({ message: 'Failed to upload attachments.', error: uploadError.message });
        }
    }

    try {
        const newTicket = new SupportTicket({
            user: userId,
            email,
            subject,
            description,
            attachments: attachmentUrls // Save the Cloudinary URLs
        });

        await newTicket.save();
        res.status(201).json({ message: 'Support ticket created successfully!', ticket: newTicket });

    } catch (error) {
        console.error('Error creating support ticket:', error);
        // Clean up any uploaded files if ticket creation fails after successful upload
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            });
        }
        res.status(500).json({ message: 'Failed to create support ticket.', error: error.message });
    }
};

// Optional: Get tickets for a user
exports.getUserTickets = async (req, res) => {
    const userId = req.user._id;
    try {
        const tickets = await SupportTicket.find({ user: userId }).sort({ createdAt: -1 });
        res.status(200).json({ tickets });
    } catch (error) {
        console.error('Error fetching user tickets:', error);
        res.status(500).json({ message: 'Failed to fetch tickets.' });
    }
};

// Optional: Get a single ticket by ID (e.g., for status update by admin or user viewing details)
exports.getTicketById = async (req, res) => {
    const { ticketId } = req.params;
    const userId = req.user._id; // Ensure user can only see their own tickets, or admin can see any

    try {
        const ticket = await SupportTicket.findOne({ _id: ticketId, user: userId }); // For user's own ticket
        // Or if admin: const ticket = await SupportTicket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ message: 'Ticket not found or you do not have permission to view it.' });
        }
        res.status(200).json({ ticket });
    } catch (error) {
        console.error('Error fetching ticket by ID:', error);
        res.status(500).json({ message: 'Failed to fetch ticket.' });
    }
};