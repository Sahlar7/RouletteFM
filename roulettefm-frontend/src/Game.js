import React, { useState, useEffect, useRef } from 'react';

function Game({ players, setPlayers, socket, isLeader, setLeader, lobby, gamePhase, setGamePhase, rounds, setRounds, duration, setDuration, accessToken, setLobby, round, setRound, questions, setQuestions, webPlayer, setWebPlayer, deviceId, setDeviceId, name}) {
    const [results, setResults] = useState({});
    const [timer, setTimer] = useState(duration);
    const timerRef = useRef(null);
    const firstPlay = useRef(false);
    const [points, setPoints] = useState({});


    const submitGuess = (guess) => {
        console.log('submitting...');
        if (timerRef.current) clearInterval(timerRef.current);
        const timeTaken = duration - timer;
        socket.emit('addGuess', { guess, timeTaken, lobbyId: lobby.id });
        console.log(`Guess submitted: ${guess}, Time taken: ${timeTaken}s`);
    };

    const startNextRound = () => {
        socket.emit('nextRound', { lobbyId: lobby.id });

    };
    const resetGameState = async () =>{
        await webPlayer.disconnect().catch((error) => console.error('Error disconnecting player:', error));
        setDeviceId(null);
        setWebPlayer(null);        
        setTimer(duration);
        setResults({});
        setRound(0);
        setPoints({});
        firstPlay.current = false;
        clearInterval(timerRef.current);
        setQuestions([]);
    }

    const backToLobby = () =>{
        setGamePhase('lobby');
        resetGameState();
        socket.emit('backToLobby', {lobbyId: lobby.id, token: accessToken, name});
    };

    const backToHome = () =>{
        socket.emit('exitLobby', {lobbyId: lobby.id});
        socket.emit('backToHome', {lobbyId: lobby.id});
        resetGameState();
        setGamePhase('lobby');
        setRounds(5);
        setDuration(10);
        setLobby(null);
        setLeader(false);
        setPlayers([]);
        socket.disconnect();
        socket.connect();
    }

    const playSongClip = async (track) => {
        if (!deviceId || !track?.uri) {
            console.error('Device ID or track URI missing');
            return;
        }

        const playEndpoint = `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`;
        const startTime = Date.now();
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

            setTimer(duration);
            timerRef.current = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        submitGuess('No Guess');
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error) {
            console.error('Error starting playback:', error);
        }
    };
    useEffect(() => {
        if (round === 1 && !firstPlay.current && deviceId && webPlayer) {
            if (questions[round - 1] && gamePhase === 'guessing') {
                const track = questions[round - 1].track;
                playSongClip(track);
            }
            firstPlay.current = true;
        }
    }, [questions, round, gamePhase, playSongClip, deviceId, webPlayer]);

    useEffect(() => {
        socket.on('gameReady', ({ gamePhase, round, questions }) => {
            if (questions[round - 1] && gamePhase === 'guessing') {
                const track = questions[round - 1].track
                playSongClip(track);
            }
        });
        socket.on('updateRound', ({ round, gamePhase }) => {
            setRound(round);
            setGamePhase(gamePhase);
            if (questions[round - 1] && gamePhase === 'guessing') {
                const track = questions[round - 1].track;
                playSongClip(track);
            }
        });
        socket.on('roundResults', (results) => {
            webPlayer.pause().catch((error) => console.error('Error pausing playback:', error));
            setResults(results);
            setGamePhase('results');
        });
        socket.on('finalResults', ({ points, gamePhase }) => {
            setPoints(points);
            setGamePhase(gamePhase);
        });
        return () => {
            socket.off('updateRound');
            socket.off('roundResults');
        }
    }, [setRound, setGamePhase, accessToken, socket, webPlayer, playSongClip, questions]);


    return (
        <div>
            <h2>Game in Progress</h2>
            {gamePhase === 'guessing' && (
                <div>
                    <h2>Round {round} / {rounds}</h2>
                    <h3>Time Left: {timer}s</h3>
                    {questions[round - 1] ? (
                        <div>
                            <p>Try to guess whose playlist this song is from!</p>
                            <div>
                                {players.map((player) => (
                                    <button
                                        key={player.name} onClick={() => submitGuess(player.name)}>
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
                    <p>The song was: {questions[round - 1].track.name} by {questions[round - 1].track.artists[0].name}</p>
                    <p>Correct guess: {questions[round - 1].playerName}</p>
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
            {gamePhase === 'finalResults' && points && (
                <div>
                    <h3>Final Results</h3>
                    <ol>
                        {Object.entries(points)
                            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                            .map(([player, playerPoints]) => (
                                <li key={player}>
                                    {player}: {playerPoints} points
                                </li>
                            ))}
                    </ol>
                    <button onClick={backToLobby}>Return to Lobby</button>
                    <span>or</span>
                    <button onClick={backToHome}>Return to Home Menu</button>
                </div>
            )}
        </div>
    );
}

export default Game;
