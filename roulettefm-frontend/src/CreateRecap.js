import React, { useState, useEffect } from 'react';
import Modal from './modal';
import Button from './Button';

function CreateRecap({ questions, accessToken, socket, isLoading }) {
    const [isOpen, setIsOpen] = useState(false);
    const [playlistName, setPlaylistName] = useState('My Roulette Recap');
    const [recapLink, setRecapLink] = useState('');

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);

    const createRecap = () => {
        const trackUris = questions.map((question) => question.track.uri);
        socket.emit('makeRecap', { trackUris, token: accessToken, playlistName });
    };

    useEffect(() => {
        socket.on('recapCreated', (recapLink) => {
            setRecapLink(recapLink);
        });
        return () => {
            socket.off('recapCreated');
        };
    }, [socket]);

    return (
        <div>
            <Button onClick={openModal} disabled={isLoading}>Create Roulette Recap</Button>
            <Modal isOpen={isOpen} onClose={closeModal}>
                {recapLink ? (
                    <a href={recapLink} target="_blank" rel="noopener noreferrer">
                        Recap Created! Click here to view
                    </a>
                ) : (
                    <div>
                        <label>Playlist Name</label>
                        <input
                            type="text"
                            value={playlistName}
                            onChange={(e) => setPlaylistName(e.target.value)}
                        />
                        <Button onClick={createRecap}>Create Recap</Button>
                    </div>
                )}
            </Modal>
        </div>
    );
}

export default CreateRecap;