import React, { useState, useEffect, useRef } from 'react';
import './Game.css';

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
        try {
            await fetch(playEndpoint, {
                method: 'PUT',
                body: JSON.stringify({ uris: [track.uri] }),
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            
            console.log(`Playing: ${track.name}`);

            timerRef.current = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 0.01) {
                        submitGuess('No Guess');
                        return 0;
                    }
                    return prev - 0.01;
                });
            }, 10);
        } catch (error) {
            console.error('Error starting playback:', error);
        }
    };

    const saveToSpotify = (track) => {
        //socket.emit('saveTrack', {trackId: track.id, token: accessToken});
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
        socket.on('updateRound', ({ round, gamePhase }) => {
            setRound(round);
            setGamePhase(gamePhase);
            setTimer(duration);
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
            webPlayer.pause().catch((error) => console.error('Error pausing playback:', error));
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
            {gamePhase === 'guessing' && (
                <div>
                <h2>Round {round} / {rounds}</h2>
                <div className="timer-container">
                    <div className="timer-bar" style={{ width: `${((timer) / duration) * 100}%` }}></div>
                    <div className="timer-text">{Math.ceil(timer)}s</div>
                </div>
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
                    <h2>Results</h2>
                    <img src={questions[round - 1].track.album.images[0].url} alt={questions[round - 1].track.name} style={{ width: '200px', height: '200px' }} />
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
                    <h2>Final Results</h2>
                    <ol>
                        {Object.entries(points)
                            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                            .map(([player, playerPoints]) => (
                                <li key={player}>
                                    {player}: {playerPoints} points
                                </li>
                            ))}
                    </ol>
                    <ul>
                    {questions.map((question, index) => (
                                <li key={index}>
                                    <span>{question.track.name} by {question.track.artists[0].name}
                                        <img src={question.track.album.images[0].url} alt={question.track.name} style={{ width: '100px', height: '100px' }}/>
                                    </span>
                                    <button onClick={saveToSpotify(question.track)}>Save on Spotify</button>
                                </li>
                        ))}
                    </ul>
                    <button onClick={backToLobby}>Return to Lobby</button>
                    <span>or</span>
                    <button onClick={backToHome}>Return to Home Menu</button>
                </div>
            )}
        </div>
    );
}

export default Game;
