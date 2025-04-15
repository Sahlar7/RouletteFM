const axios = require('axios');
const selectRandom  = require('./helpers').selectRandom;

async function getSavedTracks(accessToken, limit = 50, offset = 0) {
    try {
        const response = await axios.get(`https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        // Extract track objects from the response
        const tracks = response.data.items.map(item => item.track).filter(track => track != null);
        return tracks;
    } catch (error) {
        console.error('Error fetching saved tracks:', error);
        return [];
    }
}

async function fetchAllSavedTracks(accessToken) {
    const limit = 50; // Spotify's API limit for saved tracks per request
    let offset = 0;
    let allTracks = [];
    let hasMore = true;

    while (hasMore) {
        const tracks = await getSavedTracks(accessToken, limit, offset);
        allTracks = [...allTracks, ...tracks];
        offset += limit;
        hasMore = tracks.length === limit; // If we get less than the limit, we're done
    }
    return allTracks;
}


async function createRecapPlaylist(accessToken, trackUris, playlistName) {
    try {
        const response = await axios.post(`https://api.spotify.com/v1/me/playlists`, {
                name: playlistName,
                description: 'A recap of your Roulette.FM game!',
                public: false
        }, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        const playlistLink = response.data.external_urls.spotify;
        const playlistId = response.data.id;
            try{
                await axios.post(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                    uris: trackUris,
                }, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                });
                return playlistLink;
        } catch (error) {
            console.error('Error adding tracks to playlist:', error);
            return false;
        }
    } catch (error) {
        console.error('Error creating playlist:', error);
        return false;
    }
}

async function selectRandomSong(players, rounds) {
    try {
        // Step 1: Fetch saved tracks for each player
        const playerTracks = await Promise.all(players.map(async (player) => {
            const tracks = await fetchAllSavedTracks(player.token); // Fetch player's saved tracks
            return { player, tracks };
        }));
        // Filter out players who have no saved tracks
        const validPlayerTracks = playerTracks.filter(data => data.tracks.length > 0);
        if (validPlayerTracks.length === 0) {
            console.error('No players have valid saved tracks');
            return null; // Return null if no player has valid saved tracks
        }

        // Step 2: Randomly select a player
        const questions = [];
        const playerQueue = [...validPlayerTracks];
        
        for(let i = 0; i<rounds; i++){
            const randomPlayerData = playerQueue.shift();
            const randomPlayerName = randomPlayerData.player.name;
    
            // Step 3: Randomly select a track from that player's saved tracks
            const randomTrack = selectRandom(randomPlayerData.tracks);
            const filteredTrack = {name: randomTrack.name, 
                artists: randomTrack.artists, 
                uri: randomTrack.uri, 
                album: randomTrack.album, 
                id: randomTrack.id,
                duration_ms: randomTrack.duration_ms,
            };
            const questionExists = questions.some(
                q => q.track.uri === filteredTrack.uri && q.playerName === randomPlayerName
            );

            if (!filteredTrack.name || !filteredTrack.uri || !randomPlayerName || questionExists) {
                i--; // Retry the current round if invalid data
            } else {
                questions.push({ track: filteredTrack, playerName: randomPlayerName });
                playerQueue.push(randomPlayerData);
            }
        }
        for (let i = questions.length-1; i>0; i--){
            const j = Math.floor(Math.random()*(i+1));
            [questions[i], questions[j]] = [questions[j], questions[i]]; 
        }
        return questions;
    } catch (error) {
        console.error('Error selecting random song:', error);
        return null; // Return null if something goes wrong
    }
}


module.exports = {getSavedTracks, fetchAllSavedTracks, createRecapPlaylist, selectRandomSong};