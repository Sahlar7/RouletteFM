const selectRandomSong = require('../utils/spotifyApi').selectRandomSong;
const createRecapPlaylist = require('../utils/spotifyApi').createRecapPlaylist;


const handleSocketConnection = (io, lobbies, socketLobbies) => {
    io.on('connection', (socket) =>{
        console.log('User connected:', socket.id);

        /* Lobby Handlers */
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
    
        socket.on('backToLobby', ({lobbyId, token, name})=>{
            if(lobbies[lobbyId].gameState != 'lobby'){
                lobbies[lobbyId].gameState = 'lobby';
            }
        });


        /* Game Handlers */
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
    });
};
module.exports = handleSocketConnection;