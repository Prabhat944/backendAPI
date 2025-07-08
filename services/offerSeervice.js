const axios = require('axios');
const OFFER_SERVICE_URL = process.env.OFFER_SERVICE_URL || 'http://localhost:4001';



const getActiveOfferFromOfferService = async (token) => {
  const response = await axios.get(`${OFFER_SERVICE_URL}/api/offerRoutes/deposit-offer/active`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};


module.exports = {
  getActiveOfferFromOfferService
};