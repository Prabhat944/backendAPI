require('dotenv').config();
require('./cron/contestScheduler');
require('./cron/matchStatsCron');
require('./cron/updateUpcomingSereis');
require('./cron/updateUpcomingMatches');
require('./cron/updateSquadsCron');
require('./cron/updateRecentMatchesCron');
require('./cron/updateTeamPoints');
require('./cron/updateContestStatusCron');
require('./cron/updateCancelContestAndRefund');
require('./cron/creditWinnings');
require('./cron/calculateMatchResultsCron')
require('./cron/updateSeasonStatsCron');
require('./cron/processOffersCron');
require('./cron/updateUserStats');
require('./cron/generateLeaderboardCron');
require('dotenv').config();
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./route/authRoute');
const cricketRoutes = require('./route/cricketRoutes');
const userRoutes = require('./route/userRoute');
const teamRoutes = require('./route/teamRoute');
const statsRoutes = require('./route/statsRoutes');
const contestCalculateRoutes = require('./route/contestCalculateRoute');
const profileRoute = require('./route/profileRoutes')
const checkContestRoute = require('./route/contestControllerRoute')
const pointRoutes = require('./route/pointRoute')
const contest = require('./route/contest');
const contestControllerRoutes = require('./route/contestControllerRoute');
const wallerRoute = require('./route/walletRoute')
const supportTicketRoute = require('./route/supportTicketRoute')
const supportEmailRoute = require('./route/supportEmailRoute');
const kycRoutes = require('./route/kycRoutes'); // Import new routes
const playerPointRoutes = require('./route/playerStatsRoute')
const offerRoutes = require('./route/offerRoute'); // Import offer routes
const leaderboardRoutes = require('./route/leaderboardRoutes');
// const seriesRoutes = require('./route/seriesRoutes');
const cors = require('cors')
require('./config/cloudinary');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
// Routes
// Logging middleware (Optional for debugging)
app.use((req, res, next) => {
  console.log("Incoming Request Body:", req.body);
  next();
});
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/cricket', cricketRoutes);
app.use('/api/v1/user', userRoutes)
app.use('/api/v1/team', teamRoutes);
app.use('/api', statsRoutes);
app.use('/api/v1/contest', contestCalculateRoutes);
app.use('/api/v1/profile', profileRoute)
app.use('/api/v1/check_contest', checkContestRoute)
app.use('/api/v1/point', pointRoutes)
app.use('/api/contest', contest)
app.use('/api/v1/wallet', wallerRoute)
app.use('/api/v1/ticket', supportTicketRoute)
app.use('/api/v1/supportEmail', supportEmailRoute)
app.use('/api/v1/kyc', kycRoutes); // Use the new KYC routes
app.use('/api/v1/playerStats', playerPointRoutes);
app.use('/api/v1/offer', offerRoutes); // Use the offer routes
app.use('/api/v1/leaderboards', leaderboardRoutes);
app.use('/api/v1/contestController', contestControllerRoutes);
// app.use('/api/v1/series', seriesRoutes);
  
app.get('/', (req, res) => {
  res.send('API is running...');
});

module.exports = app;
