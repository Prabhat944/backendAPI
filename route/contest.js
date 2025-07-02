const express = require('express');
const router = express.Router();
const ContestParticipation = require('../models/ContestParticipation');
const Contest = require('../models/Contest'); // Example path
const Match = require('../models/Match');   // Example path

// POST /api/contest/mark-winning-credited
router.post('/mark-winning-credited', async (req, res) => {
  const { userId, matchId } = req.body;

  if (!userId || !matchId) {
    return res.status(400).json({ message: 'userId and matchId are required.' });
  }

  try {
    await ContestParticipation.updateMany(
      { user: userId, matchId },
      { $set: { isWinningCredited: true } }
    );
    res.json({ message: 'Winning credit status updated successfully.' });
  } catch (err) {
    console.error('[mark-winning-credited] Error:', err);
    res.status(500).json({ message: 'Failed to update credit status', error: err.message });
  }
});

// GET /api/contest/details-by-ids
router.get('/details-by-ids', async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
      return res.status(200).json([]);
  }
  try {
      const contests = await Contest.find({ _id: { $in: ids } }).select('_id name prizePool entryFee').lean(); // Select necessary fields
      console.log('check the contest here', contests);
      res.status(200).json(contests);
  } catch (error) {
      console.error("Error fetching contest details by IDs:", error);
      res.status(500).json({ message: "Failed to fetch contest details." });
  }
});

// GET /api/match/details-by-ids
// In contest service
router.get('/match/details-by-ids', async (req, res) => {
  const ids = req.query.ids ? req.query.ids.split(',') : [];
  if (!ids.length) {
      return res.status(200).json([]);
  }
  
  try {
      // Create separate queries for UUIDs and ObjectIds
      const uuidIds = ids.filter(id => id.length === 36);
      const objectIds = ids.filter(id => id.length === 24);
      
      let query = {};
      if (uuidIds.length && objectIds.length) {
          query = { $or: [{ matchId: { $in: uuidIds } }, { _id: { $in: objectIds } }] };
      } else if (uuidIds.length) {
          query = { matchId: { $in: uuidIds } };
      } else if (objectIds.length) {
          query = { _id: { $in: objectIds } };
      }
      
      const matches = await Match.find(query).select('_id matchId name team1 team2').lean();
      
      const formattedMatches = matches.map(match => ({
          _id: match._id,
          matchId: match.matchId,
          name: match.name || `${match.team1} vs ${match.team2}`
      }));
      
      res.status(200).json(formattedMatches);
  } catch (error) {
      console.error("Error fetching match details by IDs:", error);
      res.status(500).json({ message: "Failed to fetch match details." });
  }
});
// --- NEW ROUTE ADDED HERE: GET winners for a match ---
// This route calculates and returns the winners for a given matchId.
// It's typically called by a cron job or the Wallet Service's credit function.
router.get('/winners/:matchId', async (req, res) => {
  const { matchId } = req.params;

  if (!matchId) {
    return res.status(400).json({ message: 'Match ID is required to get winners.' });
  }

  try {
    // Find all participations for the given matchId where isWinner is true
    const winners = await ContestParticipation.find({
      matchId: matchId,
      isWinner: true,
      // You might also want to add: isWinningCredited: false if you only want uncredited winners
    })
    .populate('contestId', 'name prizePool entryFee') // Populate contest details
    .lean(); // Use .lean() for plain JS objects

    // Format the winners data to include necessary info for Wallet Service
    const formattedWinners = winners.map(winner => ({
      user: winner.user,
      prizeWon: winner.winningAmount, // Assuming ContestParticipation has a winningAmount field
      contestId: winner.contestId ? winner.contestId._id : null,
      contestName: winner.contestId ? winner.contestId.name : 'Unknown Contest',
      contestPrizePool: winner.contestId ? winner.contestId.prizePool : 0,
      matchId: winner.matchId,
      // Add other relevant fields if needed by the Wallet Service
    }));

    res.status(200).json(formattedWinners);

  } catch (err) {
    console.error(`[get-winners-for-match] Error fetching winners for match ${matchId}:`, err);
    res.status(500).json({ message: 'Failed to fetch winners for the match', error: err.message });
  }
});
// --- END OF NEW ROUTE ---

module.exports = router;