import React, { useState, useEffect } from 'react';
import Modal from './modal';

function CreateRecap({ questions, accessToken, socket }) {
    const [isOpen, setIsOpen] = useState(false);
    const [playlistName, setPlaylistName] = useState('');
    const [recapLink, setRecapLink] = useState('');

    const openModal = () => setIsOpen(true);
    const closeModal = () => setIsOpen(false);

    const createRecap = () => {
        const trackUris = questions.map((question) => question.track.uri);
        socket.emit('makeRecap', {trackUris: trackUris, token: accessToken, playlistName: playlistName});
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
            <button onClick={openModal}>Create Roulette Recap</button>
            <Modal isOpen={isOpen} onClose={closeModal}>
            {recapLink? (<a href={
                recapLink} target="_blank" rel="noopener noreferrer">Recap Created! Click here to view</a>
            ) : (
                <div>
                    <label>Playlsit Name</label>
                    <input type="text" 
                    default="My Roulette Recap" 
                    onChange={(e)=>setPlaylistName(e.target.value)}/>
                    <button onClick={createRecap}>
                        Create Recap
                    </button>
                </div>
                )}
            </Modal>
        </div>
    );
}

export default CreateRecap;