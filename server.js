const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const locationService = require('./services/locationService');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Parse JSON bodies
app.use(express.json());

// Game rooms storage
const gameRooms = new Map();

// API Routes
app.get('/api/gamemodes', (req, res) => {
    const categories = locationService.getCategories();
    const gameModes = categories.map(category => ({
        id: category,
        name: formatCategoryName(category),
        count: locationService.getLocations(category).length
    }));

    res.json(gameModes);
});

// API route to get locations for single player
app.get('/api/locations', (req, res) => {
    const categories = locationService.getCategories();
    const locations = {};

    categories.forEach(category => {
        locations[category] = locationService.getLocations(category);
    });

    res.json(locations);
});

// Format category names for display (convert dash-case to Title Case)
function formatCategoryName(category) {
    return category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Player colors
const playerColors = [
    "#ef8354", "#2e4057", "#4f5d75", "#58a4b0",
    "#a9c25d", "#73628a", "#7e8d85", "#5085a5",
    "#ce796b", "#666a86", "#687864", "#f67e7d"
];

// Generate a random 6-digit room code
function generateRoomCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Get a random location that hasn't been used yet
function getRandomLocation(gameMode, usedLocations) {
    return locationService.getRandomLocation(gameMode, usedLocations);
}

// Function to broadcast leaderboard to all players in a room
function broadcastLeaderboard(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;

    const leaderboard = room.players.map(player => ({
        username: player.username,
        score: player.score,
        lastGuess: player.lastGuess || '--',
        color: player.color
    })).sort((a, b) => b.score - a.score);

    io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Create a new game room
    socket.on('createRoom', ({ username, gameMode, roundDuration, totalRounds, resultDelay }) => {
        const roomCode = generateRoomCode();

        // Create the game room
        gameRooms.set(roomCode, {
            host: socket.id,
            gameMode,
            roundDuration: roundDuration || 60, // Default 60 seconds
            totalRounds: totalRounds || 10,     // Default 10 rounds
            resultDelay: resultDelay || 10,     // Default 10 seconds for results
            players: [{
                id: socket.id,
                username,
                score: 0,
                isHost: true,
                color: playerColors[0],
                lastGuess: null,
                distance: null,
                hasGuessed: false
            }],
            active: false,
            round: 0,
            currentLocation: null,
            usedLocations: [],
            guessesForRound: new Map(),
            timerInterval: null,
            timeRemaining: 0
        });

        // Join the room
        socket.join(roomCode);
        socket.roomCode = roomCode;

        // Send confirmation
        socket.emit('roomCreated', {
            roomCode,
            isHost: true,
            gameMode,
            roundDuration: roundDuration || 60,
            totalRounds: totalRounds || 10,
            resultDelay: resultDelay || 10
        });

        console.log(`Room created: ${roomCode} by ${username}`);
    });

    // Join an existing game room
    socket.on('joinRoom', ({ roomCode, username }) => {
        const room = gameRooms.get(roomCode);

        if (!room) {
            socket.emit('error', { message: 'Room not found' });
            return;
        }

        if (room.active) {
            socket.emit('error', { message: 'Game already in progress' });
            return;
        }

        // Check if username is taken
        if (room.players.some(player => player.username === username)) {
            socket.emit('error', { message: 'Username already taken' });
            return;
        }

        // Add player to the room
        const playerIndex = room.players.length;
        const colorIndex = playerIndex % playerColors.length;

        room.players.push({
            id: socket.id,
            username,
            score: 0,
            isHost: false,
            color: playerColors[colorIndex],
            lastGuess: null,
            distance: null,
            hasGuessed: false
        });

        // Join the room
        socket.join(roomCode);
        socket.roomCode = roomCode;

        // Send confirmation
        socket.emit('roomJoined', {
            roomCode,
            isHost: false,
            gameMode: room.gameMode,
            roundDuration: room.roundDuration,
            totalRounds: room.totalRounds,
            resultDelay: room.resultDelay
        });

        // Notify all players in the room
        io.to(roomCode).emit('playerList', {
            players: room.players.map(p => ({
                username: p.username,
                isHost: p.isHost,
                color: p.color,
                score: p.score,
                lastGuess: p.lastGuess
            }))
        });

        console.log(`Player ${username} joined room ${roomCode}`);
    });

    // New handler for leaderboard requests
    socket.on('requestLeaderboard', () => {
        const roomCode = socket.roomCode;
        if (!roomCode) return;

        const room = gameRooms.get(roomCode);
        if (!room) return;

        // Create leaderboard data and send to the requesting client
        const leaderboard = room.players.map(player => ({
            username: player.username,
            score: player.score,
            lastGuess: player.lastGuess || '--',
            color: player.color
        })).sort((a, b) => b.score - a.score);

        socket.emit('leaderboardUpdate', { leaderboard });
    });

    // Start the game (host only)
    socket.on('startGame', () => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);

        if (!room) return;

        // Check if the requester is the host
        if (room.host !== socket.id) {
            socket.emit('error', { message: 'Only the host can start the game' });
            return;
        }

        // Start the game
        room.active = true;
        room.round = 0;
        room.usedLocations = [];

        // Initialize scores and broadcast initial leaderboard
        room.players.forEach(player => {
            player.score = 0;
            player.lastGuess = null;
            player.hasGuessed = false;
        });

        // Broadcast initial leaderboard
        broadcastLeaderboard(roomCode);

        // Start the first round
        nextRound(roomCode);
    });

    // Player submits a guess
    socket.on('submitGuess', ({ lat, lng, selectedCountry, isWithinTargetCountry }) => {
        const roomCode = socket.roomCode;
        const room = gameRooms.get(roomCode);

        if (!room || !room.active) return;

        // Find player
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex === -1) return;

        const player = room.players[playerIndex];

        // Save the guess
        room.guessesForRound.set(socket.id, {
            lat,
            lng,
            selectedCountry,
            isWithinTargetCountry: isWithinTargetCountry || false
        });
        player.hasGuessed = true;

        // Special handling for countries mode
        let isCorrectCountry = false;

        if (room.gameMode === 'countries' && selectedCountry) {
            // Check if the selected country is the correct one or if the center is within target country
            isCorrectCountry = (selectedCountry === room.currentLocation.name || isWithinTargetCountry);

            if (isCorrectCountry) {
                // For correct country selection, set distance to 0 and award full points
                player.distance = 0;
                player.score += 100;
                player.lastGuess = 'Richtig!';

                // Notify the player about their result
                socket.emit('guessResult', {
                    distance: 0,
                    points: 100,
                    isCorrectCountry: true
                });

                // Notify all players about the new guess
                io.to(roomCode).emit('playerGuessed', {
                    username: player.username,
                    hasGuessed: true
                });

                // Broadcast updated leaderboard
                broadcastLeaderboard(roomCode);

                // Check if all players have guessed
                const allGuessed = room.players.every(p => p.hasGuessed);
                if (allGuessed) {
                    clearInterval(room.timerInterval);
                    endRound(roomCode);
                }

                return;
            }
        }

        // For incorrect guesses or non-country modes, calculate distance
        const actualLat = room.currentLocation.lat;
        const actualLng = room.currentLocation.lng;
        const distance = calculateDistance(lat, lng, actualLat, actualLng);
        player.distance = distance;

        // Calculate score based on distance
        let pointsEarned = 0;
        let thresholds;

        // Adjust scoring thresholds based on game mode
        if (room.gameMode === 'german-cities') {
            thresholds = [25, 50, 100, 200];
        } else if (room.gameMode === 'european-cities') {
            thresholds = [50, 150, 300, 600];
        } else if (room.gameMode === 'world-landmarks' || room.gameMode === 'capitals') {
            thresholds = [100, 300, 700, 1500];
        } else { // countries
            thresholds = [300, 600, 1200, 2500];
        }

        if (distance < thresholds[0]) {
            pointsEarned = 100;
        } else if (distance < thresholds[1]) {
            pointsEarned = 75;
        } else if (distance < thresholds[2]) {
            pointsEarned = 50;
        } else if (distance < thresholds[3]) {
            pointsEarned = 25;
        } else {
            pointsEarned = 10;
        }

        // Update player score
        player.score += pointsEarned;
        player.lastGuess = `${Math.round(distance)} km`;

        // Notify the player about their result
        socket.emit('guessResult', {
            distance: Math.round(distance),
            points: pointsEarned,
            isCorrectCountry: isCorrectCountry
        });

        // Notify all players about the new guess
        io.to(roomCode).emit('playerGuessed', {
            username: player.username,
            hasGuessed: true
        });

        // Broadcast updated leaderboard
        broadcastLeaderboard(roomCode);

        // Check if all players have guessed
        const allGuessed = room.players.every(p => p.hasGuessed);
        if (allGuessed) {
            clearInterval(room.timerInterval);
            endRound(roomCode);
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        const roomCode = socket.roomCode;
        if (!roomCode) return;

        const room = gameRooms.get(roomCode);
        if (!room) return;

        // Remove player from the room
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            const player = room.players[playerIndex];
            console.log(`Player ${player.username} disconnected from room ${roomCode}`);

            room.players.splice(playerIndex, 1);

            // If room is empty, delete it
            if (room.players.length === 0) {
                // Clean up timer if active
                if (room.timerInterval) {
                    clearInterval(room.timerInterval);
                }
                gameRooms.delete(roomCode);
                console.log(`Room ${roomCode} deleted (empty)`);
                return;
            }

            // If host left, assign a new host
            if (player.isHost && room.players.length > 0) {
                room.players[0].isHost = true;
                room.host = room.players[0].id;
            }

            // Notify remaining players
            io.to(roomCode).emit('playerList', {
                players: room.players.map(p => ({
                    username: p.username,
                    isHost: p.isHost,
                    color: p.color,
                    score: p.score,
                    lastGuess: p.lastGuess
                }))
            });

            // Update leaderboard after player disconnect
            if (room.active) {
                broadcastLeaderboard(roomCode);
            }

            // Check if all remaining players have guessed (may need to end round)
            if (room.active && room.players.every(p => p.hasGuessed)) {
                clearInterval(room.timerInterval);
                endRound(roomCode);
            }
        }
    });
});

// Helper function to calculate distance between two points in km
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

// Function to start the next round
function nextRound(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;

    // Increment round
    room.round++;

    // Check if game is over
    if (room.round > room.totalRounds) {
        endGame(roomCode);
        return;
    }

    // Reset player guesses
    room.players.forEach(player => {
        player.hasGuessed = false;
    });

    // Clear previous guesses
    room.guessesForRound = new Map();

    // Select a random location
    const locationData = getRandomLocation(room.gameMode, room.usedLocations);

    if (locationData) {
        const locations = locationService.getLocations(room.gameMode);
        const locationIndex = locations.findIndex(l =>
            l.name === locationData.name && l.lat === locationData.lat && l.lng === locationData.lng);

        if (locationIndex !== -1) {
            room.usedLocations.push(locationIndex);
        }
    }

    room.currentLocation = locationData;

    // Start round timer
    room.timeRemaining = room.roundDuration;

    if (room.timerInterval) {
        clearInterval(room.timerInterval);
    }

    room.timerInterval = setInterval(() => {
        room.timeRemaining--;

        // Send time update to all players
        io.to(roomCode).emit('timeUpdate', { timeRemaining: room.timeRemaining });

        if (room.timeRemaining <= 0) {
            clearInterval(room.timerInterval);
            endRound(roomCode);
        }
    }, 1000);

    // Notify players of new round
    io.to(roomCode).emit('newRound', {
        round: room.round,
        totalRounds: room.totalRounds,
        location: {
            name: room.currentLocation.name
        },
        timeRemaining: room.timeRemaining,
        gameMode: room.gameMode
    });

    // Broadcast updated leaderboard at the start of each round
    broadcastLeaderboard(roomCode);
}

// Function to end the current round
function endRound(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;

    // Clean up timer if still running
    if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
    }

    // Prepare guesses to send to clients
    const guesses = [];
    room.guessesForRound.forEach((guess, playerId) => {
        const player = room.players.find(p => p.id === playerId);
        if (player) {
            guesses.push({
                username: player.username,
                lat: guess.lat,
                lng: guess.lng,
                color: player.color,
                selectedCountry: guess.selectedCountry,
                isCorrectCountry: room.gameMode === 'countries' &&
                    (guess.selectedCountry === room.currentLocation.name || guess.isWithinTargetCountry)
            });
        }
    });

    // Send round results to all players
    io.to(roomCode).emit('roundEnded', {
        actualLocation: {
            name: room.currentLocation.name,
            lat: room.currentLocation.lat,
            lng: room.currentLocation.lng
        },
        guesses,
        leaderboard: room.players.map(p => ({
            username: p.username,
            score: p.score,
            lastGuess: p.lastGuess,
            color: p.color
        })).sort((a, b) => b.score - a.score),
        resultDelay: room.resultDelay
    });

    // Wait for result delay before starting the next round
    setTimeout(() => {
        nextRound(roomCode);
    }, room.resultDelay * 1000);
}

// Function to end the game
function endGame(roomCode) {
    const room = gameRooms.get(roomCode);
    if (!room) return;

    // Clean up timer if still running
    if (room.timerInterval) {
        clearInterval(room.timerInterval);
        room.timerInterval = null;
    }

    // Sort players by score
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

    // Send game over to all players
    io.to(roomCode).emit('gameOver', {
        leaderboard: sortedPlayers.map(p => ({
            username: p.username,
            score: p.score,
            color: p.color
        }))
    });

    // Reset game state but keep the room
    room.active = false;
    room.round = 0;
    room.usedLocations = [];
    room.guessesForRound = new Map();

    // Reset player scores
    room.players.forEach(player => {
        player.score = 0;
        player.lastGuess = null;
        player.distance = null;
        player.hasGuessed = false;
    });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});