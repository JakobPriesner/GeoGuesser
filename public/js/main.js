// main.js - Main initialization and event binding

// Initialize everything when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    // Initialize variables
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;
    const map = window.MapUtils.map;

    // Store for our countdown intervals
    window.countdownInterval = null;
    window.resultCountdownInterval = null;

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
        resetGame();
        window.UIController.showScreen('welcomeScreen');
    });

    // Map click event - ensure it works for non-countries modes
    map.on('click', (e) => {
        if (gameState.active && !gameState.hasGuessed) {
            // For countries mode, country selection is handled by the country layer click events
            // Only handle click for non-countries modes
            if (gameState.gameMode !== 'countries') {
                // Place temporary marker
                if (gameState.tempMarker) {
                    map.removeLayer(gameState.tempMarker);
                }

                gameState.tempMarker = L.marker(e.latlng, {
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
        if (gameState.gameMode === 'countries') {
            // For countries mode, check if a country is selected
            if (gameState.selectedCountry && !gameState.hasGuessed) {
                if (gameState.multiplayer) {
                    // Mark as guessed first to prevent double submissions
                    gameState.hasGuessed = true;

                    // Submit guess to server for multiplayer
                    // For now, submitting coordinates of the selected country centroid
                    // and the selected country name
                    const bounds = gameState.selectedCountryLayer.getBounds();
                    const center = bounds.getCenter();
                    window.MultiplayerGame.submitGuess(center.lat, center.lng);

                    // Hide confirm buttons
                    elements.confirmBtnContainer.style.display = 'none';
                } else {
                    // Handle single player guess with country
                    window.SinglePlayerGame.handleSinglePlayerGuess(null);
                }
            }
        } else if (gameState.tempMarker && !gameState.hasGuessed) {
            // Standard point-based mode
            const latlng = gameState.tempMarker.getLatLng();

            if (gameState.multiplayer) {
                // Mark as guessed first to prevent double submissions
                gameState.hasGuessed = true;

                // Submit guess to server for multiplayer
                window.MultiplayerGame.submitGuess(latlng.lat, latlng.lng);

                // Hide confirm buttons
                elements.confirmBtnContainer.style.display = 'none';
            } else {
                // Handle single player guess
                window.SinglePlayerGame.handleSinglePlayerGuess(latlng);
            }
        }
    });

    // Welcome screen buttons
    elements.singlePlayerWelcomeBtn.addEventListener('click', () => {
        gameState.multiplayer = false;
        window.UIController.showScreen('modeSelectionScreen');
    });

    elements.createMultiplayerBtn.addEventListener('click', () => {
        gameState.multiplayer = true;
        window.MultiplayerGame.initializeMultiplayer();
        window.UIController.showScreen('createGameScreen');
    });

    elements.joinMultiplayerBtn.addEventListener('click', () => {
        gameState.multiplayer = true;
        window.MultiplayerGame.initializeMultiplayer();
        window.UIController.showScreen('joinGameScreen');
    });

    // Mode selection
    elements.backFromModeBtn.addEventListener('click', () => {
        window.UIController.showScreen('welcomeScreen');
    });

    // Start button for single player
    if (elements.startButton) {
        elements.startButton.addEventListener('click', () => {
            if (!gameState.active) {
                window.SinglePlayerGame.startSinglePlayerGame();
            } else if (gameState.hasGuessed) {
                // Clear any existing countdown before proceeding
                if (window.countdownInterval) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                }

                // Clear any result countdown
                if (window.resultCountdownInterval) {
                    clearInterval(window.resultCountdownInterval);
                    window.resultCountdownInterval = null;
                    elements.resultCountdownElement.style.display = 'none';
                }

                if (gameState.round >= gameState.totalRounds) {
                    window.SinglePlayerGame.endSinglePlayerGame();
                } else {
                    window.SinglePlayerGame.nextSinglePlayerRound();
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

        window.MultiplayerGame.createRoom(username, gameMode, roundDuration, totalRounds, resultDelay);
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

        window.MultiplayerGame.joinRoom(username, roomCode);
    });

    elements.backFromJoinBtn.addEventListener('click', () => {
        window.UIController.showScreen('welcomeScreen');
    });

    // Start game button
    elements.startGameBtn.addEventListener('click', () => {
        window.MultiplayerGame.startGame();
    });

    // Game over modal buttons - Updated for restart/rejoin
    elements.newGameBtn.addEventListener('click', () => {
        elements.gameOverModal.style.display = 'none';

        if (gameState.multiplayer) {
            // Use the new restart/rejoin functionality
            window.MultiplayerGame.restartGame();
        } else {
            window.UIController.showScreen('modeSelectionScreen');
        }
    });

    // Updated back to menu button to also reset the game
    elements.backToMenuBtn.addEventListener('click', () => {
        elements.gameOverModal.style.display = 'none';
        resetGame();
        window.UIController.showScreen('welcomeScreen');
    });

    // Close error modal
    elements.closeErrorBtn.addEventListener('click', () => {
        elements.errorModal.style.display = 'none';
    });

    // Comprehensive reset function
    function resetGame() {
        // Disconnect from socket if in multiplayer mode
        if (window.MultiplayerGame.socket && gameState.roomCode) {
            window.MultiplayerGame.socket.disconnect();
        }

        // Clear any countdown in progress
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }

        // Clear any result countdown
        if (window.resultCountdownInterval) {
            clearInterval(window.resultCountdownInterval);
            window.resultCountdownInterval = null;
            elements.resultCountdownElement.style.display = 'none';
        }

        // Clear the map
        window.MapUtils.clearMap(true);

        // Reset map to default view
        map.setView([30, 0], 2);

        // Reset game state
        window.GameState.resetGameState();

        // Reset UI elements
        window.UIController.resetUI();
    }

    // Fetch game modes from the server
    async function init() {
        try {
            // Fetch game modes
            await window.GameState.fetchGameModes();

            // Log to debug
            console.log("Game modes loaded:", window.GameState.gameModes.length);

            // Populate selectors
            window.UIController.populateGameModeSelectors();

            // Fetch locations for single player
            await window.GameState.fetchLocations();
        } catch (error) {
            console.error("Initialization error:", error);
            window.UIController.showError('Spielinhalte konnten nicht geladen werden. Bitte Seite neu laden.');
        }
    }

    // Start initialization
    init();
});