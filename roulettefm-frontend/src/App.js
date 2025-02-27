import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Game from './Game';
import GameSettings from './GameSettings';
import './Home.css';
import logo from './assets/RouletteFmLogo2.png';

const socket = io(process.env.REACT_APP_SERVER_URL, {
    transports: ['websocket', 'polling'], 
    withCredentials: true, 
});

function App() {
    const [authenticated, setAuthenticated] = useState(false);
    const [accessToken, setAccessToken] = useState('');
    const [expirationTime, setExpirationTime] = useState(null);
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
        const expiration = document.cookie
            .split('; ')
            .find(row => row.startsWith('expiration_time='))
            ?.split('=')[1];
        if (token && expiration) {
            setAccessToken(token);
            setExpirationTime(parseInt(expiration, 10));
            setAuthenticated(true);
        }
    }, []);

    useEffect(() => {
        const refreshAccessToken = async () => {
            try{
                const response = await fetch(`${process.env.REACT_APP_SERVER_URL}/refresh_token`, {
                    method: 'GET',
                    credentials: 'include',
                });
                const data = await response.json();
                setAccessToken(data.access_token);
                setExpirationTime(data.expiration_time);
                console.log("token refreshed");
            }
catch (error){
                console.error('Error refreshing access token:', error);
            }
        };
        const checkExpiration = () => {
            if(Date.now() >= expirationTime){
                refreshAccessToken();
            }
        };
        checkExpiration();
        const interval = setInterval(checkExpiration, 1 * 60 * 1000);
        const connectPlayer = async () => {
            if (!accessToken) return;

            const script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
            if (!script) {
                const newScript = document.createElement('script');
                newScript.src = "https://sdk.scdn.co/spotify-player.js";
                newScript.async = true;
                document.body.appendChild(newScript);
            }
            window.onSpotifyWebPlaybackSDKReady = () => initializePlayer();
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
        connectPlayer();

        return () => clearInterval(interval);
    }, [expirationTime, accessToken]);

   /* useEffect(() => {
        const connectPlayer = async () => {
            if (!accessToken) return;

            const script = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
            if (!script) {
                const newScript = document.createElement('script');
                newScript.src = "https://sdk.scdn.co/spotify-player.js";
                newScript.async = true;
                document.body.appendChild(newScript);
            }
            window.onSpotifyWebPlaybackSDKReady = () => initializePlayer();
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
        connectPlayer();
    }, [accessToken]);*/

    useEffect(() => {
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
            //connectPlayer();
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
    };

    const startGame = () => {
        if (isLeader && lobby) {
            socket.emit('startGame', {lobbyId: lobby.id, rounds: rounds, duration: duration});
        }
    };

    if (!authenticated) {
        return (
            <div>
                <h1><img src={logo}/></h1>
                <a href={`${process.env.REACT_APP_SERVER_URL}/login`}>Login with Spotify</a>
            </div>
        );
    }

    return (
        <div>
            <h1><img src={logo}/></h1>
            {gamePhase === 'lobby' && lobby ? (
                <div>
                    <h2>Lobby ID: {lobby.id}</h2>
                    <p>Players in the lobby:</p>
                    <ul>
                        {players.map((player, index) => (
                            <li key={index}>{player.name}</li> 
                        ))}
                    </ul>
                    <GameSettings
                        rounds={rounds}
                        setRounds={setRounds}
                        duration={duration}
                        setDuration={setDuration}
                        isLeader={isLeader}
                        socket={socket}
                        lobbyId={lobby.id}
                    />
                    {isLeader ? (
                        <div>
                            <button onClick={startGame}>Start Game</button>
                            <br/>
                            <button onClick={exitLobby}>Exit Lobby</button>
                        </div>
                    ) : (
                        <div>
                            <button onClick={exitLobby}>Exit Lobby</button>
                        </div>
                    )}
                </div>
            ) : lobby ? (
                <Game
                    players={players}
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
