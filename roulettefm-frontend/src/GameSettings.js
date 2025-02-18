import React, { useState } from 'react';
import Modal from './modal';

function GameSettings({ rounds, setRounds, duration, setDuration, isLeader, socket, lobbyId }) {
    const [isOpen, setIsOpen] = useState(false);

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);

    const handleRoundsChange = (e) => {
        const newRounds = parseInt(e.target.value);
        setRounds(newRounds);
        socket.emit('saveSettings', { rounds: newRounds, duration, lobbyId });
    };

    const handleDurationChange = (e) => {
        const newDuration = parseInt(e.target.value);
        setDuration(newDuration);
        socket.emit('saveSettings', { rounds, duration: newDuration, lobbyId });
    };

    return (
        <div>
            <button onClick={openModal}>Game Settings</button>
            <Modal isOpen={isOpen} onClose={closeModal}>
                <h3>Game Settings</h3>
                <label>
                    Number of Rounds:
                    <select value={rounds} onChange={handleRoundsChange} disabled={!isLeader}>
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={15}>15</option>
                        <option value={20}>20</option>
                    </select>
                </label>
                <br/>
                <label>
                    Round Duration (seconds):
                    <select value={duration} onChange={handleDurationChange} disabled={!isLeader}>
                        <option value={10}>10</option>
                        <option value={20}>20</option>
                        <option value={30}>30</option>
                    </select>
                </label>
                {!isLeader && <p>Only the leader can change the settings.</p>}
            </Modal>
        </div>
    );
}

export default GameSettings;