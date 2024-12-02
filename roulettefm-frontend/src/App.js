import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Game from './Game'; // Assuming Game is in the same folder

const socket = io('http://localhost:3001', {
    transports: ['websocket', 'polling'], // Ensure both websocket and polling are used
    withCredentials: true, // Allow cookies to be passed
});

function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [lobby, setLobby] = useState(null);
    const [isLeader, setLeader] = useState(false);
    const [gamePhase, setGamePhase] = useState('lobby'); // Tracks the current phase of the game
    const [name, setName] = useState('');
    const [players, setPlayers] = useState([]);
    const [rounds, setRounds] = useState(5); // Default rounds
    const [duration, setDuration] = useState(10); // Default duration in seconds

    
    

    useEffect(() => {
        const token = document.cookie
            .split('; ')
            .find(row => row.startsWith('access_token='))
            ?.split('=')[1];
        
        if (token) {
            setAccessToken(token);
            setAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        socket.on('lobbyUpdated', (updatedLobby) => {
            setLobby(updatedLobby);
        });        
        socket.on('playerListUpdate', setPlayers);
        socket.on('settingsUpdated', ({ rounds, duration }) => {
            setRounds(rounds);
            setDuration(duration);
        });
        socket.on('gameStateChanged', setGamePhase);
    
        return () => {
            socket.off('playerListUpdate');
            socket.off('settingsUpdated');
            socket.off('gameStateChanged');
            socket.off('lobbyUpdated');
        };
    }, []);
    const createLobby = () => {
        if (accessToken && name) {
            socket.emit('createLobby', { token: accessToken, name });
            socket.on('lobbyCreated', (lobbyData) => {
                setLobby(lobbyData);
                console.log('Lobby created:', lobbyData);
                setLeader(true);
                setGamePhase('lobby'); // Set initial game state to lobby
            });
        }
    };

    const joinLobby = (lobbyId) => {
        if (accessToken && name) {
            socket.emit('joinLobby', { lobbyId, token: accessToken, name });
            socket.on('lobbyJoined', (lobbyData) => {
                setLobby(lobbyData);
                console.log('Lobby joined:', lobbyData);
                setGamePhase('lobby'); // Set initial game state to lobby
            });
        }
    };

    const handleSaveSettings = () => {
        if(isLeader && lobby){
            socket.emit('saveSettings', {rounds, duration, lobbyId: lobby.id});
        }
    }

    const startGame = () => {
        if (isLeader && lobby) {
            socket.emit('startGame', {lobbyId: lobby.id});
        }
    };


    

    if (!authenticated) {
        return <a href="http://localhost:3001/login">Login with Spotify</a>;
    }

    return (
        <div>
            <h1>RouletteFM</h1>
            {gamePhase === 'lobby' && lobby ? (
                <div>
                    <h2>Lobby ID: {lobby.id}</h2>
                    <p>Players in the lobby:</p>
                    <ul>
                        {players.map((player, index) => (
                            <li key={index}>{player.name}</li> // Display player names
                        ))}
                    </ul>
                    {isLeader ? (
                        <div>
                            <h3>Game Settings (Only Leader can change):</h3>

                            {/* Rounds Setting */}
                            <label>
                                Number of Rounds:
                                <select value={rounds} onChange={(e) => setRounds(parseInt(e.target.value))}>
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={15}>15</option>
                                    <option value={20}>20</option>
                                </select>
                            </label>

                            {/* Duration Setting */}
                            <label>
                                Round Duration (seconds):
                                <select value={duration} onChange={(e) => setDuration(parseInt(e.target.value))}>
                                    <option value={10}>10</option>
                                    <option value={20}>20</option>
                                    <option value={30}>30</option>
                                </select>
                            </label>
                            <br />
                            <button onClick={handleSaveSettings}>Save Settings</button>
                            <br/>
                            <button onClick={startGame}>Start Game</button>
                        </div>
                    ) : (
                        <div>
                            <h3>Game Settings:</h3>
                            <p>Number of Rounds: {rounds}</p>
                            <p>Round Duration: {duration} seconds</p>
                        </div>
                    )}
                </div>
            ) : lobby ? (
                <Game
                    players ={players} 
                    socket={socket} 
                    isLeader={isLeader} 
                    lobby={lobby} 
                    gamePhase={gamePhase} 
                    setGamePhase={setGamePhase} 
                    rounds={rounds}
                    duration={duration}
                    accessToken={accessToken}
                />
            ) : (
                <div>
                  <input
                        type="text"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <br />
                    <button onClick={createLobby}>Create Lobby</button>
                    <br />
                    <input
                        type="text"
                        placeholder="Enter Lobby ID to Join"
                        onBlur={(e) => joinLobby(e.target.value)}
                    />
                </div>
            )}
        </div>
    );
}

export default App;
