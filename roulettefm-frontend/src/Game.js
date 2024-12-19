import React, { useState, useEffect } from 'react';

function Game({players, socket, isLeader, lobby, gamePhase, setGamePhase, rounds, duration, accessToken, name, round, setRound, questions, webPlayer, deviceId}) {
    const [results, setResults] = useState({});
    const [guess, setGuess] = useState('No Guess')



    const submitGuess = (guess) => { 
        setGuess(guess);
        socket.emit('addGuess', {guess: guess, lobbyId: lobby.id});
        console.log(`Guess submitted: ${guess}`);
    };
    
    const startNextRound = () => {
        socket.emit('nextRound', {lobbyId: lobby.id});

    };

    useEffect(() => {
        const playSongClip = async (track) => {
            if (!deviceId || !track?.uri) {
                console.error('Device ID or track URI missing');
                return;
            }
    
            const playEndpoint = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
    
            try {
                // Pause current playback first (if any)
                await webPlayer.pause().catch((error) => console.warn('Error pausing previous track:', error));
    
                // Start playing the new song
                await fetch(playEndpoint, {
                    method: 'PUT',
                    body: JSON.stringify({ uris: [track.uri] }),
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
    
                console.log(`Playing: ${track.name}`);
    
                // Pause after the specified duration
                setTimeout(() => {
                    webPlayer.pause().catch((error) => console.error('Error pausing playback:', error));
                    if(guess === 'No Guess'){
                        socket.emit('addGuess', {guess: guess, socket: socket, lobbyId: lobby.id});
                    }
                }, duration * 1000); // Convert seconds to milliseconds
            } catch (error) {
                console.error('Error starting playback:', error);
            }
        };
    
        if (questions[round] && gamePhase==='guessing') {
            const track = questions[round].track
            playSongClip(track);
        }
    }, [gamePhase, guess, lobby.id, questions, round, socket, deviceId, webPlayer, duration, accessToken]);
    
    useEffect(() => {
        socket.on('updateRound', ({round, gamePhase}) =>{
            setRound(round);
            setGamePhase(gamePhase);
            console.log(round);
        });
        socket.on('roundResults', (results)=>{
            setResults(results);
            setGamePhase('results');
        });
        return()=>{
            socket.off('updateRound');
            socket.off('roundResults');
        }
    }, [setRound, setGamePhase, accessToken, socket]);


    return (
        <div>
            <h2>Game in Progress</h2>
            {gamePhase === 'guessing' && (
                <div>
                    <h2>Round {round} / {rounds}</h2>
                    {questions[round] ? (
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
                    <p>The song was: {questions[round].track.name} by {questions[round].track.artists[0].name}</p>
                    <p>Correct guess: {questions[round].playerName}</p>
                    {Object.entries(results).map(([player, result]) => (
            <p key={player}>
                {player} guessed: {result.guessedPlayer} — {result.correct ? 'Correct!' : 'Wrong'} (Points: {result.points})
            </p>
        ))}
                    {isLeader && (
                        <button onClick={startNextRound}>Next Round</button>
                    )}
                </div>
            )}
        </div>
    );
}

export default Game;
