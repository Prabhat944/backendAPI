// // user-service/jobs/processOffersCron.js
// require('dotenv').config(); 
// const cron = require('node-cron');
// const mongoose = require('mongoose');
// const axios = require('axios');

// // We need the Match model from the Contest/User service to check match status
// const Contest = require('../models/Contest'); // Or Match model if you have a separate one
// // We need the MatchOffer model from the Offer Service (via an API call or direct DB access if sharing DB)
// // For this example, we'll get offers from the Offer Service via an API endpoint.
// // Let's assume you create a helper endpoint in Offer Service to get unprocessed offers.

// // Service URLs from your environment variables
// const OFFER_SERVICE_URL = process.env.OFFER_SERVICE_URL;
// const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;

// const processCompletedOffers = async () => {
//     console.log('===========================================');
//     console.log(`[${new Date().toLocaleString()}] 🔄 Starting match offer processing cron...`);

//     try {
//         // Step 1: Find all matches that are 'completed' but whose offers might not be processed.
//         // It's more efficient to find unprocessed offers and then check their match status.
        
//         // Let's create a hypothetical endpoint in your Offer Service to get unprocessed offers.
//         // It's better to manage offer data from within the offer service.
//         // See the explanation below on how to create this new endpoint.
//         console.log('Token being sent:', INTERNAL_API_TOKEN);

//         console.log({
//             'Authorization': `Bearer ${INTERNAL_API_TOKEN}`
//           });
//         const unprocessedOffersResponse = await axios.get(`${OFFER_SERVICE_URL}/api/offerRoutes/unprocessed-match-offers`,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${INTERNAL_API_TOKEN}` // 👈 Add the header
//                 }
//             }
//         );
//         const unprocessedOffers = unprocessedOffersResponse.data;

//         if (!unprocessedOffers || unprocessedOffers.length === 0) {
//             console.log('✅ No unprocessed match offers found. Exiting.');
//             return;
//         }

//         console.log(`🔍 Found ${unprocessedOffers.length} unprocessed offers.`);

//         for (const offer of unprocessedOffers) {
//             // Step 2: For each unprocessed offer, check the status of the corresponding match
//             // in the Contest/User service database.
//             const match = await Contest.findOne({ matchId: offer.matchId }).select('status').lean();

//             if (!match) {
//                 console.log(`ℹ️ Skipping offer for match ${offer.matchId}: Match not found in local DB.`);
//                 continue;
//             }
            
//             // Step 3: If the match is 'completed', trigger the processing in the Offer Service
//             if (match.status === 'completed') {
//                 console.log(`▶️ Match ${offer.matchId} is completed. Triggering offer processing...`);

//                 try {
//                     // Call the endpoint you already created in the Offer Service!
//                     const processingResponse = await axios.post(`${OFFER_SERVICE_URL}/api/offerRoutes/process-match/${offer.matchId}`,null,
//                         {
//                             headers: {
//                                 'Authorization': `Bearer ${INTERNAL_API_TOKEN}` // 👈 Add the header
//                             }
//                         }
//                     );

//                     if (processingResponse.status === 200) {
//                         console.log(`🟢 Successfully triggered processing for match ${offer.matchId}.`);
//                         // The endpoint itself should now mark the offer as processed.
//                         // For robustness, we'll have the endpoint return success, and then we could mark it here,
//                         // but it's better encapsulated if the Offer Service does it.
//                         // Let's modify the processCompletedMatchOffers to set isProcessed to true.
//                     } else {
//                         console.error(`🔴 Failed to trigger processing for match ${offer.matchId}:`, processingResponse.data);
//                     }

//                 } catch (err) {
//                     console.error(`❌ Error calling offer processing endpoint for match ${offer.matchId}:`, err.response ? err.response.data : err.message);
//                 }

//             } else {
//                 console.log(`ℹ️ Skipping offer for match ${offer.matchId}: Match status is '${match.status}'.`);
//             }
//         }

//     } catch (err) {
//         console.error('🔥 Critical error in match offer processing cron:', err.message, err.stack);
//     }
    
//     console.log(`[${new Date().toLocaleString()}] ✅ Match offer processing cron finished.`);
//     console.log('===========================================');
// };

// const scheduleOfferProcessing = () => {
//     mongoose.connection.once('open', () => {
//         processCompletedOffers(); // Run once on startup
//         // Schedule to run every 15 minutes. Adjust as needed.
//         cron.schedule('* * * * *', processCompletedOffers, {
//             scheduled: true,
//             timezone: 'Asia/Kolkata'
//         });
//         console.log('✅ Match Offer processing cron job scheduled every 15 minutes.');
//     });

//     mongoose.connection.on('error', err => {
//         console.error('❌ MongoDB connection error in offer processing cron:', err);
//     });
// };

// scheduleOfferProcessing();

// module.exports = { scheduleOfferProcessing };