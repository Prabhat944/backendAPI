// middleware/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // <-- ADD THIS LINE

// Ensure 'uploads/' directory exists
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Setup storage engine for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Use the variable
  },
  filename: (req, file, cb) => {
    // This is correct in code, the markdown was just rendering it weirdly
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

// File filter to allow only specific file types (optional but recommended)
const fileFilter = (req, file, cb) => {
  // UPDATED: Include PDF for KYC documents
  const allowedFileTypes = /jpeg|jpg|png|pdf/; // Removed gif, doc, docx as they are less common for strict KYC
  const extname = allowedFileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedFileTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    // Make the error message more specific
    cb(new Error('Error: File upload only supports JPEG, PNG, JPG, or PDF images for KYC!'), false);
  }
};

// Initialize upload middleware
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB file size limit
  fileFilter: fileFilter,
});

// You can export configured multer instances for specific usage
// This file correctly exports the `upload` instance
module.exports = upload;