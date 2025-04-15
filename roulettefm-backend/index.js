const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const http = require('http');
const { disconnect } = require('process');
require('dotenv').config();



const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
    origin: process.env.FRONTEND_URL, // Allow the React frontend to access the backend
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
    res.send('Hello from Roulette.FM backend!');
});
app.get('/login', (req, res) => {
    const state = generateRandomString(16);
    const scope = 'user-read-private user-read-email playlist-read-private user-library-read streaming user-library-modify user-modify-playback-state playlist-modify-private playlist-modify-public';

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
});

app.get('/refresh_token', async (req, res) => {
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

async function selectRandomSong(players, rounds) {
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
        const questions = [];
        const playerQueue = [...validPlayerTracks];
        
        for(let i = 0; i<rounds; i++){
            const randomPlayerData = playerQueue.shift();
            const randomPlayerName = randomPlayerData.player.name;
    
            // Step 3: Randomly select a track from that player's saved tracks
            const randomTrack = selectRandom(randomPlayerData.tracks);
            const filteredTrack = {name: randomTrack.name, 
                artists: randomTrack.artists, 
                uri: randomTrack.uri, 
                album: randomTrack.album, 
                id: randomTrack.id,
                duration_ms: randomTrack.duration_ms,
            };
            const questionExists = questions.some(
                q => q.track.uri === filteredTrack.uri && q.playerName === randomPlayerName
            );

            if (!filteredTrack.name || !filteredTrack.uri || !randomPlayerName || questionExists) {
                i--; // Retry the current round if invalid data
            } else {
                questions.push({ track: filteredTrack, playerName: randomPlayerName });
                playerQueue.push(randomPlayerData);
            }
        }
        for (let i = questions.length-1; i>0; i--){
            const j = Math.floor(Math.random()*(i+1));
            [questions[i], questions[j]] = [questions[j], questions[i]]; 
        }
        return questions;
    } catch (error) {
        console.error('Error selecting random song:', error);
        return null; // Return null if something goes wrong
    }
}

async function createRecapPlaylist(accessToken, trackUris, playlistName) {
    try {
        const response = await axios.post(`https://api.spotify.com/v1/me/playlists`, {
                name: playlistName,
                description: 'A recap of your Roulette.FM game!',
                public: false
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        const playlistLink = response.data.external_urls.spotify;
        const playlistId = response.data.id;
            try{
                await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                    uris: trackUris,
                }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                return playlistLink;
        } catch (error) {
            console.error('Error adding tracks to playlist:', error);
            return false;
        }
    } catch (error) {
        console.error('Error creating playlist:', error);
        return false;
    }
}


const server = http.createServer(app); // Create HTTP server

const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL, // Allow requests from React frontend
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'], // Ensure WebSocket and polling transports
});

const lobbies = {};
const socketLobbies = {};
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('disconnect', () => {
        if(socketLobbies[socket.id]){
            const lobbyId = socketLobbies[socket.id];
            player = lobbies[lobbyId].players.find(p => p.socketId === socket.id);
            if(lobbies[lobbyId].gameState ==='lobby' || lobbies[lobbyId].gameState === 'finalResults'){
                lobbies[lobbyId].players = lobbies[lobbyId].players.filter(p => p.socketId !== socket.id);
                if(lobbies[lobbyId].players.length === 0) {
                    delete lobbies[lobbyId];
                }
                else{
                    if(player.isLeader){
                        newLeader = lobbies[lobbyId].players[0];
                        newLeader.isLeader = true;
                        io.to(newLeader.socketId).emit('setLeader');
                    }
                    io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
                }
            }
            else{
                player.connected = false;
                connectedPlayers = lobbies[lobbyId].players.filter(p => p.connected === true);
                if(connectedPlayers.length === 0){
                    delete lobbies[lobbyId];
                }
                else{
                    if(player.isLeader){
                        newLeader = connectedPlayers[0];
                        newLeader.isLeader = true;
                        io.to(newLeader.socketId).emit('setLeader');
                        player.isLeader = false;
                    }
                }
            }
        }
        delete socketLobbies[socket.id];
    });

    socket.on('createLobby', ({ token, name }) => {
        const lobbyId = Math.random().toString(36).substr(2, 9);
        lobbies[lobbyId] = { id: lobbyId, players: [{token, name, socketId: socket.id, connected: true, isLeader: true}], gameState: 'lobby'};
        lobbies[lobbyId].rounds = 5;
        lobbies[lobbyId].duration = 10;
        socket.join(lobbyId);
        socketLobbies[socket.id] = lobbyId;
        socket.emit('lobbyCreated', lobbies[lobbyId]);
        io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
    });

    socket.on('joinLobby', ({ lobbyId, token, name }) => {
        if(!lobbies[lobbyId]){
            io.to(socket.id).emit('lobbyNotFound');
        }
        if (lobbies[lobbyId]) {
            const nameUsed = lobbies[lobbyId].players.find(player => player.name===name);
            if(nameUsed){
                io.to(socket.id).emit('nameTaken');
            }
            else if(lobbies[lobbyId].gameState != 'lobby'){
                io.to(socket.id).emit('gameAlreadyStarted');
            }
            else{
                lobbies[lobbyId].players.push({token, name, socketId: socket.id, connected: true, isLeader: false});
                socket.join(lobbyId);
                socketLobbies[socket.id] = lobbyId;
                io.to(lobbyId).emit('lobbyJoined', lobbies[lobbyId]);
                io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
                io.to(socket.id).emit('settingsUpdated', {rounds: lobbies[lobbyId].rounds, duration: lobbies[lobbyId].duration});
            }
        }

    });
    
    socket.on('saveSettings', ({rounds, duration, lobbyId}) =>{
        if(lobbies[lobbyId]){
            lobbies[lobbyId].rounds = rounds;
            lobbies[lobbyId].duration = duration;
            io.to(lobbyId).emit('settingsUpdated', {rounds: lobbies[lobbyId].rounds, duration: lobbies[lobbyId].duration});
        }
    });
    socket.on('startGame', async ({lobbyId, rounds, duration}) => {
        if (lobbies[lobbyId]) {
            await io.to(lobbyId).emit('gameStarting');
            lobbies[lobbyId].rounds = rounds;
            lobbies[lobbyId].duration = duration;
            lobbies[lobbyId].gameState = 'guessing'; // Update game state
            lobbies[lobbyId].currentRound = 1;
            lobbies[lobbyId].guesses = new Map();
            lobbies[lobbyId].points = lobbies[lobbyId].players.reduce((acc, player) => {
                acc[player.name] = 0; // Initialize points for each player
                return acc;
            }, {});
            try {
                // Await the random song selection
                const questions = await selectRandomSong(lobbies[lobbyId].players, lobbies[lobbyId].rounds);
                lobbies[lobbyId].questions = questions;
                // Notify all clients that the game state has changed
                io.to(lobbyId).emit('gameReady', {gamePhase: lobbies[lobbyId].gameState, round: lobbies[lobbyId].currentRound, questions: lobbies[lobbyId].questions})
            } catch (error) {
                console.error('Error selecting random song:', error);
            }
        }
    });
    socket.on('nextRound', async ({lobbyId}) =>{
        if(lobbies[lobbyId]){
            console.log("next round emission received");
            lobbies[lobbyId].currentRound += 1;
            if(lobbies[lobbyId].currentRound > lobbies[lobbyId].rounds){
                lobbies[lobbyId].gameState = 'finalResults';
                io.to(lobbyId).emit('finalResults', {points: lobbies[lobbyId].points, gamePhase: lobbies[lobbyId].gameState});
                lobbies[lobbyId].players = lobbies[lobbyId].players.filter(player => player.connected === true);
                io.to(lobbyId).emit('playerListUpdate', lobbies[lobbyId].players);
            }
            else {
                lobbies[lobbyId].gameState = 'guessing'
                lobbies[lobbyId].guesses = new Map();
                io.to(lobbyId).emit('updateRound', {round: lobbies[lobbyId].currentRound, gamePhase: lobbies[lobbyId].gameState});
            }
        }
    });
    socket.on('addGuess', ({guessAndTime, lobbyId}) =>{
        const player = lobbies[lobbyId].players.find(p=> p.socketId === socket.id);
        lobbies[lobbyId].guesses.set(player, guessAndTime);
        connectedPlayers = lobbies[lobbyId].players.filter(p => p.connected === true);
        if (lobbies[lobbyId].guesses.size === connectedPlayers.length) {
            disconnectedPlayers = lobbies[lobbyId].players.filter(p => p.connected === false);
            disconnectedPlayers.forEach(player => { lobbies[lobbyId].guesses.set(player, 'Disconnected'); });
            const guesses = lobbies[lobbyId].guesses;
            const round = lobbies[lobbyId].currentRound;
            const correctPlayer = lobbies[lobbyId].questions[round-1].playerName.trim().toLowerCase();
            const results = {};
            const duration = lobbies[lobbyId].duration;
            console.log('answer: ', correctPlayer);
            guesses.forEach((playerGuess, playerObj) => {
                const editedGuess = playerGuess.guess.trim().toLowerCase();
                console.log('Player:', playerObj.name);
                if(editedGuess === correctPlayer){
                    lobbies[lobbyId].points[playerObj.name] += Math.round((1-((playerGuess.timeTaken/duration)/2))*1000);
                }
                results[playerObj.name] = {
                    guess: playerGuess.guess,
                    correct: editedGuess === correctPlayer,
                    points: lobbies[lobbyId].points[playerObj.name],
                };
            });
            lobbies[lobbyId].gameState = 'roundResults';
            io.to(lobbyId).emit('roundResults', {results: results, points: lobbies[lobbyId].points});
        }
    });
    socket.on('makeRecap', async ({trackUris, token, playlistName}) => {
        const recapLink = await createRecapPlaylist(token, trackUris, playlistName);
        if(recapLink){
            io.to(socket.id).emit('recapCreated', recapLink);
        }
    });
    socket.on('backToLobby', ({lobbyId, token, name})=>{
        if(lobbies[lobbyId].gameState != 'lobby'){
            lobbies[lobbyId].gameState = 'lobby';
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
