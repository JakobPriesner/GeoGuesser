// multiplayerGame.js - Multiplayer and socket handling

// Socket connection for multiplayer
let socket = null;

// Initialize multiplayer connection
function initializeMultiplayer() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    if (window.resultCountdownInterval) {
        clearInterval(window.resultCountdownInterval);
        window.resultCountdownInterval = null;
        elements.resultCountdownElement.style.display = 'none';
    }

    if (socket) {
        socket.disconnect();
    }

    socket = io();

    // Socket event handlers for multiplayer
    socket.on('connect', () => {
        console.log('Connected to server');
    });

    socket.on('roomCreated', ({ roomCode, isHost, gameMode, roundDuration, totalRounds }) => {
        gameState.roomCode = roomCode;
        gameState.isHost = isHost;
        gameState.gameMode = gameMode; // Store the game mode

        // Update UI
        elements.roomCodeDisplay.textContent = roomCode;
        elements.waitingRoom.style.display = 'block';
        document.querySelector('.create-game-form').style.display = 'none';

        // Prepare for game
        elements.currentGameModeElement.textContent = window.GameState.modeNames[gameMode];
        elements.currentRoomCodeElement.textContent = roomCode;
        elements.maxRoundsElement.textContent = totalRounds;

        // Update map and ensure outlines are loaded
        window.MapUtils.updateMapLayer(gameMode);

        // Make sure country outlines are visible
        if (window.MapUtils.countryOutlines) {
            window.MapUtils.countryOutlines.bringToBack();
        }
    });

    socket.on('roomJoined', ({ roomCode, isHost, gameMode, roundDuration, totalRounds }) => {
        gameState.roomCode = roomCode;
        gameState.isHost = isHost;
        gameState.gameMode = gameMode; // Store the game mode

        // Update UI
        elements.waitingForHost.style.display = 'block';
        elements.joinForm.style.display = 'none';
        elements.joinErrorMsg.textContent = '';
        elements.joinedPlayerName.textContent = gameState.username;

        // Prepare for game
        elements.currentGameModeElement.textContent = window.GameState.modeNames[gameMode];
        elements.currentRoomCodeElement.textContent = roomCode;
        elements.maxRoundsElement.textContent = totalRounds;

        // Update map and ensure outlines are loaded
        window.MapUtils.updateMapLayer(gameMode);

        // Make sure country outlines are visible
        if (window.MapUtils.countryOutlines) {
            window.MapUtils.countryOutlines.bringToBack();
        }
    });

    socket.on('playerList', ({ players }) => {
        // Update waiting room player list
        if (gameState.isHost) {
            elements.waitingPlayers.innerHTML = '';
            players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                if (player.isHost) {
                    playerItem.classList.add('host');
                }
                playerItem.textContent = player.isHost ? `${player.username} (Host)` : player.username;
                elements.waitingPlayers.appendChild(playerItem);
            });

            // Enable start button if there are at least 2 players
            elements.startGameBtn.disabled = players.length < 2;
            elements.startGameBtn.textContent = players.length < 2
                ? 'Spiel starten (Weitere Spieler benötigt)'
                : 'Spiel starten';
        } else {
            // Update joined players list for non-hosts
            elements.joinedPlayers.innerHTML = '';
            const playersList = document.createElement('div');
            playersList.className = 'waiting-players';

            players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.className = 'player-item';
                if (player.isHost) {
                    playerItem.classList.add('host');
                }
                playerItem.textContent = player.isHost ? `${player.username} (Host)` : player.username;
                playersList.appendChild(playerItem);
            });

            elements.joinedPlayers.appendChild(playersList);
        }

        // If in game, update player status
        if (gameState.active) {
            window.UIController.updatePlayersStatus(players);
        }
    });

    socket.on('newRound', ({ round, totalRounds, location, timeRemaining }) => {
        // Clear any existing result countdown
        if (window.resultCountdownInterval) {
            clearInterval(window.resultCountdownInterval);
            window.resultCountdownInterval = null;
            elements.resultCountdownElement.style.display = 'none';
        }

        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }

        // Prepare for new round - keep outlines by using false parameter
        window.MapUtils.clearMap(false);

        // Store the location in gameState for reference
        gameState.currentLocation = location;

        gameState.active = true;
        gameState.hasGuessed = false;
        gameState.correctCountrySelected = false;  // Reset correct country flag

        // Update UI
        elements.currentRoundElement.textContent = round;
        elements.maxRoundsElement.textContent = totalRounds;
        elements.currentLocationElement.textContent = location.name;
        elements.timerElement.textContent = window.GameState.formatTime(timeRemaining);
        elements.timerElement.style.display = 'inline-block';
        elements.timerElement.style.color = ''; // Reset color
        elements.distanceElement.textContent = '--';
        elements.pointsEarnedElement.textContent = '';
        elements.accuracyTextElement.textContent = '';

        // Update result text based on game mode
        if (gameState.gameMode === 'countries') {
            elements.resultTextElement.textContent = 'Dein Ergebnis:';
        } else {
            elements.resultTextElement.textContent = 'Deine Entfernung zum tatsächlichen Ort:';
        }

        // Show game screen if not already visible
        window.UIController.showScreen('gameScreen');

        // Show/hide relevant elements
        if (elements.playersStatusElement) elements.playersStatusElement.style.display = 'block';
        if (elements.leaderboardElement) document.getElementById('leaderboardContainer').style.display = 'block';
        if (elements.currentRoomCodeElement) elements.currentRoomCodeElement.parentElement.style.display = 'flex';
        if (elements.startButton) elements.startButton.style.display = 'none';

        // Recenter and rezoom map based on game mode
        if (gameState.gameMode && window.GameState.mapSettings[gameState.gameMode]) {
            const setting = window.GameState.mapSettings[gameState.gameMode];
            window.MapUtils.map.setView(setting.center, setting.zoom);
        }

        if (!window.MapUtils.countryOutlines) {
            window.MapUtils.loadCountryOutlines(gameState.gameMode);
        } else {
            window.MapUtils.countryOutlines.bringToBack();
        }
    });

    socket.on('timeUpdate', ({ timeRemaining }) => {
        elements.timerElement.textContent = window.GameState.formatTime(timeRemaining);

        // Highlight timer if less than 10 seconds remaining
        if (timeRemaining <= 10) {
            elements.timerElement.style.color = '#ff4d4d';
        } else {
            elements.timerElement.style.color = '';
        }
    });

    socket.on('playerGuessed', ({ username, hasGuessed }) => {
        // Update player status in UI
        const playerItems = elements.playersStatusElement.querySelectorAll('.player-item');

        playerItems.forEach(item => {
            const nameEl = item.querySelector('span');
            if (nameEl && nameEl.textContent === username) {
                const statusIndicator = item.querySelector('.status-indicator');
                if (statusIndicator) {
                    if (hasGuessed) {
                        statusIndicator.classList.add('guessed');
                        item.querySelector('.player-status').lastChild.textContent = 'Geraten';
                    } else {
                        statusIndicator.classList.remove('guessed');
                        item.querySelector('.player-status').lastChild.textContent = 'Überlegt...';
                    }
                }
            }
        });
    });

    socket.on('guessResult', ({ distance, points, isCorrectCountry }) => {
        // Update player's own distance and points
        gameState.correctCountrySelected = isCorrectCountry;

        if (gameState.gameMode === 'countries' && isCorrectCountry) {
            elements.distanceElement.textContent = 'Richtig!';
            elements.accuracyTextElement.textContent = 'Perfekt! Du hast das richtige Land ausgewählt!';
        } else {
            elements.distanceElement.textContent = `${distance} km`;

            if (gameState.gameMode === 'countries') {
                elements.accuracyTextElement.textContent = `Falsches Land ausgewählt. Das richtige Land war ${gameState.currentLocation.name}.`;
            }
        }

        elements.pointsEarnedElement.textContent = `Du hast ${points} Punkte verdient`;
        gameState.score += points;
        elements.playerScoreElement.textContent = gameState.score;
    });

    // Round ended handling with improved marker display
    socket.on('roundEnded', ({ actualLocation, guesses, leaderboard, resultDelay }) => {
        // Store the actual location coordinates in a variable
        const actualLatLng = L.latLng(actualLocation.lat, actualLocation.lng);

        // Show actual location and all guesses on map
        window.MapUtils.toggleMapDetails(true);

        // Create marker for actual location with improved appearance
        const actualMarker = window.MapUtils.createMarker(
            actualLocation.lat,
            actualLocation.lng,
            '#2e4057',
            actualLocation.name,
            true
        );
        actualMarker.openPopup();

        // For country mode, highlight the correct country
        if (gameState.gameMode === 'countries' && window.MapUtils.countryOutlines) {
            // ... existing country highlighting code ...
        }

        // Create markers for all guesses and lines to actual location
        guesses.forEach(guess => {
            // ... existing marker creation code ...
        });

        // Fit map to show all markers
        const bounds = [];
        // ... existing bounds calculation code ...

        if (bounds.length > 0) {
            window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
        }

        // Update leaderboard
        window.UIController.updateLeaderboard(leaderboard);

        // Make sure outlines are visible and in the background
        if (window.MapUtils.countryOutlines) {
            window.MapUtils.countryOutlines.bringToBack();
        }

        // Clear any existing result countdown
        if (window.resultCountdownInterval) {
            clearInterval(window.resultCountdownInterval);
            window.resultCountdownInterval = null;
        }

        // Show result countdown timer with enhanced display
        if (resultDelay) {
            let countdown = resultDelay;
            elements.resultCountdownElement.textContent = `Nächste Runde in: ${countdown}s`;
            elements.resultCountdownElement.style.display = 'block';

            window.resultCountdownInterval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(window.resultCountdownInterval);
                    window.resultCountdownInterval = null;
                    elements.resultCountdownElement.style.display = 'none';
                } else {
                    elements.resultCountdownElement.textContent = `Nächste Runde in: ${countdown}s`;
                }
            }, 1000);

            // Add timer display support for backward compatibility
            elements.timerElement.style.display = 'inline-block';
            elements.timerElement.textContent = window.GameState.formatTime(countdown);
            elements.timerElement.style.color = '';

            // Set up the timer countdown as well
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }

            window.countdownInterval = setInterval(() => {
                countdown--;
                if (countdown <= 0) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                    elements.timerElement.style.display = 'none';
                    elements.timerElement.style.color = '';
                } else {
                    elements.timerElement.textContent = window.GameState.formatTime(countdown);
                    if (countdown <= 5) {
                        elements.timerElement.style.color = '#ff4d4d';
                    }
                }
            }, 1000);
        }
    });

    socket.on('gameOver', ({ leaderboard }) => {
        // Clear any existing countdown
        if (window.countdownInterval) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
        }

        if (window.resultCountdownInterval) {
            clearInterval(window.resultCountdownInterval);
            window.resultCountdownInterval = null;
            elements.resultCountdownElement.style.display = 'none';
        }

        // Show game over modal
        elements.finalLeaderboard.innerHTML = '';

        const table = document.createElement('table');
        table.className = 'leaderboard';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const rankHeader = document.createElement('th');
        rankHeader.textContent = 'Rang';

        const nameHeader = document.createElement('th');
        nameHeader.textContent = 'Spieler';

        const scoreHeader = document.createElement('th');
        scoreHeader.textContent = 'Punkte';

        headerRow.appendChild(rankHeader);
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(scoreHeader);
        thead.appendChild(headerRow);

        const tbody = document.createElement('tbody');

        leaderboard.forEach((player, index) => {
            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            rankCell.textContent = index + 1;

            const nameCell = document.createElement('td');
            nameCell.textContent = player.username;

            const scoreCell = document.createElement('td');
            scoreCell.textContent = player.score;

            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);

            // Highlight current player
            if (player.username === gameState.username) {
                row.style.fontWeight = 'bold';
            }

            tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);

        elements.finalLeaderboard.appendChild(table);
        elements.gameOverContent.innerHTML = '';
        elements.gameOverContent.appendChild(elements.finalLeaderboard);

        // Update game over buttons based on whether user is host or not
        if (gameState.isHost) {
            elements.newGameBtn.textContent = 'Restart Game';
            elements.newGameBtn.style.display = 'block';
        } else {
            elements.newGameBtn.textContent = 'Rejoin';
            elements.newGameBtn.style.display = 'block';
        }

        elements.gameOverModal.style.display = 'flex';

        // Reset game state
        gameState.active = false;
        gameState.hasGuessed = false;
        gameState.score = 0;
    });

    socket.on('error', ({ message }) => {
        window.UIController.showError(message);
    });
}

// Create Room
function createRoom(username, gameMode, roundDuration, totalRounds, resultDelay) {
    window.GameState.state.username = username;
    window.GameState.state.gameMode = gameMode;

    // Create room on server
    socket.emit('createRoom', {
        username,
        gameMode,
        roundDuration,
        totalRounds,
        resultDelay
    });
}

// Join Room
function joinRoom(username, roomCode) {
    window.GameState.state.username = username;

    // Join room on server
    socket.emit('joinRoom', {
        username,
        roomCode
    });
}

// Restart/Rejoin Game
function restartGame() {
    const gameState = window.GameState.state;

    // Clear any existing countdown
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

    if (gameState.isHost) {
        // For host, restart the game with same settings
        socket.emit('restartGame');
    } else {
        // For non-hosts, attempt to rejoin the same room
        if (gameState.roomCode) {
            joinRoom(gameState.username, gameState.roomCode);
        }
    }
}

// Start Game
function startGame() {
    // Ensure outlines are available before starting the game
    if (!window.MapUtils.countryOutlines && window.GameState.state.gameMode) {
        window.MapUtils.loadCountryOutlines(window.GameState.state.gameMode);
    }
    socket.emit('startGame');
}

// Submit Guess
function submitGuess(lat, lng) {
    if (socket) {
        // For countries mode, also include the selected country name
        if (window.GameState.state.gameMode === 'countries' && window.GameState.state.selectedCountry) {
            // Check if the center of the selected country is within the target country boundaries
            let isWithinTargetCountry = false;

            // Get the center of the selected country
            const selectedBounds = window.GameState.state.selectedCountryLayer.getBounds();
            const selectedCenter = selectedBounds.getCenter();

            // Try to find the target country layer
            const targetCountry = window.GameState.state.currentLocation.name;
            let targetCountryLayer = null;

            if (window.MapUtils.countryOutlines) {
                window.MapUtils.countryOutlines.eachLayer(layer => {
                    const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
                    if (countryName === targetCountry || countryName.toLowerCase() === targetCountry.toLowerCase()) {
                        targetCountryLayer = layer;
                    }
                });
            }

            // Check if the center of the selected country is within the target country's boundaries
            if (targetCountryLayer && targetCountryLayer.getBounds().contains(selectedCenter)) {
                isWithinTargetCountry = true;
            }

            socket.emit('submitGuess', {
                lat: lat,
                lng: lng,
                selectedCountry: window.GameState.state.selectedCountry,
                isWithinTargetCountry: isWithinTargetCountry
            });
        } else {
            // Standard point-based guess
            socket.emit('submitGuess', {
                lat: lat,
                lng: lng
            });
        }
    }
}

// Export multiplayer functions
window.MultiplayerGame = {
    socket,
    initializeMultiplayer,
    createRoom,
    joinRoom,
    startGame,
    submitGuess,
    restartGame
};