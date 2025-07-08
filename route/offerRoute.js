const express = require('express');
const router = express.Router();
const offerService = require('../services/offerSeervice');
// const authMiddleware = require('../middleware/authMiddleware');


/**
 * @route   GET /api/users/active-offer
 * @desc    Gets the active deposit offer by calling the offer service
 * @access  Public or Private (depending on your auth middleware)
 */
router.get('/active-offer', async (req, res) => {
    try {
      // Extract the token from the Authorization header of the incoming request.
      // The client (e.g., your frontend app) must send this.
      const token = req.headers.authorization?.split(' ')[1];
  
      if (!token) {
        // Depending on your security, you might want to require a token.
        // For now, we'll proceed, but you could return an error here.
        // return res.status(401).json({ message: 'Authorization token is missing.' });
      }
  
      // Call your service function with the token
      const activeOffer = await offerService.getActiveOfferFromOfferService(token);
  
      // Send the data received from the offer service back to the client
      res.status(200).json(activeOffer);
  
    } catch (error) {
      // This will catch errors from the axios call (like 404 or 500)
      // and pass a clean message to the client.
      console.error('Error in user service while fetching offer:', error.message);
      
      const statusCode = error.response?.status || 500;
      const message = error.response?.data?.message || 'An internal server error occurred.';
  
      res.status(statusCode).json({ message });
    }
  });
  
  module.exports = router;