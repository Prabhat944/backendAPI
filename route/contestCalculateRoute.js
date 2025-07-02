const express = require('express');
const router = express.Router();
// Ensure this path correctly points to your modified calculateContestResults function
const {calculateContestResults,createDummyContest, getContestsByMatchId} = require('../utils/calculateContestResults'); 

router.post('/calculate-results', async (req, res) => {
  const { matchId, contestId } = req.body;

  if (!matchId || !contestId) {
    return res.status(400).json({ success: false, message: 'matchId and contestId are required in the request body' });
  }

  try {
    // Call the modified calculateContestResults function and store its return value
    const result = await calculateContestResults(matchId, contestId);

    // Check the 'success' flag from the result
    if (result.success) {
      // If successful, send back the message and the processed data (which includes ranks, winners, prizes)
      res.status(200).json({ 
        success: true, 
        message: result.message, 
        data: result.data 
      });
    } else {
      // If not successful (e.g., no participations, contest not found, or other error during calculation)
      // Send back the error message and any partial data if available
      // You might want to use a different status code depending on the type of failure,
      // For example, 404 if contest/participations not found, 500 for unexpected server errors.
      // For simplicity here, we'll use 400 for client-side type errors or known non-critical failures.
      // The calculateContestResults function itself handles internal try-catch for major errors.
      let statusCode = 400; // Default for "bad request" or known issues like "no participations"
      if (result.message && result.message.toLowerCase().includes('error calculating results')) {
        statusCode = 500; // Internal server error if the function itself caught a major exception
      } else if (result.message && (result.message.toLowerCase().includes('no participations found') || result.message.toLowerCase().includes('contest not found'))) {
        statusCode = 404; // Not found
      }
      
      res.status(statusCode).json({ 
        success: false, 
        message: result.message, 
        data: result.data // This might be an empty array or partially processed data
      });
    }
  } catch (error) {
    // This catch block handles unexpected errors within the route handler itself
    console.error('API level error in /calculate-results route:', error);
    res.status(500).json({ 
        success: false, 
        message: 'An unexpected error occurred on the server while processing results.' 
    });
  }
});

router.get('/create-contest', async (req, res) => {
   const matchId = req.query.matchId;
  try {
    const result = await createDummyContest(matchId);
      res.status(200).json({ 
        success: false, 
        message: result.message, 
        data: result.data
      });
    } catch (error) {
    // This catch block handles unexpected errors within the route handler itself
    console.error('API level error in /calculate-results route:', error);
    res.status(500).json({ 
        success: false, 
        message: 'An unexpected error occurred on the server while processing results.' 
    });
  }
});

router.get('/get-contests', async (req, res) => {
   const matchId = req.query.matchId;
  try {
    const result = await getContestsByMatchId(matchId);
      res.status(200).json({ 
        success: true, 
        message: result.message, 
        data: result
      });
    } catch (error) {
    console.error('API level error in /calculate-results route:', error);
    res.status(500).json({ 
        success: false, 
        message: 'An unexpected error occurred on the server while processing results.' 
    });
  }
});


module.exports = router;