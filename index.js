require('dotenv').config();
require('./cron/contestScheduler');
require('./cron/matchStatsCron');
const express = require('express');
const connectDB = require('./config/db');
const authRoutes = require('./route/authRoute');
const cricketRoutes = require('./route/cricketRoutes');
const userRoutes = require('./route/userRoute');
const teamRoutes = require('./route/teamRoute');
const statsRoutes = require('./route/statsRoutes');
const contestCalculateRoutes = require('./route/contestCalculateRoute');
const profileRoute = require('./route/profileRoutes')
// const seriesRoutes = require('./route/seriesRoutes');
const cors = require('cors')


const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
// Routes
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/cricket', cricketRoutes);
app.use('/api/v1/user', userRoutes)
app.use('/api/v1/team', teamRoutes);
app.use('/api', statsRoutes);
app.use('/api/v1/contest', contestCalculateRoutes);
app.use('/api/v1/profile', profileRoute)
// app.use('/api/v1/series', seriesRoutes);
  
app.get('/', (req, res) => {
  res.send('API is running...');
});

module.exports = app;
