# Roulette.FM

Roulette.FM is a multiplayer music game where players compete by guessing songs from each other's Spotify libraries. The app uses the Spotify API to fetch saved tracks and create a fun, interactive experience. Play with your friends to see how well you know each other's music tastes! 

You can play Roulette.FM today at https://roulettefm.vercel.app
*Note: Development and bug fixes are still in progress

## Features
- Spotify authentication for players
- Multiplayer lobbies with real-time updates using WebSockets
- Randomized song selection from players' liked Spotify songs (selection from other playlists coming soon)
- Customizable game settings (rounds, duration)
- Recap playlist creation for the game session

---

## Running Locally

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- Spotify Developer Account (for API credentials)

### Spotify Developer Account Setup
1. Navigate to https://developer.spotify.com/ and create an account if necessary. Once you are logged in, navigate to the dashboard.
2. Click the "create app" button and fill out the form. IMPORTANT: for running locally, make sure your redirect uri is ```http://localhost:{PORT}/callback```, e.g ```http://localhost:3001/callback```. The port number should be whichever port you will host the backend server.

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
2. create a .env file in the backend directory with the following variables:
    ```
    SPOTIFY_CLIENT_ID=your_spotify_client_id
    SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
    SPOTIFY_REDIRECT_URI=http://localhost:3001/callback //make sure that this is the same redirect uri as set on your Spotify Developer Dashboard
    FRONTEND_URL=http://localhost:3000 //The port number can be whatever port the frontend is hosted at (3000 by default)
    ```
3. Start the backend server:
    ```npm start```

Frontend:
1. Navigate to the frontend directory:
    ```cd roulettefm-frontend```
2. Start the React app:
    ```npm start```
3. Open your browser and navigate to ```http://localhost:3000```

