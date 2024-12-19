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
    const [joinId, setJoinId] = useState('');
    const [round, setRound] = useState(0);
    const [questions, setQuestions] = useState([]);
    const [webPlayer, setWebPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);




    
    

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
        const connectPlayer = () =>{
            const script = document.createElement('script');
            script.src = "https://sdk.scdn.co/spotify-player.js";
            script.async = true;

            document.body.appendChild(script);
            window.onSpotifyWebPlaybackSDKReady = () => {
                const newPlayer = new window.Spotify.Player({
                    name: 'RouletteFM Player',
                    getOAuthToken: cb => { cb(accessToken); }, 
                    volume: 0.5
                });

                newPlayer.addListener('initialization_error', ({ message }) => { console.error(message); });
                newPlayer.addListener('authentication_error', ({ message }) => { console.error(message); });
                newPlayer.addListener('account_error', ({ message }) => { console.error(message); });
                newPlayer.addListener('playback_error', ({ message }) => { console.error(message); });

                setWebPlayer(newPlayer); 

                newPlayer.addListener('player_state_changed', state => {
                    console.log(state);
                });

                newPlayer.addListener('ready', ({ device_id }) => {
                    console.log('Ready with Device ID', device_id);
                    setDeviceId(device_id);
                });

                newPlayer.addListener('not_ready', ({ device_id }) => {
                    console.log('Device ID has gone offline', device_id);
                });
                newPlayer.connect();
            };
        }
        socket.on('lobbyUpdated', (updatedLobby) => {
            setLobby(updatedLobby);
        });        
        socket.on('playerListUpdate', setPlayers);
        socket.on('settingsUpdated', ({ rounds, duration }) => {
            setRounds(rounds);
            setDuration(duration);
        });
        socket.on('gameReady', ({gamePhase, round, questions})=>{
            console.log(questions[0]);
            console.log(round);
            connectPlayer();
            setRound(round);
            setQuestions(questions);
            setGamePhase(gamePhase);
        })
        socket.on('lobbyJoined', (lobbyData) => {
            setLobby(lobbyData);
            console.log('Lobby joined:', lobbyData);
            setGamePhase('lobby'); // Set initial game state to lobby
        });
        socket.on('lobbyCreated', (lobbyData) => {
            setLobby(lobbyData);
            console.log('Lobby created:', lobbyData);
            setLeader(true);
            setGamePhase('lobby'); // Set initial game state to lobby
        });
        return () => {
            socket.off('lobbyCreated');
            socket.off('lobbyJoined')
            socket.off('playerListUpdate');
            socket.off('settingsUpdated');
            socket.off('gameReady');
            socket.off('lobbyUpdated');
        };
    }, [accessToken]);
    const createLobby = () => {
        if (accessToken && name) {
            socket.emit('createLobby', { token: accessToken, name });
        }
    };

    const joinLobby = () => {
        console.log(joinId);
        if(!joinId || !name){
            alert('Please enter a valid lobby id and a name');
            return;
        }
        if (accessToken && name) {
            setLeader(false);
            socket.emit('joinLobby', { lobbyId: joinId, token: accessToken, name });
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
                    name={name}
                    round={round}
                    setRound={setRound}
                    questions={questions}
                    webPlayer={webPlayer}
                    deviceId={deviceId}
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
                    <button onClick={createLobby} disabled={!name}>Create Lobby</button>
                    <br />
                    <input
                        type="text"
                        placeholder="Enter Lobby ID to Join"
                        value={joinId}
                        onChange={(e) => setJoinId(e.target.value)}
                    />
                    <br />
                    <button onClick={joinLobby} disabled={!joinId || !name}>Join Lobby</button>
                </div>
            )}
        </div>
    );
}

export default App;
