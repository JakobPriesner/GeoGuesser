const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const locationService = require('./public/services/locationService');
const favicon = require("serve-favicon");

class GameServer {
    constructor() {
        // Initialize Express app
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new Server(this.server);

        // Game rooms storage
        this.gameRooms = new Map();

        // Player colors for multiplayer
        this.playerColors = [
            "#ef8354", "#2e4057", "#4f5d75", "#58a4b0",
            "#a9c25d", "#73628a", "#7e8d85", "#5085a5",
            "#ce796b", "#666a86", "#687864", "#f67e7d"
        ];

        // Scoring thresholds by game mode
        this.scoringThresholds = {
            'german-cities': [25, 50, 100, 200],
            'european-cities': [50, 150, 300, 600],
            'world-landmarks': [100, 300, 700, 1500],
            'capitals': [100, 300, 700, 1500],
            'countries': [300, 600, 1200, 2500]
        };

        // Set up middleware and routes
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
    }

    // Configure Express middleware
    setupMiddleware() {
        this.app.use(favicon(path.join(__dirname, 'public', 'favicon.svg')));
        this.app.use(express.static(path.join(__dirname, 'public')));
        this.app.use(express.json());
    }

    // Set up API routes
    setupRoutes() {
        // Get available game modes
        this.app.get('/api/gamemodes', (req, res) => {
            const categories = locationService.getCategories();
            const gameModes = categories.map(category => ({
                id: category,
                name: this.formatCategoryName(category),
                count: locationService.getLocations(category).length
            }));

            res.json(gameModes);
        });

        // Get locations for single player
        this.app.get('/api/locations', (req, res) => {
            const categories = locationService.getCategories();
            const locations = {};

            categories.forEach(category => {
                locations[category] = locationService.getLocations(category);
            });

            res.json(locations);
        });
    }

    // Format category name for display
    formatCategoryName(category) {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    // Set up Socket.io event handlers
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`User connected: ${socket.id}`);

            // Create a new game room
            socket.on('createRoom', (data) => this.handleCreateRoom(socket, data));

            // Join an existing game room
            socket.on('joinRoom', (data) => this.handleJoinRoom(socket, data));

            // Request leaderboard update
            socket.on('requestLeaderboard', () => this.handleLeaderboardRequest(socket));

            // Start the game (host only)
            socket.on('startGame', () => this.handleStartGame(socket));

            // Player submits a guess
            socket.on('submitGuess', (data) => this.handleSubmitGuess(socket, data));

            // Restart game
            socket.on('restartGame', () => this.handleRestartGame(socket));

            // Handle disconnection
            socket.on('disconnect', () => this.handleDisconnect(socket));
        });
    }

    // Create a new game room
    handleCreateRoom(socket, { username, gameMode, roundDuration, totalRounds, resultDelay }) {
        const roomCode = this.generateRoomCode();

        // Create the game room
        this.gameRooms.set(roomCode, {
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
                color: this.playerColors[0],
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
    }

    // Join an existing game room
    handleJoinRoom(socket, { roomCode, username }) {
        const room = this.gameRooms.get(roomCode);

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
        const colorIndex = playerIndex % this.playerColors.length;

        room.players.push({
            id: socket.id,
            username,
            score: 0,
            isHost: false,
            color: this.playerColors[colorIndex],
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
        this.io.to(roomCode).emit('playerList', {
            players: room.players.map(p => ({
                username: p.username,
                isHost: p.isHost,
                color: p.color,
                score: p.score,
                lastGuess: p.lastGuess
            }))
        });

        console.log(`Player ${username} joined room ${roomCode}`);
    }

    // Handle leaderboard request
    handleLeaderboardRequest(socket) {
        const roomCode = socket.roomCode;
        if (!roomCode) return;

        const room = this.gameRooms.get(roomCode);
        if (!room) return;

        // Create leaderboard data and send to the requesting client
        const leaderboard = room.players
            .map(player => ({
                username: player.username,
                score: player.score,
                lastGuess: player.lastGuess || '--',
                color: player.color
            }))
            .sort((a, b) => b.score - a.score);

        socket.emit('leaderboardUpdate', { leaderboard });
    }

    // Start the game (host only)
    handleStartGame(socket) {
        const roomCode = socket.roomCode;
        const room = this.gameRooms.get(roomCode);

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
        this.broadcastLeaderboard(roomCode);

        // Start the first round
        this.nextRound(roomCode);
    }

    // Handle restart game request
    handleRestartGame(socket) {
        const roomCode = socket.roomCode;
        const room = this.gameRooms.get(roomCode);

        if (!room) return;

        // Check if the requester is the host
        if (room.host !== socket.id) {
            socket.emit('error', { message: 'Only the host can restart the game' });
            return;
        }

        // Reset game state but keep players
        room.active = true;
        room.round = 0;
        room.usedLocations = [];
        room.guessesForRound = new Map();

        // Reset player scores and status
        room.players.forEach(player => {
            player.score = 0;
            player.lastGuess = null;
            player.distance = null;
            player.hasGuessed = false;
        });

        // Start the first round
        this.nextRound(roomCode);
    }

    // Handle player guess submission
    handleSubmitGuess(socket, { lat, lng, selectedCountry, isWithinTargetCountry }) {
        const roomCode = socket.roomCode;
        const room = this.gameRooms.get(roomCode);

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
            // Check if selected country is correct or if center is within target
            isCorrectCountry = (
                selectedCountry === room.currentLocation.name ||
                isWithinTargetCountry
            );

            if (isCorrectCountry) {
                // For correct country, award full points
                player.distance = 0;
                player.score += 100;
                player.lastGuess = 'Richtig!';

                // Notify player about their result
                socket.emit('guessResult', {
                    distance: 0,
                    points: 100,
                    isCorrectCountry: true
                });

                // Notify all players about the new guess
                this.io.to(roomCode).emit('playerGuessed', {
                    username: player.username,
                    hasGuessed: true
                });

                // Broadcast updated leaderboard
                this.broadcastLeaderboard(roomCode);

                // Check if all players have guessed
                const allGuessed = room.players.every(p => p.hasGuessed);
                if (allGuessed) {
                    clearInterval(room.timerInterval);
                    this.endRound(roomCode);
                }

                return;
            }
        }

        // For incorrect guesses or non-country modes, calculate distance
        const actualLat = room.currentLocation.lat;
        const actualLng = room.currentLocation.lng;
        const distance = this.calculateDistance(lat, lng, actualLat, actualLng);
        player.distance = distance;

        // Calculate score based on distance and game mode
        let pointsEarned = 0;
        const thresholds = this.scoringThresholds[room.gameMode] || this.scoringThresholds.countries;

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
        this.io.to(roomCode).emit('playerGuessed', {
            username: player.username,
            hasGuessed: true
        });

        // Broadcast updated leaderboard
        this.broadcastLeaderboard(roomCode);

        // Check if all players have guessed
        const allGuessed = room.players.every(p => p.hasGuessed);
        if (allGuessed) {
            clearInterval(room.timerInterval);
            this.endRound(roomCode);
        }
    }

    // Handle player disconnection
    handleDisconnect(socket) {
        const roomCode = socket.roomCode;
        if (!roomCode) return;

        const room = this.gameRooms.get(roomCode);
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
                this.gameRooms.delete(roomCode);
                console.log(`Room ${roomCode} deleted (empty)`);
                return;
            }

            // If host left, assign a new host
            if (player.isHost && room.players.length > 0) {
                room.players[0].isHost = true;
                room.host = room.players[0].id;
            }

            // Notify remaining players
            this.io.to(roomCode).emit('playerList', {
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
                this.broadcastLeaderboard(roomCode);
            }

            // Check if all remaining players have guessed
            if (room.active && room.players.every(p => p.hasGuessed)) {
                clearInterval(room.timerInterval);
                this.endRound(roomCode);
            }
        }
    }

    // Start the next round
    nextRound(roomCode) {
        const room = this.gameRooms.get(roomCode);
        if (!room) return;

        // Increment round
        room.round++;

        // Check if game is over
        if (room.round > room.totalRounds) {
            this.endGame(roomCode);
            return;
        }

        // Reset player guesses
        room.players.forEach(player => {
            player.hasGuessed = false;
        });

        // Clear previous guesses
        room.guessesForRound = new Map();

        // Select a random location
        const locationData = locationService.getRandomLocation(room.gameMode, room.usedLocations);

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
            this.io.to(roomCode).emit('timeUpdate', {
                timeRemaining: room.timeRemaining
            });

            if (room.timeRemaining <= 0) {
                clearInterval(room.timerInterval);
                this.endRound(roomCode);
            }
        }, 1000);

        // Notify players of new round
        this.io.to(roomCode).emit('newRound', {
            round: room.round,
            totalRounds: room.totalRounds,
            location: {
                name: room.currentLocation.name
            },
            timeRemaining: room.timeRemaining,
            gameMode: room.gameMode
        });

        // Broadcast updated leaderboard at the start of each round
        this.broadcastLeaderboard(roomCode);
    }

    // End the current round
    endRound(roomCode) {
        const room = this.gameRooms.get(roomCode);
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
        this.io.to(roomCode).emit('roundEnded', {
            actualLocation: {
                name: room.currentLocation.name,
                lat: room.currentLocation.lat,
                lng: room.currentLocation.lng
            },
            guesses,
            leaderboard: room.players
                .map(p => ({
                    username: p.username,
                    score: p.score,
                    lastGuess: p.lastGuess,
                    color: p.color
                }))
                .sort((a, b) => b.score - a.score),
            resultDelay: room.resultDelay
        });

        // Wait for result delay before starting the next round
        setTimeout(() => {
            this.nextRound(roomCode);
        }, room.resultDelay * 1000);
    }

    // End the game
    endGame(roomCode) {
        const room = this.gameRooms.get(roomCode);
        if (!room) return;

        // Clean up timer if still running
        if (room.timerInterval) {
            clearInterval(room.timerInterval);
            room.timerInterval = null;
        }

        // Sort players by score
        const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

        // Send game over to all players
        this.io.to(roomCode).emit('gameOver', {
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

    // Broadcast leaderboard to all players in a room
    broadcastLeaderboard(roomCode) {
        const room = this.gameRooms.get(roomCode);
        if (!room) return;

        const leaderboard = room.players
            .map(player => ({
                username: player.username,
                score: player.score,
                lastGuess: player.lastGuess || '--',
                color: player.color
            }))
            .sort((a, b) => b.score - a.score);

        this.io.to(roomCode).emit('leaderboardUpdate', { leaderboard });
    }

    // Generate a random 6-digit room code
    generateRoomCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Calculate distance between two points in km
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = this.deg2rad(lat2 - lat1);
        const dLon = this.deg2rad(lon2 - lon1);
        const a =
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    }

    deg2rad(deg) {
        return deg * (Math.PI/180);
    }

    // Start the server
    start(port = process.env.PORT || 3000) {
        this.server.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    }
}

// Create and start the game server
const gameServer = new GameServer();
gameServer.start();