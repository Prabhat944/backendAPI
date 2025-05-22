const { matchUpdateBallByBall, recentMatchesList } = require('../services/cricketService');
const parseMatchData = require('../utils/parseMatchData');

const updateMatchStatsCron = async () => {
  try {
    const res = await recentMatchesList(); // Your API function
    const recentMatches = res.data;
    const liveMatches = recentMatches.filter(m => m.matchStarted && m.matchEnded);
console.log('Live Matches:', liveMatches);
    for (const match of liveMatches) {
      try {
        const bbbRes = await matchUpdateBallByBall(match.match_id || match.id);
        console.log('Ball by Ball Response:', bbbRes);
        const bbb = bbbRes?.data?.bbb;
console.log('Ball by Ball:', bbb);
        if (bbb && Array.isArray(bbb)) {
          await parseMatchData(bbb, match.id.toString(), match.format || 'T20'); // provide fallback format
          console.log(`Updated stats for match ${match.id}`);
        } else {
          console.warn(`No bbb found for match ${match.id}`);
        }
      } catch (err) {
        console.error(`Error processing match ${match.id}: ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Error fetching recent matches:', err.message);
  }
};

module.exports = updateMatchStatsCron;
