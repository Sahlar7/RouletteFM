# Roulette.FM

![alt text](https://github.com/Sahlar7/RouletteFM/blob/main/roulettefm-frontend/src/assets/RouletteFmLogo2.png "RouletteFM Logo")


Roulette.FM is a multiplayer music game where players compete by guessing songs from each other's Spotify libraries. The app uses the Spotify API to fetch saved tracks and create a fun, interactive experience. Play with your friends to see how well you know each other's music tastes! 

## How to Play
You can play Roulette.FM at https://roulettefm.vercel.app. (OUTDATED - Spotify API no longer allows unlisted users for small apps, and the RouletteFM servers are no longer active. Thanks for trying! You can still play the game locally.)

Login with your Spotify account (premium subscription required). The Spotify API will request for access to your account information to fetch saved tracks and create recap playlists. **Your account information is NOT stored by Roulette.FM and will not be used beyond the explicit features of the game**. 

Create a live mulitplayer lobby powered by Websockets, and share the lobby ID with your friends. The player who created the lobby will be the leader. The leader can adjust the number of rounds, duration for each round, and is the player who must start the game. 

Each round, a song will be randomly selected from a player's liked Spotify songs, and played through your browser via the Spotify WebPlayback SDK. To get points for that round, guess which player liked the song. The faster you guess, the more points you win! After a set number of rounds, the player with the most points wins.

Additionally, at the end of each game, you can create a Roulette Recap, which is a Spotify playlist made of all the songs from that Roulette.FM game session.

*Note: Development and bug fixes are still in progress

---

## Roulette.FM Local Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Spotify Developer Account (for API credentials)

### Spotify Developer Account Setup
1. Navigate to https://developer.spotify.com/ and create an account if necessary. Once you are logged in, navigate to the dashboard.
2. Click the "create app" button and fill out the form. IMPORTANT: for running locally, make sure your redirect uri is ```http://localhost:{PORT}/api/auth/callback```, e.g ```http://localhost:3001/api/auth/callback```. The port number should be whichever port you will host the backend server (3001 by default).

### Installation & Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/your-repo/RouletteFM.git
   cd RouletteFM
   ```
2. Install dependencies for both backend and frontend
    ```
    cd roulettefm-backend
    npm install
    cd ../roulettefm-frontend
    npm install
    ```

### Running the application
Backend:
1. Navigate to the backend directory:
    ```cd roulettefm-backend```
2. Create a .env file in the backend directory with the following variables:
    ```
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
    SPOTIFY_REDIRECT_URI=http://localhost:3001/api/auth/callback //make sure that this is the same redirect uri as set on your Spotify Developer Dashboard
    FRONTEND_URL=http://localhost:3000 //The port number can be whatever port the frontend is hosted at (3000 by default)
    //Optional: PORT={choose a port number. Otherwise it will be 3001}
    ```
3. Start the backend server:
    ```npm start```

Frontend:
1. Navigate to the frontend directory:
    ```cd roulettefm-frontend```
2. Create a .env file in the frontend directory with the following variable:
    ```
    REACT_APP_SERVER_URL="http://localhost:3001" //or whatever you set the PORT to
    ```
3. Start the React app:
    ```npm start```
4. Open your browser and navigate to ```http://localhost:3000```

