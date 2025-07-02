// routes/configRoutes.js
const express = require('express');
const router = express.Router();
const configController = require('../controllers/supportEmailRoute');

router.get('/support-email', configController.getSupportEmail);

module.exports = router;