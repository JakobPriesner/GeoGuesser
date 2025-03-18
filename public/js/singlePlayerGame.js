// singlePlayerGame.js - Complete updated version

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

    // Initialize player markers array if needed
    if (!gameState.playerMarkers) {
        gameState.playerMarkers = [];
    }

    window.UIController.updateScoreDisplay();

    document.getElementById('leaderboardContainer').style.display = 'block';

    if (!window.MapUtils.countryOutlines && window.GameState.state.gameMode) {
        window.MapUtils.loadCountryOutlines(window.GameState.state.gameMode);
    }

    nextSinglePlayerRound();

    elements.startButton.disabled = true;
    setTimeout(() => {
        elements.startButton.textContent = 'Nächster Ort';
        elements.startButton.disabled = false;
    }, 1000);
}

// Enhanced nextSinglePlayerRound function to ensure proper cleanup
function nextSinglePlayerRound() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    console.log("Starting next round, current round:", gameState.round);

    if (window.countdownInterval) {
        clearInterval(window.countdownInterval);
        window.countdownInterval = null;
    }

    if (window.resultCountdownInterval) {
        clearInterval(window.resultCountdownInterval);
        window.resultCountdownInterval = null;
        elements.resultCountdownElement.style.display = 'none';
    }

    // Hide the timer while it's not in use
    elements.timerElement.style.color = '';
    elements.timerElement.style.display = 'none';

    // Very important: clear the map but keep country outlines visible
    console.log("Clearing map for next round but keeping outlines");
    window.MapUtils.clearMap(false); // Pass false to keep country outlines

    // Double-check that playerMarkers is empty
    if (gameState.playerMarkers && gameState.playerMarkers.length > 0) {
        console.warn("playerMarkers not empty after clearMap, forcing clear");
        gameState.playerMarkers.forEach(marker => {
            try {
                if (marker && marker._map) {
                    window.MapUtils.map.removeLayer(marker);
                }
            } catch (e) {
                console.error("Error removing marker:", e);
            }
        });
        gameState.playerMarkers = [];
    }

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

    elements.resultTextElement.textContent = 'Deine Entfernung zum tatsächlichen Ort:';

    gameState.guessMarker = null;
    gameState.hasGuessed = false;

    if (gameState.gameMode && window.GameState.mapSettings[gameState.gameMode]) {
        const setting = window.GameState.mapSettings[gameState.gameMode];
        window.MapUtils.map.setView(setting.center, setting.zoom);
    }

    elements.startButton.disabled = true;
    elements.startButton.style.display = 'none';

    // Ensure we're loading country outlines in every round
    if (!window.MapUtils.countryOutlines || gameState.gameMode === 'countries') {
        console.log("Loading country outlines for new round");
        window.MapUtils.loadCountryOutlines(gameState.gameMode)
            .then(() => {
                console.log("Country outlines loaded for new round");
                // Ensure outlines are visible after loading
                if (window.MapUtils.countryOutlines) {
                    window.MapUtils.countryOutlines.bringToBack();
                }
            })
            .catch(err => {
                console.error("Failed to load country outlines for new round:", err);
            });
    } else {
        // If outlines exist but might be hidden, make sure they're visible
        if (window.MapUtils.map && window.MapUtils.countryOutlines) {
            if (!window.MapUtils.map.hasLayer(window.MapUtils.countryOutlines)) {
                window.MapUtils.map.addLayer(window.MapUtils.countryOutlines);
            }
            window.MapUtils.countryOutlines.bringToBack();
        }
    }

    document.getElementById('leaderboardContainer').style.display = 'block';
}

async function showSinglePlayerActualLocation() {
    console.log("showSinglePlayerActualLocation");
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Make sure any existing timer is cleared
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

    window.MapUtils.toggleMapDetails(true);

    if (gameState.gameMode === 'countries') {
        // Find and highlight the correct country
        const targetCountry = gameState.currentLocation.name;
        const actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);

        console.log("Target country:", targetCountry);

        try {
            if (!window.MapUtils.countryOutlines) {
                try {
                    await window.MapUtils.loadCountryOutlines(gameState.gameMode);

                    // Double-check that they exist
                    if (!window.MapUtils.countryOutlines) {
                        throw new Error("Country outlines still null after loading");
                    }
                } catch (loadError) {
                    console.error("Error loading country outlines:", loadError);
                    throw loadError;
                }
            }

            // Now find the target country layer with enhanced matching
            let targetCountryLayer = null;
            let matchAttempts = 0;

            // Try different methods to find the country
            // 1. Try using our helper function
            targetCountryLayer = window.MapUtils.findCountryLayerByName(targetCountry);
            if (targetCountryLayer) {
                console.log("Found target country using helper function");
                matchAttempts++;
            }

            // 2. If that didn't work, try manual search with normalized names
            if (!targetCountryLayer) {
                console.log("Helper function did not find country, trying manual search");
                const normalizedTargetName = targetCountry.toLowerCase().trim();

                // Directly check if countryOutlines exists and has the eachLayer method
                if (window.MapUtils.countryOutlines && typeof window.MapUtils.countryOutlines.eachLayer === 'function') {
                    window.MapUtils.countryOutlines.eachLayer(layer => {
                        const adminName = layer.feature.properties.ADMIN || '';
                        const name = layer.feature.properties.NAME || '';
                        const layerCountryName = adminName || name;

                        // Try exact match first
                        if (layerCountryName === targetCountry) {
                            targetCountryLayer = layer;
                            console.log("Found country layer with exact match:", layerCountryName);
                            matchAttempts++;
                            return; // Stop iteration
                        }

                        // Then try case-insensitive match
                        if (layerCountryName.toLowerCase().trim() === normalizedTargetName) {
                            targetCountryLayer = layer;
                            console.log("Found country layer with case-insensitive match:", layerCountryName);
                            matchAttempts++;
                            return; // Stop iteration
                        }
                    });
                } else {
                    console.error("countryOutlines is not properly initialized with eachLayer method");
                    throw new Error("Invalid countryOutlines object");
                }
            }

            // 3. Try partial matches as a last resort
            if (!targetCountryLayer && window.MapUtils.countryOutlines) {
                console.log("Trying partial matches for target country:", targetCountry);
                const normalizedTargetName = targetCountry.toLowerCase().trim();

                window.MapUtils.countryOutlines.eachLayer(layer => {
                    if (targetCountryLayer) return; // Already found

                    const adminName = layer.feature.properties.ADMIN || '';
                    const name = layer.feature.properties.NAME || '';
                    const layerCountryName = adminName || name;

                    // Try partial matching
                    if (layerCountryName.toLowerCase().includes(normalizedTargetName) ||
                        normalizedTargetName.includes(layerCountryName.toLowerCase())) {
                        targetCountryLayer = layer;
                        console.log("Found country layer with partial match:", layerCountryName);
                        matchAttempts++;
                    }
                });
            }

            console.log("Match attempts:", matchAttempts, "Target country found:", !!targetCountryLayer);

            // Ensure we're always working with valid references
            const hasUserGuess = gameState.selectedCountryLayer !== null;
            const hasTargetCountry = targetCountryLayer !== null;

            // Handle the target country (the correct answer)
            if (hasTargetCountry) {
                console.log("Found target country layer:", targetCountry);

                // IMPORTANT: Style the target country in green with improved visibility
                targetCountryLayer.setStyle({
                    fillColor: '#5cb85c',  // Success green
                    fillOpacity: 0.6,
                    weight: 3,
                    color: '#5cb85c'
                });

                // Bring to front to ensure visibility
                targetCountryLayer.bringToFront();

                // Add it to playerMarkers to track it
                gameState.playerMarkers.push(targetCountryLayer);

                // Create marker at exact location
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#5cb85c',  // Match the country's green color
                    targetCountry,
                    true
                );
                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                gameState.playerMarkers.push(actualMarker);
            } else {
                console.error("Failed to find target country layer:", targetCountry);
                // Create placeholder for target country if not found
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#5cb85c',
                    targetCountry,
                    true
                );
                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                gameState.playerMarkers.push(actualMarker);

                // Create a circle to highlight the area
                const highlightCircle = L.circle(actualLatLng, {
                    color: '#5cb85c',
                    fillColor: '#5cb85c',
                    fillOpacity: 0.4,
                    radius: 300000  // 300km radius
                }).addTo(window.MapUtils.map);
                gameState.playerMarkers.push(highlightCircle);
            }

            // Now handle the user's guess (selected country)
            if (hasUserGuess) {
                // Style based on correctness - RED for wrong, GREEN for correct
                if (gameState.correctCountrySelected) {
                    // If correct, style in green to match the target
                    gameState.selectedCountryLayer.setStyle({
                        fillColor: '#5cb85c',  // Success green
                        fillOpacity: 0.6,
                        weight: 3,
                        color: '#5cb85c'
                    });
                } else {
                    // If wrong, style in red
                    gameState.selectedCountryLayer.setStyle({
                        fillColor: '#d9534f',  // Danger red
                        fillOpacity: 0.5,
                        weight: 3,
                        color: '#d9534f'
                    });
                }

                // Bring to front to ensure visibility
                gameState.selectedCountryLayer.bringToFront();

                // CRITICAL: Make sure to add or re-add the styled layer to playerMarkers
                gameState.playerMarkers.push(gameState.selectedCountryLayer);

                // Get the center of the selected country for the line
                const selectedBounds = gameState.selectedCountryLayer.getBounds();
                const selectedCenter = selectedBounds.getCenter();

                // Add a marker at the center of the selected country
                const guessMarkerColor = gameState.correctCountrySelected ? '#5cb85c' : '#d9534f';
                const guessMarkerLabel = gameState.correctCountrySelected ? 'Dein Tipp (Richtig!)' : 'Dein Tipp (Falsch)';

                const guessMarker = window.MapUtils.createMarker(
                    selectedCenter.lat,
                    selectedCenter.lng,
                    guessMarkerColor,
                    guessMarkerLabel,
                    false
                );
                gameState.playerMarkers.push(guessMarker);

                // Draw a line connecting the guess to the actual location
                const polyline = window.MapUtils.drawLine(
                    selectedCenter.lat, selectedCenter.lng,
                    actualLatLng.lat, actualLatLng.lng,
                    guessMarkerColor
                );
                gameState.playerMarkers.push(polyline);
            }

            // Fit the map to show both countries with improved bounds calculation
            if (hasUserGuess && hasTargetCountry) {
                try {
                    // Create bounds that include both countries and the marker
                    const bounds = L.latLngBounds();

                    // Add target country bounds
                    bounds.extend(targetCountryLayer.getBounds());

                    // Add selected country bounds
                    bounds.extend(gameState.selectedCountryLayer.getBounds());

                    // Add actual point
                    bounds.extend(actualLatLng);

                    // Fit with padding
                    window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
                } catch (e) {
                    console.error("Error fitting bounds:", e);
                    // Fallback to just center on the actual location
                    window.MapUtils.map.setView(actualLatLng, 5);
                }
            } else if (hasTargetCountry) {
                // Just show the target country if no user guess
                const countryBounds = targetCountryLayer.getBounds();
                window.MapUtils.map.fitBounds(countryBounds, { padding: [50, 50] });
            } else {
                // If we couldn't find either country, just center on the actual location
                window.MapUtils.map.setView(actualLatLng, 5);
            }

            // Show popup if appropriate
            if (hasTargetCountry && !hasUserGuess) {
                setTimeout(() => {
                    const actualMarkers = gameState.playerMarkers.filter(marker =>
                        marker._latlng &&
                        marker._latlng.lat === actualLatLng.lat &&
                        marker._latlng.lng === actualLatLng.lng
                    );

                    if (actualMarkers.length > 0 && actualMarkers[0].openPopup) {
                        actualMarkers[0].openPopup();
                    }
                }, 100);
            }
        } catch (error) {
            console.error("Error with country outlines:", error);
            handleFallbackDisplay(actualLatLng, targetCountry);
        }
    } else {
        // Handle non-country modes (unchanged)
        const actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);

        const actualMarker = window.MapUtils.createMarker(
            actualLatLng.lat,
            actualLatLng.lng,
            '#5cb85c',  // Green for correct location
            gameState.currentLocation.name,
            true
        );

        gameState.playerMarkers.push(actualMarker);

        // Add location name to the popup
        actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${gameState.currentLocation.name}</strong></div>`, {autoClose: false}).openPopup();

        // Draw line between guess and actual location
        if (gameState.guessMarker) {
            const guessLatLng = gameState.guessMarker.getLatLng();

            // Determine if guess was close enough (within 50km for example)
            const distance = guessLatLng.distanceTo(actualLatLng);
            const isCloseEnough = distance < 50000; // 50km threshold

            // Create new colored marker based on accuracy
            const markerColor = isCloseEnough ? '#5cb85c' : '#d9534f'; // Green if close, red if far
            const guessMarkerColored = window.MapUtils.createMarker(
                guessLatLng.lat,
                guessLatLng.lng,
                markerColor,
                isCloseEnough ? 'Dein Tipp (Nah dran!)' : 'Dein Tipp',
                false
            );
            gameState.playerMarkers.push(guessMarkerColored);

            const polyline = window.MapUtils.drawLine(
                guessLatLng.lat, guessLatLng.lng,
                actualLatLng.lat, actualLatLng.lng,
                markerColor
            );
            gameState.playerMarkers.push(polyline);

            // Fit map to show both markers with more padding
            const bounds = L.latLngBounds([guessLatLng, actualLatLng]);
            window.MapUtils.map.fitBounds(bounds, { padding: [100, 100] });
        }
    }

    // Remove the automatic countdown - user must click the "Next" button
    elements.resultCountdownElement.style.display = 'none';
    elements.timerElement.style.display = 'none';

    // Show the start button for manual navigation
    elements.startButton.style.display = 'block';
    elements.startButton.disabled = false;

    if (gameState.round >= gameState.totalRounds) {
        elements.startButton.textContent = 'Ergebnisse anzeigen';
    } else {
        elements.startButton.textContent = 'Nächster Ort';
    }
}

// Even more robust fallback display
function handleFallbackDisplay(actualLatLng, targetCountry) {
    console.log("Using fallback display for:", targetCountry);
    const gameState = window.GameState.state;

    // Create a circle to highlight the area if country layer not found
    const highlightCircle = L.circle(actualLatLng, {
        color: '#5cb85c',
        fillColor: '#5cb85c',
        fillOpacity: 0.4,
        radius: 300000  // 300km radius for better visibility
    }).addTo(window.MapUtils.map);

    // Make sure to add circle to player markers
    gameState.playerMarkers.push(highlightCircle);

    // Show the marker at the exact coordinates with a more prominent style
    const actualMarker = window.MapUtils.createMarker(
        actualLatLng.lat,
        actualLatLng.lng,
        '#5cb85c',  // Use green to indicate correct location
        targetCountry,
        true
    );
    actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
    gameState.playerMarkers.push(actualMarker);

    if (gameState.selectedCountryLayer) {
        // Style based on correctness
        if (gameState.correctCountrySelected) {
            // Keep it green for correct selection
            gameState.selectedCountryLayer.setStyle({
                fillColor: '#5cb85c',
                fillOpacity: 0.6,
                weight: 3,
                color: '#5cb85c'
            });

            // Add styled layer to playerMarkers
            gameState.playerMarkers.push(gameState.selectedCountryLayer);

            // Add a green marker for the user's guess
            const selectedBounds = gameState.selectedCountryLayer.getBounds();
            const selectedCenter = selectedBounds.getCenter();

            const guessMarker = window.MapUtils.createMarker(
                selectedCenter.lat,
                selectedCenter.lng,
                '#5cb85c',  // Green for correct
                'Dein Tipp (Richtig!)',
                false
            );
            gameState.playerMarkers.push(guessMarker);
        } else {
            // Red for incorrect selection
            gameState.selectedCountryLayer.setStyle({
                fillColor: '#d9534f',
                fillOpacity: 0.3,
                weight: 2,
                color: '#d9534f'
            });

            // Add styled layer to playerMarkers
            gameState.playerMarkers.push(gameState.selectedCountryLayer);

            // Add a red marker for the user's guess
            const selectedBounds = gameState.selectedCountryLayer.getBounds();
            const selectedCenter = selectedBounds.getCenter();

            const guessMarker = window.MapUtils.createMarker(
                selectedCenter.lat,
                selectedCenter.lng,
                '#d9534f',  // Red for incorrect
                'Dein Tipp (Falsch)',
                false
            );
            gameState.playerMarkers.push(guessMarker);
        }

        const selectedBounds = gameState.selectedCountryLayer.getBounds();
        const selectedCenter = selectedBounds.getCenter();

        // Draw line with color based on correctness
        const lineColor = gameState.correctCountrySelected ? '#5cb85c' : '#d9534f';
        const polyline = window.MapUtils.drawLine(
            selectedCenter.lat, selectedCenter.lng,
            actualLatLng.lat, actualLatLng.lng,
            lineColor
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

// Fixed handleSinglePlayerGuess function to properly preserve the user's selected country
function handleSinglePlayerGuess(latlng) {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    // Mark as guessed
    gameState.hasGuessed = true;

    if (gameState.gameMode === 'countries') {
        // For countries mode, we already have the country selected
        // Just hide the confirm button
        elements.confirmBtnContainer.style.display = 'none';

        if (gameState.selectedCountryLayer) {
            // Keep track of the original style before any result marking
            gameState.originalSelectedCountryStyle = {
                fillColor: '#ef8354',  // Original selection color
                fillOpacity: 0.4,
                weight: 3,
                color: '#ef8354'
            };
        }
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

    // Call the async function to show the result
    showSinglePlayerActualLocation().catch(error => {
        console.error("Error showing actual location:", error);
    });
}

window.SinglePlayerGame = {
    startSinglePlayerGame,
    nextSinglePlayerRound,
    showSinglePlayerActualLocation,
    endSinglePlayerGame,
    handleSinglePlayerGuess
};