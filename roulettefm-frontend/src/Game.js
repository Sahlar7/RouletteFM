import React, { useState, useEffect } from 'react';

function Game({players, socket, isLeader, lobby, gamePhase, setGamePhase, rounds, duration, accessToken}) {
    const [selectedSong, setSelectedSong] = useState(null);
    const [results, setResults] = useState(null);
    const [round, setRound] = useState(1);
    const [player, setPlayer] = useState(null);
    const [deviceId, setDeviceId] = useState(null);
    



    const submitGuess = (name) => {
        //socket.emit('submitGuess', { guess });
        setGamePhase('results');
    };

    const startNextRound = () => {
        socket.emit('nextRound', {lobbyId: lobby.id});

    };

    useEffect(() => {
        const playSongClip = async () => {
            if (!deviceId || !selectedSong?.uri) {
                console.error('Device ID or track URI missing');
                return;
            }
    
            const playEndpoint = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    
            try {
                // Pause current playback first (if any)
                await player.pause().catch((error) => console.warn('Error pausing previous track:', error));
    
                // Start playing the new song
                await fetch(playEndpoint, {
                    method: 'PUT',
                    body: JSON.stringify({ uris: [selectedSong.uri] }),
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
    
                console.log(`Playing: ${selectedSong.name}`);
    
                // Pause after the specified duration
                setTimeout(() => {
                    player.pause().catch((error) => console.error('Error pausing playback:', error));
                }, duration * 1000); // Convert seconds to milliseconds
            } catch (error) {
                console.error('Error starting playback:', error);
            }
        };
    
        if (selectedSong) {
            playSongClip();
        }
    }, [selectedSong, deviceId, player, duration, accessToken]);
    
    useEffect(() => {
        socket.on('connectPlayer', ()=>{
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

            setPlayer(newPlayer); 

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
        });
        socket.on('songSelected', (song) =>{
            setSelectedSong(song);
        });
        socket.on('updateRound', (currentRound) =>{
            setRound(currentRound);
        });
        return()=>{
            socket.off('connectPlayer');
            socket.off('songSelected');
            socket.off('updateRound');
        }
    });




    useEffect(() => {
        if (gamePhase === 'results') {
            const simulatedResults = {
                correctGuess: 'Player1',
                points: 10,
            };
            setResults(simulatedResults);
        }
    }, [gamePhase]);

    return (
        <div>
            <h2>Game in Progress</h2>
            {gamePhase === 'guessing' && (
                <div>
                    <h2>Round {round} / {rounds}</h2>
                    {selectedSong ? (
                        <div>
                            <p>Try to guess whose playlist this song is from!</p>
                            <div>
                                {players.map((player)=>(
                                    <button
                                    key={player.name} onClick={()=> submitGuess(player.name)}>
                                        {player.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p>Waiting for the next song...</p>
                    )}
                </div>
            )}

            {gamePhase === 'results' && results && (
                <div>
                    <h3>Results</h3>
                    <p>The song was: {selectedSong.name} by {selectedSong.artists[0].name}</p>
                    <p>Correct guess: {results.correctGuess}</p>
                    <p>You earned: {results.points} points!</p>
                    {isLeader && (
                        <button onClick={startNextRound}>Next Round</button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Game;
