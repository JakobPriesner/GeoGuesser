// main.js - Application initialization and event binding

// Initialize everything when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Initialize references
    const engine = window.GameEngine;
    const apiService = window.ApiService;
    const elements = window.UIController.elements;
    const map = window.MapUtils.map;

    // Force map to render properly
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    // Add resize handler
    window.addEventListener('resize', () => {
        map.invalidateSize();
        window.MapUtils.fixMapVisibility();
    });

    // Initial call to fix map visibility
    window.MapUtils.fixMapVisibility();

    // Add CSS fixes
    window.MapUtils.addFixedStyles();

    // Set default result delay to 10
    if (elements.resultDelayInput) {
        elements.resultDelayInput.value = '10';
    }

    // ====== EVENT LISTENERS ======

    // Home button - Reset the game
    elements.homeButton.addEventListener('click', () => {
        engine.resetState();
        window.UIController.showScreen('welcomeScreen');
    });

    // Map click event - ensure it works for non-countries modes
    map.on('click', (e) => {
        if (engine.state.active && !engine.state.hasGuessed) {
            // For countries mode, country selection is handled by the country layer click events
            if (engine.state.gameMode !== 'countries') {
                // Place temporary marker
                if (engine.state.tempMarker) {
                    map.removeLayer(engine.state.tempMarker);
                }

                engine.state.tempMarker = L.marker(e.latlng, {
                    icon: L.divIcon({
                        className: 'custom-div-icon',
                        html: `<div style="background-color: #aaa; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(map);

                elements.confirmBtnContainer.style.display = 'flex';
            }
        }
    });

    // Confirm guess button
    elements.confirmGuessBtn.addEventListener('click', () => {
        if (engine.state.gameMode === 'countries') {
            // For countries mode, check if a country is selected
            if (engine.state.selectedCountry && !engine.state.hasGuessed) {
                if (engine.state.multiplayer) {
                    // Mark as guessed first to prevent double submissions
                    engine.state.hasGuessed = true;

                    // Submit guess to server for multiplayer
                    const bounds = engine.state.selectedCountryLayer.getBounds();
                    const center = bounds.getCenter();
                    engine.submitMultiplayerGuess(center.lat, center.lng);

                    // Hide confirm buttons
                    elements.confirmBtnContainer.style.display = 'none';
                } else {
                    // Handle single player guess with country
                    engine.handleSinglePlayerGuess(null);
                }
            }
        } else if (engine.state.tempMarker && !engine.state.hasGuessed) {
            // Standard point-based mode
            const latlng = engine.state.tempMarker.getLatLng();

            if (engine.state.multiplayer) {
                // Mark as guessed first to prevent double submissions
                engine.state.hasGuessed = true;

                // Submit guess to server for multiplayer
                engine.submitMultiplayerGuess(latlng.lat, latlng.lng);

                // Hide confirm buttons
                elements.confirmBtnContainer.style.display = 'none';
            } else {
                // Handle single player guess
                engine.handleSinglePlayerGuess(latlng);
            }
        }
    });

    // Welcome screen buttons
    elements.singlePlayerWelcomeBtn.addEventListener('click', () => {
        engine.state.multiplayer = false;
        window.UIController.showScreen('modeSelectionScreen');
    });

    elements.createMultiplayerBtn.addEventListener('click', () => {
        engine.state.multiplayer = true;
        engine.initializeMultiplayer();
        window.UIController.showScreen('createGameScreen');
    });

    elements.joinMultiplayerBtn.addEventListener('click', () => {
        engine.state.multiplayer = true;
        engine.initializeMultiplayer();
        window.UIController.showScreen('joinGameScreen');
    });

    // Mode selection
    elements.backFromModeBtn.addEventListener('click', () => {
        window.UIController.showScreen('welcomeScreen');
    });

    // Start button for single player
    if (elements.startButton) {
        elements.startButton.addEventListener('click', () => {
            if (!engine.state.active) {
                engine.startSinglePlayerGame();
            } else if (engine.state.hasGuessed) {
                // Clear any existing countdown before proceeding
                engine.clearCountdowns();

                if (engine.state.round >= engine.state.totalRounds) {
                    engine.endSinglePlayerGame();
                } else {
                    engine.nextSinglePlayerRound();
                }
            }
        });
    }

    // Create game form
    elements.createRoomBtn.addEventListener('click', () => {
        const username = elements.hostUsernameInput.value.trim();
        const gameMode = elements.gameModeSelect.value;
        const roundDuration = parseInt(elements.roundDurationInput.value);
        const totalRounds = parseInt(elements.totalRoundsInput.value);
        const resultDelay = parseInt(elements.resultDelayInput.value);

        if (!username) {
            window.UIController.showError('Bitte gib einen Benutzernamen ein');
            return;
        }

        engine.createRoom(username, gameMode, roundDuration, totalRounds, resultDelay);
    });

    elements.backFromCreateGameBtn.addEventListener('click', () => {
        window.UIController.showScreen('welcomeScreen');
    });

    // Join game form
    elements.joinRoomBtn.addEventListener('click', () => {
        const username = elements.joinUsernameInput.value.trim();
        const roomCode = elements.roomCodeInput.value.trim();

        if (!username) {
            elements.joinErrorMsg.textContent = 'Bitte gib einen Benutzernamen ein';
            return;
        }

        if (!roomCode || roomCode.length !== 6) {
            elements.joinErrorMsg.textContent = 'Bitte gib einen gültigen 6-stelligen Code ein';
            return;
        }

        engine.joinRoom(username, roomCode);
    });

    elements.backFromJoinBtn.addEventListener('click', () => {
        window.UIController.showScreen('welcomeScreen');
    });

    // Start game button
    elements.startGameBtn.addEventListener('click', () => {
        engine.startMultiplayerGame();
    });

    // Game over modal buttons - Updated for restart/rejoin
    elements.newGameBtn.addEventListener('click', () => {
        elements.gameOverModal.style.display = 'none';

        if (engine.state.multiplayer) {
            // Use the restart/rejoin functionality
            engine.restartMultiplayerGame();
        } else {
            window.UIController.showScreen('modeSelectionScreen');
        }
    });

    // Back to menu button
    elements.backToMenuBtn.addEventListener('click', () => {
        elements.gameOverModal.style.display = 'none';
        engine.resetState();
        window.UIController.showScreen('welcomeScreen');
    });

    // Close error modal
    elements.closeErrorBtn.addEventListener('click', () => {
        elements.errorModal.style.display = 'none';
    });

    // Initialize the game engine
    async function init() {
        try {
            await engine.initialize();
            console.log("Game initialized successfully");
        } catch (error) {
            console.error("Initialization error:", error);
            window.UIController.showError('Spielinhalte konnten nicht geladen werden. Bitte Seite neu laden.');
        }
    }

    // Start initialization
    init();
});

(function() {
    console.log("Initializing enhanced multiplayer country selection");

    // Make sure MapUtils has the new method by checking if it exists
    if (!window.MapUtils.prepareCountrySelectForMultiplayer) {
        // Add the method if it doesn't exist
        window.MapUtils.prepareCountrySelectForMultiplayer = function() {
            // Make sure outlines are loaded
            if (!this.countryOutlines && window.GameEngine.state.gameMode === 'countries') {
                console.log("Loading country outlines for multiplayer");
                this.loadCountryOutlines('countries')
                    .then(() => {
                        this.makeCountriesClickable();
                    })
                    .catch(err => {
                        console.error("Failed to load country outlines:", err);
                    });
            } else if (this.countryOutlines) {
                // Make sure countries are clickable
                this.makeCountriesClickable();
            }
        };
    }

    // Create a custom event handler for map setup after joining a room
    document.addEventListener('roomJoined', function(e) {
        if (window.GameEngine.state.gameMode === 'countries') {
            console.log("Room joined event detected - preparing map for countries mode");
            window.MapUtils.prepareCountrySelectForMultiplayer();
        }
    });

    // Create a custom event handler for new rounds
    document.addEventListener('newRound', function(e) {
        if (window.GameEngine.state.gameMode === 'countries') {
            console.log("New round event detected - preparing map for countries mode");
            window.MapUtils.prepareCountrySelectForMultiplayer();
        }
    });

    // Enhance the existing socket handlers to trigger our custom events
    const originalSocketOn = window.GameEngine.socket && window.GameEngine.socket.on;
    if (originalSocketOn) {
        window.GameEngine.socket.on = function(event, handler) {
            if (event === 'roomJoined') {
                const enhancedHandler = function(data) {
                    handler(data);
                    document.dispatchEvent(new CustomEvent('roomJoined', { detail: data }));
                };
                originalSocketOn.call(this, event, enhancedHandler);
            }
            else if (event === 'newRound') {
                const enhancedHandler = function(data) {
                    handler(data);
                    document.dispatchEvent(new CustomEvent('newRound', { detail: data }));
                };
                originalSocketOn.call(this, event, enhancedHandler);
            }
            else {
                originalSocketOn.call(this, event, handler);
            }
        };
    }

    console.log("Enhanced multiplayer country selection initialized");
})();