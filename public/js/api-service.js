class ApiService {
    constructor() {
        this.socket = null;

        this.callbacks = {
            onRoomCreated: null,
            onRoomJoined: null,
            onPlayerList: null,
            onNewRound: null,
            onTimeUpdate: null,
            onPlayerGuessed: null,
            onGuessResult: null,
            onRoundEnded: null,
            onGameOver: null,
            onError: null
        };
    }

    /*** REST API Methods ***/

    async fetchGameModes() {
        try {
            const response = await fetch('/api/gamemodes');
            if (!response.ok) {
                throw new Error('Failed to fetch game modes');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching game modes:', error);
            throw error;
        }
    }

    async fetchLocations() {
        try {
            const response = await fetch('/api/locations');
            if (!response.ok) {
                throw new Error('Failed to fetch locations');
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching locations:', error);
            throw error;
        }
    }

    /*** Multiplayer Socket Methods ***/

    initializeSocket() {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io();
        this.setupSocketEventHandlers();

        return this.socket;
    }

    setupSocketEventHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
        });

        this.socket.on('roomCreated', (data) => {
            if (this.callbacks.onRoomCreated) this.callbacks.onRoomCreated(data);
        });

        this.socket.on('roomJoined', (data) => {
            if (this.callbacks.onRoomJoined) this.callbacks.onRoomJoined(data);
        });

        this.socket.on('playerList', (data) => {
            if (this.callbacks.onPlayerList) this.callbacks.onPlayerList(data);
        });

        this.socket.on('newRound', (data) => {
            if (this.callbacks.onNewRound) this.callbacks.onNewRound(data);
        });

        this.socket.on('timeUpdate', (data) => {
            if (this.callbacks.onTimeUpdate) this.callbacks.onTimeUpdate(data);
        });

        this.socket.on('playerGuessed', (data) => {
            if (this.callbacks.onPlayerGuessed) this.callbacks.onPlayerGuessed(data);
        });

        this.socket.on('guessResult', (data) => {
            if (this.callbacks.onGuessResult) this.callbacks.onGuessResult(data);
        });

        this.socket.on('roundEnded', (data) => {
            if (this.callbacks.onRoundEnded) this.callbacks.onRoundEnded(data);
        });

        this.socket.on('gameOver', (data) => {
            if (this.callbacks.onGameOver) this.callbacks.onGameOver(data);
        });

        this.socket.on('error', (data) => {
            if (this.callbacks.onError) this.callbacks.onError(data);
        });
    }

    on(event, callback) {
        if (this.callbacks.hasOwnProperty(event)) {
            // Enhanced callback handling for specific events
            if (event === 'newRound') {
                const enhancedCallback = function(data) {
                    // Call the original callback
                    callback(data);

                    // Additional setup for country mode
                    const engine = window.GameEngine;
                    if (engine.state.gameMode === 'countries') {
                        console.log("Setting up country selection for multiplayer round");
                        window.MapUtils.prepareCountrySelectForMultiplayer();

                        // Reset country selection state
                        engine.state.selectedCountry = null;
                        engine.state.selectedCountryLayer = null;

                        // Make sure outlines are visible and clickable
                        setTimeout(() => {
                            if (window.MapUtils.countryOutlines) {
                                window.MapUtils.countryOutlines.bringToBack();
                                window.MapUtils.makeCountriesClickable();
                            }
                        }, 500); // Short delay to ensure map is ready
                    }
                };
                this.callbacks[event] = enhancedCallback;
            }
            else if (event === 'roomJoined') {
                const enhancedCallback = function(data) {
                    // Call the original callback
                    callback(data);

                    // Additional setup for countries mode
                    if (data.gameMode === 'countries') {
                        console.log("Preparing countries mode for multiplayer");

                        // Load country outlines if needed
                        window.MapUtils.loadCountryOutlines('countries')
                            .then(() => {
                                // Ensure they're clickable
                                window.MapUtils.makeCountriesClickable();
                            })
                            .catch(err => {
                                console.error("Error loading country outlines:", err);
                            });
                    }
                };
                this.callbacks[event] = enhancedCallback;
            }
            else {
                // Standard behavior for other events
                this.callbacks[event] = callback;
            }
        } else {
            console.warn(`Unknown event: ${event}`);
        }
    }

    createRoom(username, gameMode, roundDuration, totalRounds, resultDelay) {
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }

        this.socket.emit('createRoom', {
            username,
            gameMode,
            roundDuration,
            totalRounds,
            resultDelay
        });

        return true;
    }

    joinRoom(username, roomCode) {
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }

        this.socket.emit('joinRoom', {
            username,
            roomCode
        });

        return true;
    }

    startGame() {
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }

        this.socket.emit('startGame');
        return true;
    }

    submitGuess(data) {
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }

        this.socket.emit('submitGuess', data);
        return true;
    }

    restartGame() {
        if (!this.socket) {
            console.error('Socket not initialized');
            return false;
        }

        this.socket.emit('restartGame');
        return true;
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Create and export a single instance
window.ApiService = new ApiService();