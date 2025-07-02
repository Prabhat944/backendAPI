// File: services/walletService.js (inside Contest Service)
const axios = require('axios');
const WALLET_SERVICE_URL = process.env.WALLET_SERVICE_URL || 'http://localhost:5003';

// Uses Bearer token
const getWalletDetails = async (token) => {
  const response = await axios.get(`${WALLET_SERVICE_URL}/api/wallet/`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

const depositFunds = async (token, amount) => {
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/deposit`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const addWinningAmount = async (token, amount) => {
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/winning`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const addCashback = async (token, amount) => {
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/cashback`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const addBonus = async (token, amount) => {
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/bonus`,
    { amount },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const withdrawFunds = async (token, amount) => {
    try {
      const response = await axios.post(
        `${WALLET_SERVICE_URL}/api/wallet/withdraw`,
        { amount },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log('Check the responseData:', response.data);
      return response.data;

    } catch (error) {
      if (error.response) {
        // Wallet service returned a 400 or other error
        return {
          status: error.response.status,
          message: error.response.data.message || 'Withdraw failed',
        };
      } else {
        // Network or unexpected error
        return {
          status: 500,
          message: 'Withdraw failed due to server error',
        };
      }
    }
  };


const deductFunds = async (token, amount, reason = '', allowSignupBonus = false, contestId = null, matchId = null) => { // ADDED contestId, matchId
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/deduct`,
    { amount, reason, signupBonusPercentage: allowSignupBonus, contestId, matchId }, // Mapped allowSignupBonus to signupBonusPercentage
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const refundFunds = async (token, breakdown, reason = 'Generic Refund', refundedTransactionId = null, contestId = null, matchId = null) => { // ADDED refundedTransactionId, contestId, matchId
  const response = await axios.post(
    `${WALLET_SERVICE_URL}/api/wallet/refund`,
    { breakdown, reason, refundedTransactionId, contestId, matchId },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};

const creditWinningAmountsForMatch = async (matchId) => {
  const response = await axios.post(`${WALLET_SERVICE_URL}/api/wallet/credit-winnings`, {
    matchId,
  });
  return response.data;
};

// --- NEW FUNCTION ADDED HERE ---
const getTransactionsHistory = async (token, page = 1, limit = 10, type = '', sortBy = 'createdAt', sortOrder = 'desc') => {
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy: sortBy,
    sortOrder: sortOrder
  });

  if (type) {
    queryParams.append('type', type);
  }

  const response = await axios.get(`${WALLET_SERVICE_URL}/api/wallet/transactions?${queryParams.toString()}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};
// --- END OF NEW FUNCTION ---


module.exports = {
  getWalletDetails,
  depositFunds,
  addWinningAmount,
  addCashback,
  addBonus,
  withdrawFunds,
  deductFunds,
  refundFunds,
  creditWinningAmountsForMatch,
  getTransactionsHistory, // EXPORT THE NEW FUNCTION
};