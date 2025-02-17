import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Game from './Game';
import './App.css'; // Import the CSS file


const socket = io(process.env.REACT_APP_SERVER_URI, {
    transports: ['websocket', 'polling'], 
    withCredentials: true, 
});

function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [lobby, setLobby] = useState(null);
    const [isLeader, setLeader] = useState(false);
    const [gamePhase, setGamePhase] = useState('lobby'); 
    const [name, setName] = useState('');
    const [players, setPlayers] = useState([]);
    const [rounds, setRounds] = useState(5); 
    const [duration, setDuration] = useState(10);
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
        const connectPlayer = async () => {
            if (!accessToken) return;
    
            const script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
            if (!script) {
                const newScript = document.createElement('script');
                newScript.src = "https://sdk.scdn.co/spotify-player.js";
                newScript.async = true;
                document.body.appendChild(newScript);
    
                newScript.onload = () => initializePlayer();
            } else if (window.Spotify && window.Spotify.Player) {
                initializePlayer();
            }
        };
    
        const initializePlayer = () => {
            const player = new window.Spotify.Player({
                name: 'RouletteFM Player',
                getOAuthToken: (cb) => cb(accessToken),
                volume: 0.5,
            });
    
            player.addListener('ready', ({ device_id }) => {
                console.log('Web Player ready with Device ID', device_id);
                setDeviceId(device_id);
            });
    
            player.addListener('not_ready', ({ device_id }) => {
                console.warn('Web Player not ready with Device ID', device_id);
            });
    
            player.addListener('initialization_error', ({ message }) => console.error(message));
            player.addListener('authentication_error', ({ message }) => console.error(message));
            player.addListener('account_error', ({ message }) => console.error(message));
            player.addListener('playback_error', ({ message }) => console.error(message));
    
            player.connect();
            setWebPlayer(player);
        };

        socket.on('lobbyUpdated', (updatedLobby) => {
            setLobby(updatedLobby);
        });        
        socket.on('playerListUpdate', (players)=>{
            setPlayers(players);
            if(players.length === 1){
                setLeader(true);
            }
        });
        socket.on('setLeader', ()=>{
            setLeader(true);
        });
        socket.on('settingsUpdated', ({ rounds, duration }) => {
            setRounds(rounds);
            setDuration(duration);
        });
        socket.on('gameReady', ({gamePhase, round, questions})=>{
            setRound(round);
            setQuestions(questions);
            setGamePhase(gamePhase);
            connectPlayer();
        });
        socket.on('nameTaken', ()=>{
            alert('This name is already being used in the lobby you are trying to join. Please enter a different name.');

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
            socket.off('nameTaken');
            socket.off('lobbyCreated');
            socket.off('lobbyJoined')
            socket.off('playerListUpdate');
            socket.off('settingsUpdated');
            socket.off('gameReady');
            socket.off('lobbyUpdated');
        };
    }, [accessToken, webPlayer]);
    const createLobby = () => {
        if (accessToken && name) {
            socket.emit('createLobby', { token: accessToken, name });
        }
        else{
            console.log('no token or name');
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

    const exitLobby = () =>{
        socket.emit('exitLobby', {lobbyId: lobby.id, isLeader})
        setLobby(null);
        setPlayers([]);
        setLeader(false);
        socket.disconnect();
        socket.connect();
    }

    const handleSaveSettings = () => {
        if(isLeader && lobby){
            socket.emit('saveSettings', {rounds, duration, lobbyId: lobby.id});
        }
    }

    const startGame = () => {
        if (isLeader && lobby) {
            socket.emit('startGame', {lobbyId: lobby.id, rounds: rounds, duration: duration});
        }
    };


    

    if (!authenticated) {
        return (
            <div>
                <h1>RouletteFM</h1>
                <a href="http://localhost:3001/login">Login with Spotify</a>
            </div>
        );
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
                            <li key={index}>{player.name}</li> 
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
                            <br/>
                            <button onClick={exitLobby}>Exit Lobby</button>
                        </div>
                    ) : (
                        <div>
                            <button onClick={exitLobby}>Exit Lobby</button>
                            <h3>Game Settings:</h3>
                            <p>Number of Rounds: {rounds}</p>
                            <p>Round Duration: {duration} seconds</p>
                        </div>
                    )}
                </div>
            ) : lobby ? (
                <Game
                    players ={players}
                    setPlayers={setPlayers} 
                    socket={socket} 
                    isLeader={isLeader} 
                    setLeader={setLeader}
                    lobby={lobby}
                    gamePhase={gamePhase} 
                    setGamePhase={setGamePhase} 
                    rounds={rounds}
                    setRounds={setRounds}
                    duration={duration}
                    setDuration={setDuration}
                    accessToken={accessToken}
                    setLobby={setLobby}
                    round={round}
                    setRound={setRound}
                    questions={questions}
                    setQuestions={setQuestions}
                    webPlayer={webPlayer}
                    setWebPlayer={setWebPlayer}
                    deviceId={deviceId}
                    setDeviceId={setDeviceId}
                    name={name}
                />
            ) : (
                <div className='home'>
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
