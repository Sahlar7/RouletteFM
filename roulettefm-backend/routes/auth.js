const express = require('express');
const { login, callback, refreshToken } = require('../controllers/authController');
const router = express.Router();

router.get('/login', login);
router.get('/callback', callback);
router.get('/refresh_token', refreshToken);

module.exports = router;