import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Game from './Game';
import GameSettings from './GameSettings';
import Button from './Button';
import Modal from './modal';
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
    const [refreshToken, setRefreshToken] = useState('');
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
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const [warning, setWarning] = useState('');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('access_token');
        const refreshTokenFromUrl = urlParams.get('refresh_token');
        const expirationFromUrl = urlParams.get('expiration_time');
        const errorFromUrl = urlParams.get('error');
        
        if (tokenFromUrl && refreshTokenFromUrl && expirationFromUrl) {
            localStorage.setItem('access_token', tokenFromUrl);
            localStorage.setItem('refresh_token', refreshTokenFromUrl);
            localStorage.setItem('expiration_time', expirationFromUrl);
            
            window.history.replaceState({}, document.title, window.location.pathname);
            
            setAccessToken(tokenFromUrl);
            setRefreshToken(refreshTokenFromUrl);
            setExpirationTime(parseInt(expirationFromUrl, 10));
            setAuthenticated(true);
        } 
        else if (errorFromUrl) {
            setWarning(`Authentication error: ${errorFromUrl}`);
            window.history.replaceState({}, document.title, window.location.pathname);
        }
        else {
            const storedToken = localStorage.getItem('access_token');
            const storedRefreshToken = localStorage.getItem('refresh_token');
            const storedExpiration = localStorage.getItem('expiration_time');
            
            if (storedToken && storedRefreshToken && storedExpiration) {
                setAccessToken(storedToken);
                setRefreshToken(storedRefreshToken);
                setExpirationTime(parseInt(storedExpiration, 10));
                setAuthenticated(true);
            }
        }
    }, []);

    useEffect(() => {
        const refreshAccessToken = async () => {
            try {
                setIsLoading(true);
                setLoadingAction('refreshing');
                
                const storedRefreshToken = localStorage.getItem('refresh_token');
                if (!storedRefreshToken) {
                    throw new Error('No refresh token available');
                }
                
                const response = await fetch(
                    `${process.env.REACT_APP_SERVER_URL}/refresh_token?refresh_token=${encodeURIComponent(storedRefreshToken)}`,
                    { method: 'GET' }
                );
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('expiration_time', data.expiration_time);
                
                setAccessToken(data.access_token);
                setExpirationTime(data.expiration_time);
                setIsLoading(false);
                setLoadingAction('');
                console.log("token refreshed");
            } catch (error) {
                console.error('Error refreshing access token:', error);
                setIsLoading(false);
                setLoadingAction('');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                localStorage.removeItem('expiration_time');
                setAuthenticated(false);
            }
        };
        
        const checkExpiration = () => {
            if (Date.now() >= expirationTime) {
                refreshAccessToken();
            }
        };
        checkExpiration();
        const interval = setInterval(checkExpiration,  60 * 1000);
        
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

    useEffect(() => {
        socket.on('lobbyUpdated', (updatedLobby) => {
            setLobby(updatedLobby);
        });
        
        socket.on('playerListUpdate', (players) => {
            setPlayers(players);
            if (players.length === 1) {
                setLeader(true);
            }
            console.log(players);
        });
        
        socket.on('setLeader', () => {
            setLeader(true);
        });
        
        socket.on('settingsUpdated', ({ rounds, duration }) => {
            setRounds(rounds);
            setDuration(duration);
        });

        socket.on('gameStarting', () => {
            setIsLoading(true);
            setLoadingAction('starting');
        });
        
        socket.on('gameReady', ({ gamePhase, round, questions }) => {
            setIsLoading(false);
            setLoadingAction('');
            setRound(round);
            setQuestions(questions);
            setGamePhase(gamePhase);
        });
        
        socket.on('nameTaken', () => {
            setWarning('This name is already being used in the lobby you are trying to join. Please enter a different name.');
        });
        
        socket.on('lobbyJoined', (lobbyData) => {
            setWarning('');
            setLobby(lobbyData);
            console.log('Lobby joined:', lobbyData);
            setGamePhase('lobby');
        });
        
        socket.on('lobbyCreated', (lobbyData) => {
            setWarning('');
            setLobby(lobbyData);
            console.log('Lobby created:', lobbyData);
            setLeader(true);
            setGamePhase('lobby');
        });
        socket.on('gameAlreadyStarted', () => {
            setWarning('The game has already started. Please wait for the game to end to join this lobby.');
        });
        socket.on('lobbyNotFound', () => {
            setWarning('Lobby not found. Please check the lobby ID and try again.');
        });
        
        return () => {
            socket.off('nameTaken');
            socket.off('lobbyCreated');
            socket.off('lobbyJoined');
            socket.off('playerListUpdate');
            socket.off('settingsUpdated');
            socket.off('gameReady');
            socket.off('lobbyUpdated');
            socket.off('gameStarting');
            socket.off('setLeader');
            socket.off('gameAlreadyStarted');
            socket.off('lobbyNotFound');
        };
    }, [accessToken, webPlayer]);

    const createLobby = () => {
        if (!name) {
            setWarning('Please enter your name to create a lobby.');
            return;
        }

        if (accessToken && name) {
            setIsLoading(true);
            setLoadingAction('creating');
            socket.emit('createLobby', { token: accessToken, name });
            
            setTimeout(() => {
                setIsLoading(false);
                setLoadingAction('');
            }, 200);
        } else {
            console.log('no token or name');
        }
    };

    const spotifyLogin = () => {
        setIsLoading(true);
        setLoadingAction('connecting');
        window.open(`${process.env.REACT_APP_SERVER_URL}/login`, '_self');
    };

    const joinLobby = () => {
        if (!joinId || !name) {
            setWarning('Please enter a valid lobby ID and your name to join a lobby.');
            return;
        }

        if (accessToken && name) {
            setIsLoading(true);
            setLoadingAction('joining');
            setLeader(false);
            socket.emit('joinLobby', { lobbyId: joinId, token: accessToken, name });
            
            setTimeout(() => {
                setIsLoading(false);
                setLoadingAction('');
            }, 800);
        }
    };

    const exitLobby = () => {
        setIsLoading(true);
        setLoadingAction('exiting');
                
        setTimeout(() => {
            socket.disconnect();
            setLobby(null);
            setPlayers([]);
            setLeader(false);
            socket.connect();
            setIsLoading(false);
            setLoadingAction('');
        }, 800);
    };

    const startGame = () => {
        if (isLeader && lobby) {
            setIsLoading(true);
            setLoadingAction('starting');
            socket.emit('startGame', { lobbyId: lobby.id, rounds: rounds, duration: duration });
        }
    };

    if (!authenticated) {
        return (
            <div className="container">
                <div className="home">
                    <div className="logo-container">
                        <img src={logo} alt="Roulette.fm Logo" className="logo" />
                    </div>
                    <p className="tagline">Guess whose playlist is playing!</p>
                    <Button 
                        onClick={spotifyLogin} 
                        loading={isLoading && loadingAction === 'connecting'}
                        disabled={isLoading}
                    >
                        Login with Spotify
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            <div className="logo-container">
                <img src={logo} alt="Roulette.fm Logo" className="logo" />
            </div>
            
            {gamePhase === 'lobby' && lobby ? (
                <div className="lobby-container">
                    <h2>Game Lobby</h2>
                    <div className="lobby-id">
                        Lobby ID: <span>{lobby.id}</span>
                    </div>
                    
                    <h3>Players</h3>
                    <ul className="player-list">
                        {players.map((player, index) => (
                            <li key={index} className="player-item">
                                <div className="player-avatar">{player.name.charAt(0)}</div>
                                <div className="player-name">{player.name}</div>
                            </li>
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
                        isLoading={isLoading}
                    />
                    
                    <div className="footer">
                        {isLeader ? (
                            <>
                                <Button 
                                    onClick={startGame} 
                                    loading={isLoading && loadingAction === 'starting'}
                                    //disabled={players.length < 2}
                                    disabled={isLoading}
                                >
                                    Start Game
                                </Button>
                                <Button 
                                    onClick={exitLobby} 
                                    secondary={true}
                                    loading={isLoading && loadingAction === 'exiting'}
                                    disabled={isLoading}

                                >
                                    Exit Lobby
                                </Button>
                            </>
                        ) : (
                            <>
                                {loadingAction === 'gameStarting' ? (
                                    <p className="instruction-text">Game starting...</p>
                                ) : (
                                    <></>
                                )}
                                <Button 
                                    onClick={exitLobby} 
                                    loading={isLoading && loadingAction === 'exiting'}
                                    disabled={isLoading}
                                >
                                    Exit Lobby
                                </Button>
                            </>
                        )}
                    </div>
                    
                    {isLeader && players.length < 2 && (
                        <p className="instruction-text">
                            Waiting for more players to join. You need at least 2 players to start a game.
                        </p>
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
                <div className="home">
                    <p className="instruction-text">
                        Create a new game or join an existing one with your friends
                    </p>
                    
                    {warning && <p className="warning-text">{warning}</p>}
                    
                    <div className="form-group">
                        <input
                            type="text"
                            placeholder="Enter your name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="name-input"
                        />
                    </div>
                    
                    <div className="actions-container">
                        <div className="action-card">
                            <h3>Create New Game</h3>
                            <Button 
                                onClick={createLobby} 
                                loading={isLoading && loadingAction === 'creating'}
                                disabled={isLoading}
                            >
                                Create Lobby
                            </Button>
                        </div>
                        
                        <div className="action-card">
                            <h3>Join Existing Game</h3>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="Enter Lobby ID"
                                    value={joinId}
                                    onChange={(e) => setJoinId(e.target.value)}
                                    className="lobby-input"
                                />
                            </div>
                            <Button 
                                onClick={joinLobby} 
                                loading={isLoading && loadingAction === 'joining'}
                                disabled={isLoading}
                            >
                                Join Lobby
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;