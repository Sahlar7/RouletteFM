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
        const questions = [{track: null, playerName: ''}]
        for(let i = 0; i<rounds; i++){
            const randomPlayerData = selectRandom(validPlayerTracks);
            const randomPlayerName = randomPlayerData.player.name;
    
            // Step 3: Randomly select a track from that player's saved tracks
            const randomTrack = selectRandom(randomPlayerData.tracks);
            const filteredTrack = {name: randomTrack.name, artists: randomTrack.artists, uri: randomTrack.uri};
            if(filteredTrack === null || randomPlayerName === ''){
                i--;
            }
            else{
                const question = {track: filteredTrack, playerName: randomPlayerName};
                if(questions.includes(question)){
                    i--;
                }
                else{
                    questions[i] = question;
                }
            }
        }
       
        return questions;
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
        lobbies[lobbyId] = { id: lobbyId, players: [{token, name}], gameState: 'lobby'};

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
            lobbies[lobbyId].rounds = rounds;
            lobbies[lobbyId].duration = duration;
            io.to(lobbyId).emit('settingsUpdated', {rounds: lobbies[lobbyId].rounds, duration: lobbies[lobbyId].duration});
        }
    });
    socket.on('startGame', async ({ lobbyId }) => {
        if (lobbies[lobbyId]) {
            lobbies[lobbyId].gameState = 'guessing'; // Update game state
            lobbies[lobbyId].currentRound = 1;
            lobbies[lobbyId].guesses = {};
            try {
                console.log("start round emission received");
                // Await the random song selection
                const questions = await selectRandomSong(lobbies[lobbyId].players, lobbies[lobbyId].rounds);
                lobbies[lobbyId].questions = questions;
                console.log(questions[0]);
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
            lobbies[lobbyId].gameState = 'guessing'
            lobbies[lobbyId].guesses = {};
            io.to(lobbyId).emit('updateRound', {round: lobbies[lobbyId].currentRound, gamePhase: lobbies[lobbyId].gameState});
        }
    });
    socket.on('addGuess', ({guess, lobbyId}) =>{
        lobbies[lobbyId].guesses[socket.id] = guess;
        if(Object.keys(lobbies[lobbyId].guesses).length == Object.keys(lobbies[lobbyId].players).length){
            const guesses = lobbies[lobbyId].guesses;
            const round = lobbies[lobbyId].currentRound;
            const correctPlayer = lobbies[lobbyId].questions[round].playerName.trim().toLowerCase();
            const results = {};
            console.log('answer: ', correctPlayer);
            Object.entries(guesses).forEach(([player, guess])=>{
                const editedGuess = guess.trim().toLowerCase();
                console.log("guess: ", editedGuess);
                results[player]={
                    guess,
                    correct: editedGuess === correctPlayer,
                    points: editedGuess === correctPlayer ? 10 : 0
                };
            });
            io.to(lobbyId).emit('roundResults', results);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
