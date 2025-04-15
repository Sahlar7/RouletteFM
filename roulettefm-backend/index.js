const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const routes = require('./routes/routes');
const handleSocketConnection = require('./sockets/socketHandlers');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());

// Use routes
app.use('/api', routes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: process.env.FRONTEND_URL, methods: ['GET', 'POST'], credentials: true },
    transports: ['websocket', 'polling'],
});

// Handle WebSocket connections
const lobbies = {};
const socketLobbies = {};
handleSocketConnection(io, lobbies, socketLobbies);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
