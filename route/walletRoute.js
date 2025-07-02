// File: routes/walletRoutes.js (inside Contest Service)
const express = require('express');
const router = express.Router();
const walletService = require('../services/walletService');
const authMiddleware = require('../middleware/authMiddleware');

// Get wallet details
router.get('/', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  try {
    const result = await walletService.getWalletDetails(token);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to fetch wallet details' });
  }
});

// Deposit funds
router.post('/deposit', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { amount } = req.body;
  try {
    const result = await walletService.depositFunds(token, amount);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /deposit:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to deposit funds' });
  }
});

// Add winning amount
router.post('/add-winning', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { amount, userId, matchId, contestId } = req.body; // Added userId, matchId, contestId as per walletService in main service
  try {
    // If this route is called by contest service's cron, it might not have req.user, but an explicit userId
    // If it's a manual admin action, authMiddleware will populate req.user
    const result = await walletService.addWinningAmount(token, amount, userId, matchId, contestId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /add-winning:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to add winning amount' });
  }
});

// Add cashback
router.post('/add-cashback', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { amount } = req.body;
  try {
    const result = await walletService.addCashback(token, amount);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /add-cashback:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to add cashback' });
  }
});

// Add bonus
router.post('/add-bonus', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { amount } = req.body;
  try {
    const result = await walletService.addBonus(token, amount);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /add-bonus:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to add bonus' });
  }
});

// Withdraw funds
router.post('/withdraw', authMiddleware, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    const { amount } = req.body;

    try {
      const result = await walletService.withdrawFunds(token, amount);

      if (result.status && result.status !== 200) {
        return res.status(result.status).json({ message: result.message });
      }

      return res.status(200).json(result);
    } catch (error) {
      console.error('Error in wallet route /withdraw:', error.response?.data || error.message);
      res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to withdraw funds' });
    }
});


// Deduct funds
router.post('/deduct', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { amount, reason, allowSignupBonus, contestId, matchId } = req.body; // ADDED contestId, matchId
  try {
    const result = await walletService.deductFunds(token, amount, reason, allowSignupBonus, contestId, matchId); // Pass contestId, matchId
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /deduct:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to deduct funds' });
  }
});

// Refund funds
router.post('/refund', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { breakdown, reason, refundedTransactionId, contestId, matchId } = req.body; // ADDED refundedTransactionId, contestId, matchId
  try {
    const result = await walletService.refundFunds(token, breakdown, reason, refundedTransactionId, contestId, matchId); // Pass new fields
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /refund:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to refund funds' });
  }
});

// Credit all winnings for a match (doesn't need user token, handled by cron)
router.post('/credit-match-winnings', async (req, res) => { // This route is likely called internally or by cron
  const { matchId } = req.body;
  try {
    const result = await walletService.creditWinningAmountsForMatch(matchId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /credit-match-winnings:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to credit match winnings' });
  }
});

// --- NEW ROUTE ADDED HERE ---
router.get('/transactions', authMiddleware, async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { page, limit, type, sortBy, sortOrder } = req.query; // Destructure query parameters
  try {
    const result = await walletService.getTransactionsHistory(token, page, limit, type, sortBy, sortOrder);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error in wallet route /transactions:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ message: error.response?.data?.message || 'Failed to fetch transaction history' });
  }
});
// --- END OF NEW ROUTE ---

module.exports = router;