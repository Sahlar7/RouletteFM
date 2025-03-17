import React, { useState, useEffect, useRef } from 'react';
import './Game.css';
import CreateRecap from './CreateRecap';
import Button from './Button';

function Game({ players, setPlayers, socket, isLeader, setLeader, lobby, gamePhase, setGamePhase, rounds, setRounds, duration, setDuration, accessToken, setLobby, round, setRound, questions, setQuestions, webPlayer, setWebPlayer, deviceId, setDeviceId, name}) {
    const [results, setResults] = useState({});
    const [timer, setTimer] = useState(duration);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingAction, setLoadingAction] = useState('');
    const timerRef = useRef(null);
    const firstPlay = useRef(false);
    const [points, setPoints] = useState({});
    const [selectedGuess, setSelectedGuess] = useState(null);

    const submitGuess = (guess) => {
        const timeTaken = duration - timer;
        setSelectedGuess(guess);
        setIsLoading(true);
        setLoadingAction('submitting');
        
        socket.emit('addGuess', { guess, timeTaken, lobbyId: lobby.id });
        
        setTimeout(() => {
            setIsLoading(false);
            setLoadingAction('');
        }, 800);
    };

    const startNextRound = () => {
        setIsLoading(true);
        setLoadingAction('loading');
        socket.emit('nextRound', { lobbyId: lobby.id });
        
        // Simulated delay for visual feedback
        setTimeout(() => {
            setIsLoading(false);
            setLoadingAction('');
        }, 200);
    };
    
    const resetGameState = async () => {
        setTimer(duration);
        setResults({});
        setRound(0);
        setPoints({});
        setSelectedGuess(null);
        firstPlay.current = false;
        clearInterval(timerRef.current);
        setQuestions([]);
    }

    const backToLobby = () => {
        setIsLoading(true);
        setLoadingAction('returning');
        
        setTimeout(() => {
            setGamePhase('lobby');
            resetGameState();
            socket.emit('backToLobby', {lobbyId: lobby.id, token: accessToken, name});
            setIsLoading(false);
            setLoadingAction('');
        }, 800);
    };

    const backToHome = () => {
        setIsLoading(true);
        setLoadingAction('exiting');
        
        setTimeout(() => {
            socket.disconnect();
            resetGameState();
            setGamePhase('lobby');
            setRounds(5);
            setDuration(10);
            setLobby(null);
            setLeader(false);
            setPlayers([]);
            socket.connect();
            setIsLoading(false);
            setLoadingAction('');
        }, 800);
    }

    const playSongClip = async (track) => {
        if (!deviceId || !track?.uri) {
            console.error('Device ID or track URI missing');
            return;
        }

        setIsLoading(true);
        setLoadingAction('loading');

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
            
            setIsLoading(false);
            setLoadingAction('');
            
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
            setIsLoading(false);
            setLoadingAction('');
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
    }, [questions, round, gamePhase, deviceId, webPlayer]);

    useEffect(() => {
        socket.on('updateRound', ({ round, gamePhase }) => {
            setRound(round);
            setGamePhase(gamePhase);
            setTimer(duration);
            setSelectedGuess(null);
            
            if (questions[round - 1] && gamePhase === 'guessing') {
                const track = questions[round - 1].track;
                playSongClip(track);
            }
        });
        
        socket.on('roundResults', ({results, points}) => {
            webPlayer.pause().catch((error) => console.error('Error pausing playback:', error));
            if (timerRef.current) clearInterval(timerRef.current);
            setResults(results);
            setPoints(points);
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
            socket.off('finalResults');
        }
    }, [setRound, setGamePhase, accessToken, socket, webPlayer, duration]);

    const getAnimationClass = (phase) => {
        if (phase === gamePhase) return 'active-phase';
        return '';
    };

    return (
        <div className="container">
            {gamePhase === 'guessing' && (
                <div className={`game-phase ${getAnimationClass('guessing')}`}>
                    <h2>Round {round} / {rounds}</h2>
                    <div className="timer-container">
                        <div className="timer-bar" style={{ width: `${((timer) / duration) * 100}%` }}></div>
                        <div className="timer-text">{Math.ceil(timer)}s</div>
                    </div>
                    
                    {questions[round - 1] ? (
                        <div className="guessing-container">
                            {isLoading && loadingAction === 'loading' ? (
                                <div className="loading-state">
                                    <div className="spinner large"></div>
                                    <p>Loading song...</p>
                                </div>
                            ) : (
                                <>
                                    {selectedGuess ? 
                                        (
                                            <p className="instruction-text">Waiting on other players to guess...</p>
                                        ) : (
                                            <>
                                            <p className="instruction-text">Try to guess whose playlist this song is from!</p>
                                                <div className="guess-grid">
                                                    {players.map((player) => (
                                                        <Button
                                                            key={player.name}
                                                            onClick={() => submitGuess(player.name)}
                                                            loading={isLoading && loadingAction === 'submitting' && selectedGuess === player.name}
                                                            disabled={isLoading || timer <= 0}
                                                            className={`guess-btn ${selectedGuess === player.name ? 'selected' : ''}`}
                                                        >
                                                            {player.name}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </>
                                        )
                                    }
                                </>
                            )}
                        </div>
                    ) : (
                        <div className="loading-state">
                            <div className="spinner large"></div>
                            <p>Waiting for the next song...</p>
                        </div>
                    )}
                </div>
            )}

            {gamePhase === 'results' && results && (
                <div className={`game-phase ${getAnimationClass('results')}`}>
                    <h2>Round Results</h2>
                    <div className="song-card">
                        <img 
                            src={questions[round - 1].track.album.images[0].url} 
                            alt={questions[round - 1].track.name} 
                            className="album-art"
                        />
                        <p className="song-title">{questions[round - 1].track.name}</p>
                        <p className="song-artist">by {questions[round - 1].track.artists[0].name}</p>
                        <p className="correct-answer">From {questions[round - 1].playerName}'s playlist</p>
                    </div>
                    
                    <div className="results-list">
                        {Object.entries(results)
                            .sort(([, resultA], [, resultB]) => resultB.points - resultA.points)
                            .map(([player, result], index) => (
                                <div 
                                    key={player} 
                                    className={`result-item ${result.correct ? 'correct-guess' : 'wrong-guess'}`}
                                >
                                    <div className="rank">{index + 1}</div>
                                    <div className="player-avatar">{player.charAt(0)}</div>
                                    <div className="player-name">{player}</div>
                                    <div className="guess-result">
                                        guessed: <strong>{result.correct ? 'Correct!' : 'Incorrect'}</strong>
                                    </div>
                                    <div className="points-badge">Points: {result.points}</div>
                                </div>
                            ))}
                    </div>
                    
                    {isLeader && (
                        <div className="footer">
                            <Button 
                                onClick={startNextRound}
                                loading={isLoading && loadingAction === 'loading'}
                            >
                                {round < rounds ? 'Next Round' : 'Finish Game'}
                            </Button>
                        </div>
                    )}
                </div>
            )}
            
            {gamePhase === 'finalResults' && points && (
                <div className={`game-phase final-results ${getAnimationClass('finalResults')}`}>
                    <h2>Final Results</h2>
                    
                    <ol className="leaderboard">
                        {Object.entries(points)
                            .sort(([, pointsA], [, pointsB]) => pointsB - pointsA)
                            .map(([player, playerPoints], index) => (
                                <li 
                                    key={player} 
                                    className={`leaderboard-item ${index === 0 ? 'first-place' : index === 1 ? 'second-place' : index === 2 ? 'third-place' : ''}`}
                                >
                                    <div className="rank">{index + 1}</div>
                                    <div className="player-avatar">{player.charAt(0)}</div>
                                    <div className="player-name">{player}</div>
                                    <div className="points-badge">Points: {playerPoints}</div>
                                </li>
                            ))}
                    </ol>
                    
                    <h3>Songs Played</h3>
                    <div className="song-gallery">
                        {questions.map((question, index) => (
                            <div className="song-thumbnail" key={index}>
                                <img 
                                    src={question.track.album.images[0].url} 
                                    alt={question.track.name} 
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        ))}
                    </div>
                    
                    <div className="recap-section">
                        <CreateRecap 
                            questions={questions}
                            accessToken={accessToken}
                            socket={socket}
                            isLoading={isLoading}
                        />
                    </div>
                    
                    <div className="footer">
                        <Button 
                            onClick={backToLobby}
                            loading={isLoading && loadingAction === 'returning'}
                            disabled={isLoading}
                        >
                            Return to Lobby
                        </Button>
                        <Button 
                            onClick={backToHome}
                            secondary={true}
                            loading={isLoading && loadingAction === 'exiting'}
                            disabled={isLoading}
                        >
                            Exit to Menu
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Game;