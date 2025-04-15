const axios = require('axios');
const generateRandomString = require('../utils/helpers').generateRandomString;

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

const login = (req, res) =>{
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email playlist-read-private user-library-read streaming user-library-modify user-modify-playback-state playlist-modify-private playlist-modify-public';

    res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`);
};

const callback = async (req, res) => {
     const code = req.query.code || null;
    
        if (code) {
            try {
                const result = await axios({
                    method: 'post',
                    url: 'https://accounts.spotify.com/api/token',
                    data: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`,
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                    }
                });
    
                const { access_token, refresh_token, expires_in } = result.data;
                const expiration_time = Date.now() + expires_in * 1000;
                
                res.redirect(`${process.env.FRONTEND_URL}?access_token=${access_token}&refresh_token=${refresh_token}&expiration_time=${expiration_time}`);
            } catch (error) {
                console.error('Token exchange error:', error.response ? error.response.data : error.message);
                res.redirect(`${process.env.FRONTEND_URL}?error=token_exchange_failed`);
            }
        } else {
            res.redirect(`${process.env.FRONTEND_URL}?error=authorization_code_missing`);
        }
    };

const refreshToken = async (req, res) => {
      const refreshToken = req.query.refresh_token;
    
        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token is missing' });
        }
    
        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', null, {
                params: {
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                },
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                },
            });
    
            const { access_token, expires_in } = response.data;
            const expiration_time = Date.now() + expires_in * 1000;
            
            res.json({ access_token, expiration_time });
        } catch (error) {
            console.error('Error refreshing token:', error);
            res.status(500).json({ error: 'Failed to refresh token' });
        }
    };

module.exports = {
    login,
    callback,
    refreshToken
};