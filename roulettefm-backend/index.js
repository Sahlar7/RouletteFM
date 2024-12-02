const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const http = require('http');
require('dotenv').config();



const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: 'http://localhost:3000', // Allow the React frontend to access the backend
    credentials: true,
}));
app.use(cookieParser());

const clientId = process.env.SPOTIFY_CLIENT_ID;
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

// Generates a random string for the state parameter in OAuth
const generateRandomString = (length) => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

// Routes to handle Spotify authentication
app.get('/', (req, res) => {
    res.redirect('http://localhost:3000');
});
app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email playlist-read-private user-library-read streaming user-modify-playback-state';

    res.redirect(`https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`);
});

app.get('/callback', async (req, res) => {
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

            const { access_token, refresh_token } = result.data;
            res.cookie('access_token', access_token);
            res.redirect('/');
        } catch (error) {
            console.error(error);
            res.send('Error during token exchange.');
        }
    }
});




function selectRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

async function getSavedTracks(accessToken, limit = 50, offset = 0) {
    try {
        const response = await axios.get(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // Extract track objects from the response
        const tracks = response.data.items.map(item => item.track).filter(track => track != null);
        return tracks;
    } catch (error) {
        console.error('Error fetching saved tracks:', error);
        return [];
    }
}

async function fetchAllSavedTracks(accessToken) {
    const limit = 50; // Spotify's API limit for saved tracks per request
    let offset = 0;
    let allTracks = [];
    let hasMore = true;

    while (hasMore) {
        const tracks = await getSavedTracks(accessToken, limit, offset);
        allTracks = [...allTracks, ...tracks];
        offset += limit;
        hasMore = tracks.length === limit; // If we get less than the limit, we're done
    }

    return allTracks;
}

async function selectRandomSong(players) {
    try {
        // Step 1: Fetch saved tracks for each player
        const playerTracks = await Promise.all(players.map(async (player) => {
            const tracks = await fetchAllSavedTracks(player.token); // Fetch player's saved tracks
            return { player, tracks };
        }));

        // Filter out players who have no saved tracks
        const validPlayerTracks = playerTracks.filter(data => data.tracks.length > 0);

        if (validPlayerTracks.length === 0) {
            console.error('No players have valid saved tracks');
            return null; // Return null if no player has valid saved tracks
        }

        // Step 2: Randomly select a player
        const randomPlayerData = selectRandom(validPlayerTracks);

        const randomPlayerName = randomPlayerData.name;

        // Step 3: Randomly select a track from that player's saved tracks
        const randomTrack = selectRandom(randomPlayerData.tracks);

        return {track: randomTrack,
                playerName: randomPlayerName
        }; // Return the random track
    } catch (error) {
        console.error('Error selecting random song:', error);
        return null; // Return null if something goes wrong
    }
}


const server = http.createServer(app); // Create HTTP server

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Allow requests from React frontend
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'], // Ensure WebSocket and polling transports
});

const lobbies = {};

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('createLobby', ({ token, name }) => {
        const lobbyId = Math.random().toString(36).substr(2, 9);
        lobbies[lobbyId] = { id: lobbyId, players: [{token, name}], gameState: 'lobby', currentRound: 1 };

        socket.join(lobbyId);
        socket.emit('lobbyCreated', lobbies[lobbyId]);
        io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
    });

    socket.on('joinLobby', ({ lobbyId, token, name }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].players.push({token, name});
            socket.join(lobbyId);
            io.to(lobbyId).emit('lobbyJoined', lobbies[lobbyId]);
            io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
        }

    });
    socket.on('saveSettings', ({rounds, duration, lobbyId}) =>{
        if(lobbies[lobbyId]){
            lobbies[lobbyId].settings = {rounds, duration};
            io.to(lobbyId).emit('settingsUpdated', {rounds, duration});
        }
    });
    socket.on('startGame', async ({ lobbyId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].currentRound=1;
            lobbies[lobbyId].gameState = 'guessing'; // Update game state
            try {
                // Await the random song selection
                const {randomSong, playerName} = await selectRandomSong(lobbies[lobbyId].players);
                lobbies[lobbyId].roundAnswer = playerName;
    
                // Notify all clients that the game state has changed
                io.to(lobbyId).emit('gameStateChanged', lobbies[lobbyId].gameState);
                io.to(lobbyId).emit('connectPlayer');
    
                // Emit the selected song to all clients
                io.to(lobbyId).emit('songSelected', randomSong);
            } catch (error) {
                console.error('Error selecting random song:', error);
            }
        }
    });
    socket.on('nextRound', async ({lobbyId}) =>{
        if(lobbies[lobbyId]){
            lobbies[lobbyId].currentRound++;
            lobbies[lobbyId].gameState = 'guessing'
            const {randomSong, playerName} = await selectRandomSong(lobbies[lobbyId].players);
            lobbies[lobbyId].roundAnswer = playerName;
            io.to(lobbyId).emit('updateRound', lobbies[lobbyId].currentRound);
            io.to(lobbyId).emit('gameStateChanged', lobbies[lobbyId].gameState);
            io.to(lobbyId).emit('songSelected', randomSong);

        }
    })
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
