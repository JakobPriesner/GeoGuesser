function startSinglePlayerGame() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Clear any existing timer
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    // Clear any existing result countdown
    if (window.resultCountdownInterval) {
        clearInterval(window.resultCountdownInterval);
        window.resultCountdownInterval = null;
        elements.resultCountdownElement.style.display = 'none';
    }

    gameState.active = true;
    gameState.round = 0;
    gameState.score = 0;
    gameState.usedLocations = [];
    gameState.correctCountrySelected = false;

    window.UIController.updateScoreDisplay();

    document.getElementById('leaderboardContainer').style.display = 'block';

    nextSinglePlayerRound();

    elements.startButton.disabled = true;
    setTimeout(() => {
        elements.startButton.textContent = 'Nächster Ort';
        elements.startButton.disabled = false;
    }, 1000);
}

function nextSinglePlayerRound() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Clear any existing timer
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    // Clear any existing result countdown
    if (window.resultCountdownInterval) {
        clearInterval(window.resultCountdownInterval);
        window.resultCountdownInterval = null;
        elements.resultCountdownElement.style.display = 'none';
    }

    // Hide the timer while it's not in use
    elements.timerElement.style.color = '';
    elements.timerElement.style.display = 'none';

    window.MapUtils.clearMap(false);

    if (gameState.round >= gameState.totalRounds) {
        endSinglePlayerGame();
        return;
    }

    gameState.round++;
    elements.currentRoundElement.textContent = gameState.round;

    const randomLocationData = window.GameState.getRandomLocation(gameState.gameMode, gameState.usedLocations);
    if (!randomLocationData) {
        window.UIController.showError('Keine Orte für diesen Spielmodus verfügbar');
        return;
    }

    gameState.usedLocations.push(randomLocationData.index);
    gameState.currentLocation = randomLocationData.location;
    gameState.correctCountrySelected = false;

    elements.currentLocationElement.textContent = gameState.currentLocation.name;
    elements.distanceElement.textContent = '--';
    elements.accuracyTextElement.textContent = '';
    elements.pointsEarnedElement.textContent = '';

    // Update the result text based on game mode
    if (gameState.gameMode === 'countries') {
        elements.resultTextElement.textContent = 'Dein Ergebnis:';
    } else {
        elements.resultTextElement.textContent = 'Deine Entfernung zum tatsächlichen Ort:';
    }

    gameState.guessMarker = null;
    gameState.hasGuessed = false;

    if (gameState.gameMode && window.GameState.mapSettings[gameState.gameMode]) {
        const setting = window.GameState.mapSettings[gameState.gameMode];
        window.MapUtils.map.setView(setting.center, setting.zoom);
    }

    elements.startButton.disabled = true;
    elements.startButton.style.display = 'none';

    window.MapUtils.loadCountryOutlines(gameState.gameMode);

    document.getElementById('leaderboardContainer').style.display = 'block';
}

function showSinglePlayerActualLocation() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Make sure any existing timer is cleared first
    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    // Clear any existing result countdown
    if (window.resultCountdownInterval) {
        clearInterval(window.resultCountdownInterval);
        window.resultCountdownInterval = null;
    }

    window.MapUtils.toggleMapDetails(true);

    if (gameState.gameMode === 'countries') {
        // Find and highlight the correct country
        const targetCountry = gameState.currentLocation.name;
        const actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);
        console.log("Target country:", targetCountry);

        // Find the correct country layer
        if (window.MapUtils.countryOutlines) {
            let targetCountryLayer = null;

            window.MapUtils.countryOutlines.eachLayer(layer => {
                const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
                // Check for exact match as well as case-insensitive match
                if (countryName === targetCountry ||
                    countryName.toLowerCase() === targetCountry.toLowerCase()) {
                    targetCountryLayer = layer;
                    console.log("Found target country layer:", countryName);
                }
            });

            if (targetCountryLayer) {
                // IMPORTANT: Make sure the target country is always highlighted
                // Highlight the correct country in green (always do this regardless of user guess)
                targetCountryLayer.setStyle({
                    fillColor: '#5cb85c',  // Success green
                    fillOpacity: 0.5,
                    weight: 3,
                    color: '#5cb85c'
                });

                // Create actual location marker for reference
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#2e4057',
                    targetCountry,
                    true
                );
                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                gameState.playerMarkers.push(actualMarker);

                // If a country was selected - handle visualization
                if (gameState.selectedCountryLayer) {
                    if (!gameState.correctCountrySelected) {
                        // Wrong country - highlight in red
                        gameState.selectedCountryLayer.setStyle({
                            fillColor: '#d9534f',  // Danger red
                            fillOpacity: 0.3,
                            weight: 2,
                            color: '#d9534f'
                        });

                        // Draw a line from the center of selected country to the actual location
                        const selectedBounds = gameState.selectedCountryLayer.getBounds();
                        const selectedCenter = selectedBounds.getCenter();

                        const polyline = window.MapUtils.drawLine(
                            selectedCenter.lat, selectedCenter.lng,
                            actualLatLng.lat, actualLatLng.lng,
                            '#d9534f'  // red line
                        );
                        gameState.playerMarkers.push(polyline);
                    }
                }

                // Fit map to show both the country and marker
                if (gameState.selectedCountryLayer && !gameState.correctCountrySelected) {
                    const bounds = L.latLngBounds([
                        targetCountryLayer.getBounds(),
                        gameState.selectedCountryLayer.getBounds(),
                        [actualLatLng]
                    ]);
                    window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
                } else {
                    // Make sure we include the marker in the bounds
                    const countryBounds = targetCountryLayer.getBounds();
                    const newBounds = L.latLngBounds([
                        countryBounds.getSouthWest(),
                        countryBounds.getNorthEast(),
                        actualLatLng
                    ]);
                    window.MapUtils.map.fitBounds(newBounds, { padding: [50, 50] });
                }
            } else {
                console.error("Target country layer not found:", targetCountry);

                // Just show the marker at the exact coordinates
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#2e4057',
                    targetCountry,
                    true
                );
                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                gameState.playerMarkers.push(actualMarker);

                if (gameState.selectedCountryLayer && !gameState.correctCountrySelected) {
                    gameState.selectedCountryLayer.setStyle({
                        fillColor: '#d9534f',
                        fillOpacity: 0.3,
                        weight: 2,
                        color: '#d9534f'
                    });

                    const selectedBounds = gameState.selectedCountryLayer.getBounds();

                    const selectedCenter = selectedBounds.getCenter();

                    const polyline = window.MapUtils.drawLine(
                        selectedCenter.lat, selectedCenter.lng,
                        actualLatLng.lat, actualLatLng.lng,
                        '#d9534f'
                    );
                    gameState.playerMarkers.push(polyline);

                    // Zoom to include both
                    const bounds = L.latLngBounds([
                        gameState.selectedCountryLayer.getBounds(),
                        [actualLatLng]
                    ]);
                    window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
                } else {
                    // Just zoom to the marker
                    window.MapUtils.map.setView(actualLatLng, 5);
                }
            }
        }
    } else {
        // Regular point-based display with markers and lines
        const actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);

        const actualMarker = window.MapUtils.createMarker(
            actualLatLng.lat,
            actualLatLng.lng,
            '#2e4057',
            gameState.currentLocation.name,
            true
        );

        gameState.playerMarkers.push(actualMarker);

        // Add location name to the popup
        actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${gameState.currentLocation.name}</strong></div>`).openPopup();

        // Draw line between guess and actual location
        const guessLatLng = gameState.guessMarker.getLatLng();

        const polyline = window.MapUtils.drawLine(
            guessLatLng.lat, guessLatLng.lng,
            actualLatLng.lat, actualLatLng.lng,
            '#2e4057'
        );

        gameState.playerMarkers.push(polyline);

        // Fit map to show both markers with more padding
        const bounds = L.latLngBounds([guessLatLng, actualLatLng]);
        window.MapUtils.map.fitBounds(bounds, { padding: [100, 100] });
    }

    // Show countdown for results view - fresh timer creation
    let resultCountdown = 10; // Default to 10 seconds

    // Show countdown for waiting time
    elements.resultCountdownElement.textContent = `Nächster Ort in: ${resultCountdown}s`;
    elements.resultCountdownElement.style.display = 'block';

    window.resultCountdownInterval = setInterval(() => {
        resultCountdown--;
        elements.resultCountdownElement.textContent = `Nächster Ort in: ${resultCountdown}s`;

        if (resultCountdown <= 0) {
            clearInterval(window.resultCountdownInterval);
            window.resultCountdownInterval = null;
            elements.resultCountdownElement.style.display = 'none';

            // Auto-advance if user hasn't clicked "Next"
            if (gameState.round >= gameState.totalRounds) {
                endSinglePlayerGame();
            } else {
                nextSinglePlayerRound();
            }
        }
    }, 1000);

    // Reset and show timer for backward compatibility
    elements.timerElement.style.color = '';
    elements.timerElement.style.display = 'inline-block';
    elements.timerElement.textContent = window.GameState.formatTime(resultCountdown);

    window.countdownInterval = setInterval(() => {
        resultCountdown--;
        if (resultCountdown <= 0) {
            clearInterval(window.countdownInterval);
            window.countdownInterval = null;
            elements.timerElement.style.display = 'none';
            elements.timerElement.style.color = '';

            // Auto-advance handled by the other timer now
        } else {
            elements.timerElement.textContent = window.GameState.formatTime(resultCountdown);
            if (resultCountdown <= 5) {
                elements.timerElement.style.color = '#ff4d4d';
            }
        }
    }, 1000);
}

function endSinglePlayerGame() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Clear any ongoing countdown
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

    gameState.active = false;

    elements.gameOverContent.innerHTML = `
        <p>Glückwunsch! Deine Endpunktzahl ist: <span id="finalScore">${gameState.score}</span></p>
        <p id="gameOverMessage">${window.UIController.getScoreMessage(gameState.score)}</p>
    `;

    elements.gameOverModal.style.display = 'flex';
}

function handleSinglePlayerGuess(latlng) {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Mark as guessed
    gameState.hasGuessed = true;

    if (gameState.gameMode === 'countries') {
        // For countries mode, we already have the country selected
        // Just hide the confirm button
        elements.confirmBtnContainer.style.display = 'none';
    } else {
        // For point-based modes, place the guess marker
        window.MapUtils.placeSinglePlayerGuessMarker(latlng);

        if (gameState.tempMarker) {
            window.MapUtils.map.removeLayer(gameState.tempMarker);
            gameState.tempMarker = null;
        }

        elements.confirmBtnContainer.style.display = 'none';
    }

    window.ScoreUtils.calculateSinglePlayerScore();

    showSinglePlayerActualLocation();

    elements.startButton.style.display = 'block';
    elements.startButton.disabled = false;

    if (gameState.round >= gameState.totalRounds) {
        elements.startButton.textContent = 'Ergebnisse anzeigen';
    } else {
        elements.startButton.textContent = 'Nächster Ort';
    }
}

window.SinglePlayerGame = {
    startSinglePlayerGame,
    nextSinglePlayerRound,
    showSinglePlayerActualLocation,
    endSinglePlayerGame,
    handleSinglePlayerGuess
};