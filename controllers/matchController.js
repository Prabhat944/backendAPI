const cricketDataService = require('../services/cricketService');
exports.getMatchSquad = async (req, res) => {
    try {
      const { id } = req.query;
      const squad = await cricketDataService.matchSquad(id);
      res.json({ squad });
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch match squad', error: err.message });
    }
  };
  