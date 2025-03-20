// game-engine.js - Unified game engine for both single and multiplayer modes

class GameEngine {
    constructor() {
        // Core game state
        this.state = {
            active: false,
            multiplayer: false,
            isHost: false,
            roomCode: null,
            username: null,
            tempMarker: null,
            guessMarker: null,
            hasGuessed: false,
            showingResults: false,
            score: 0,
            round: 0,
            totalRounds: 10,
            currentLocation: null,
            usedLocations: [],
            playerMarkers: [],
            gameMode: null,
            selectedCountry: null,
            selectedCountryLayer: null,
            correctCountrySelected: false
        };

        // Game settings by mode
        this.mapSettings = {
            'german-cities': { center: [51.1657, 10.4515], zoom: 6 },
            'european-cities': { center: [48.0000, 15.0000], zoom: 4 },
            'countries': { center: [30, 0], zoom: 2 },
            'capitals': { center: [30, 0], zoom: 2 },
            'world-landmarks': { center: [30, 0], zoom: 2 }
        };

        // Available game modes and locations
        this.gameModes = [];
        this.modeNames = {};
        this.locations = null;

        // Timer references
        this.countdownInterval = null;
        this.resultCountdownInterval = null;

        // Socket for multiplayer
        this.socket = null;
    }

    // Initialize the game engine
    async initialize() {
        try {
            // Fetch game modes and locations
            await this.fetchGameModes();
            await this.fetchLocations();

            // Populate UI with available game modes
            window.UIController.populateGameModeSelectors();

            console.log("Game engine initialized with", this.gameModes.length, "game modes");
            return true;
        } catch (error) {
            console.error("Game engine initialization error:", error);
            window.UIController.showError('Spielinhalte konnten nicht geladen werden. Bitte Seite neu laden.');
            return false;
        }
    }

    // Reset the game state
    resetState() {
        // Clean up any ongoing processes
        this.clearCountdowns();

        if (this.socket && this.state.roomCode) {
            this.socket.disconnect();
            this.socket = null;
        }

        // Clear the map
        window.MapUtils.clearMap(true);

        // Reset map to default view
        window.MapUtils.map.setView([30, 0], 2);

        // Reset state properties
        Object.assign(this.state, {
            active: false,
            multiplayer: false,
            isHost: false,
            roomCode: null,
            hasGuessed: false,
            showingResults: false,
            score: 0,
            round: 0,
            usedLocations: [],
            username: null,
            gameMode: null,
            tempMarker: null,
            guessMarker: null,
            playerMarkers: [],
            selectedCountry: null,
            selectedCountryLayer: null,
            correctCountrySelected: false
        });

        // Reset UI
        window.UIController.resetUI();
    }

    // Clear any running timers
    clearCountdowns() {
        const elements = window.UIController.elements;

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
            this.countdownInterval = null;
        }

        if (this.resultCountdownInterval) {
            clearInterval(this.resultCountdownInterval);
            this.resultCountdownInterval = null;
            elements.resultCountdownElement.style.display = 'none';
        }
    }

    // Format time for display (mm:ss)
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // Calculate distance between coordinates in km
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
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

    /*** API METHODS ***/

    // Fetch available game modes
    async fetchGameModes() {
        try {
            const response = await fetch('/api/gamemodes');
            if (!response.ok) throw new Error('Failed to fetch game modes');

            this.gameModes = await response.json();

            // Create name lookup object
            this.modeNames = {};
            this.gameModes.forEach(mode => {
                this.modeNames[mode.id] = mode.name;
            });

            return this.gameModes;
        } catch (error) {
            console.error('Error fetching game modes:', error);
            throw error;
        }
    }

    // Fetch locations for single player mode
    async fetchLocations() {
        try {
            const response = await fetch('/api/locations');
            if (!response.ok) throw new Error('Failed to fetch locations');

            this.locations = await response.json();
            return this.locations;
        } catch (error) {
            console.error('Error fetching locations:', error);
            throw error;
        }
    }

    // Get a random location for single player mode
    getRandomLocation(gameMode, usedLocations) {
        if (!this.locations || !this.locations[gameMode]) return null;

        const locations = this.locations[gameMode];
        let availableLocations = [];

        for (let i = 0; i < locations.length; i++) {
            if (!usedLocations.includes(i)) {
                availableLocations.push({
                    location: locations[i],
                    index: i
                });
            }
        }

        // If all locations have been used or no locations available, reset
        if (availableLocations.length === 0) {
            if (locations.length === 0) return null;
            const randomIndex = Math.floor(Math.random() * locations.length);
            return {
                location: locations[randomIndex],
                index: randomIndex
            };
        }

        // Pick a random location from available ones
        const randomIndex = Math.floor(Math.random() * availableLocations.length);
        return availableLocations[randomIndex];
    }

    /*** SINGLE PLAYER METHODS ***/

    // Start a new single player game
    startSinglePlayerGame() {
        const elements = window.UIController.elements;
        console.log("Starting single player game, mode:", this.state.gameMode);

        // Clear any existing timers
        this.clearCountdowns();

        // Initialize game state
        this.state.active = true;
        this.state.multiplayer = false;
        this.state.round = 0;
        this.state.score = 0;
        this.state.usedLocations = [];
        this.state.correctCountrySelected = false;
        this.state.playerMarkers = [];

        // Update UI
        window.UIController.updateScoreDisplay();
        document.getElementById('leaderboardContainer').style.display = 'block';

        // For German cities mode, we need special handling to preserve the Germany outline
        if (this.state.gameMode === 'german-cities') {
            // Store reference to current outlines before clearing anything
            const currentOutlines = window.MapUtils.countryOutlines;

            // Clear only markers, not outlines
            window.MapUtils.clearMarkersOnly();

            // Ensure the outline is still visible
            if (currentOutlines) {
                console.log("Preserving Germany outline");
                if (!window.MapUtils.map.hasLayer(currentOutlines)) {
                    window.MapUtils.map.addLayer(currentOutlines);
                }
                currentOutlines.bringToBack();
            } else {
                // If no outlines exist yet, load them
                console.log("Loading Germany outline");
                window.MapUtils.loadCountryOutlines(this.state.gameMode);
            }
        } else {
            // For other modes, regular behavior
            if (!window.MapUtils.countryOutlines && this.state.gameMode) {
                window.MapUtils.loadCountryOutlines(this.state.gameMode);
            }
        }

        // Start first round
        this.nextSinglePlayerRound();

        // Update button state
        elements.startButton.disabled = true;
        setTimeout(() => {
            elements.startButton.textContent = 'Nächster Ort';
            elements.startButton.disabled = false;
        }, 1000);
    }

    // Advance to next round in single player
    nextSinglePlayerRound() {
        const elements = window.UIController.elements;

        console.log("Starting next round, current round:", this.state.round);

        // Clear any existing countdowns
        this.clearCountdowns();

        // Hide the timer when not in use
        elements.timerElement.style.color = '';
        elements.timerElement.style.display = 'none';

        // Clear the map but keep country outlines
        window.MapUtils.clearMap(false);

        // Clean up player markers
        if (this.state.playerMarkers && this.state.playerMarkers.length > 0) {
            this.state.playerMarkers.forEach(marker => {
                try {
                    if (marker && marker._map) {
                        window.MapUtils.map.removeLayer(marker);
                    }
                } catch (e) {
                    console.error("Error removing marker:", e);
                }
            });
            this.state.playerMarkers = [];
        }

        // Check if game is over
        if (this.state.round >= this.state.totalRounds) {
            this.endSinglePlayerGame();
            return;
        }

        // Increment round
        this.state.round++;
        elements.currentRoundElement.textContent = this.state.round;

        // Get a new random location
        const randomLocationData = this.getRandomLocation(this.state.gameMode, this.state.usedLocations);
        if (!randomLocationData) {
            window.UIController.showError('Keine Orte für diesen Spielmodus verfügbar');
            return;
        }

        // Store location data
        this.state.usedLocations.push(randomLocationData.index);
        this.state.currentLocation = randomLocationData.location;
        this.state.correctCountrySelected = false;

        // Update UI
        elements.currentLocationElement.textContent = this.state.currentLocation.name;
        elements.distanceElement.textContent = '--';
        elements.accuracyTextElement.textContent = '';
        elements.pointsEarnedElement.textContent = '';
        elements.resultTextElement.textContent = 'Deine Entfernung zum tatsächlichen Ort:';

        // Reset guess state
        this.state.guessMarker = null;
        this.state.hasGuessed = false;

        // Set map view based on game mode
        if (this.state.gameMode && this.mapSettings[this.state.gameMode]) {
            const setting = this.mapSettings[this.state.gameMode];
            window.MapUtils.map.setView(setting.center, setting.zoom);
        }

        // Update button state
        elements.startButton.disabled = true;
        elements.startButton.style.display = 'none';

        // Ensure country outlines are loaded
        if (!window.MapUtils.countryOutlines || this.state.gameMode === 'countries') {
            window.MapUtils.loadCountryOutlines(this.state.gameMode)
                .then(() => {
                    if (window.MapUtils.countryOutlines) {
                        window.MapUtils.countryOutlines.bringToBack();
                    }
                })
                .catch(err => {
                    console.error("Failed to load country outlines:", err);
                });
        } else if (window.MapUtils.map && window.MapUtils.countryOutlines) {
            // Make sure outlines are visible
            if (!window.MapUtils.map.hasLayer(window.MapUtils.countryOutlines)) {
                window.MapUtils.map.addLayer(window.MapUtils.countryOutlines);
            }
            window.MapUtils.countryOutlines.bringToBack();
        }

        // Show leaderboard container
        document.getElementById('leaderboardContainer').style.display = 'block';
    }

    // Handle player guess in single player mode
    handleSinglePlayerGuess(latlng) {
        const elements = window.UIController.elements;

        // Mark as guessed
        this.state.hasGuessed = true;

        if (this.state.gameMode === 'countries') {
            // For countries mode, we already have the country selected
            elements.confirmBtnContainer.style.display = 'none';

            if (this.state.selectedCountryLayer) {
                // Save original style for reference
                this.state.originalSelectedCountryStyle = {
                    fillColor: '#ef8354',
                    fillOpacity: 0.4,
                    weight: 3,
                    color: '#ef8354'
                };
            }
        } else {
            // For point-based modes, place the guess marker
            window.MapUtils.placeSinglePlayerGuessMarker(latlng);

            if (this.state.tempMarker) {
                window.MapUtils.map.removeLayer(this.state.tempMarker);
                this.state.tempMarker = null;
            }

            elements.confirmBtnContainer.style.display = 'none';
        }

        // Calculate score and show results
        this.calculateSinglePlayerScore();
        this.showSinglePlayerActualLocation();
    }

    // Calculate score for single player
    calculateSinglePlayerScore() {
        const elements = window.UIController.elements;

        let distance = 0;
        let score = 0;
        let accuracyText = '';

        if (this.state.gameMode === 'countries') {
            // For countries mode, check if selected country matches target
            const targetCountry = this.state.currentLocation.name;
            const targetCountryEnglish = this.state.currentLocation.english_name || targetCountry;
            const selectedCountry = this.state.selectedCountry;

            if (selectedCountry) {
                // Match using English name with our stored English translation
                this.state.correctCountrySelected =
                    selectedCountry === targetCountryEnglish ||
                    selectedCountry.toLowerCase() === targetCountryEnglish.toLowerCase();

                if (this.state.correctCountrySelected) {
                    score = 1000; // Full points for correct country
                    accuracyText = 'Perfekt! 🎯';
                    distance = 0;
                } else {
                    // Calculate distance between selected country center and target
                    if (this.state.selectedCountryLayer) {
                        const selectedBounds = this.state.selectedCountryLayer.getBounds();
                        const selectedCenter = selectedBounds.getCenter();
                        const targetLatLng = L.latLng(this.state.currentLocation.lat, this.state.currentLocation.lng);

                        distance = Math.round(selectedCenter.distanceTo(targetLatLng) / 1000); // km

                        // Score based on distance - closer = more points
                        score = Math.max(0, Math.round(1000 - (distance / 20)));
                        accuracyText = 'Falsch! Das war ' + distance + ' km entfernt.';
                    } else {
                        score = 0;
                        distance = '?';
                        accuracyText = 'Falsch!';
                    }
                }
            } else {
                // No country selected
                score = 0;
                distance = '--';
                accuracyText = 'Keine Auswahl getroffen!';
            }
        } else {
            // Standard point-based modes with distance calculation
            const actualLatLng = L.latLng(this.state.currentLocation.lat, this.state.currentLocation.lng);
            const guessLatLng = this.state.guessMarker ? this.state.guessMarker.getLatLng() : null;

            if (guessLatLng) {
                distance = Math.round(guessLatLng.distanceTo(actualLatLng) / 1000); // km

                // Score calculation - farther = fewer points
                if (distance < 1) {
                    score = 1000; // Perfect or very close
                    accuracyText = 'Perfekt! 🎯';
                } else if (distance < 5) {
                    score = 900;
                    accuracyText = 'Ausgezeichnet! 🏆';
                } else if (distance < 15) {
                    score = 800;
                    accuracyText = 'Sehr gut! 👏';
                } else if (distance < 50) {
                    score = 650;
                    accuracyText = 'Gut! 👍';
                } else if (distance < 200) {
                    score = 500;
                    accuracyText = 'Nicht schlecht! 🙂';
                } else if (distance < 500) {
                    score = 250;
                    accuracyText = 'Du kannst das besser! 🤔';
                } else if (distance < 1000) {
                    score = 100;
                    accuracyText = 'Weit daneben! 😕';
                } else {
                    // Fix the scoring for very distant guesses
                    score = Math.max(0, Math.min(50, Math.round(100 - (distance / 500))));
                    accuracyText = 'Sehr weit daneben! 😢';
                }
            } else {
                // No guess made
                score = 0;
                distance = '--';
                accuracyText = 'Keine Schätzung abgegeben!';
            }
        }

        // Update UI
        elements.distanceElement.textContent = typeof distance === 'number' ?
            `${distance} km` : distance;
        elements.accuracyTextElement.textContent = accuracyText;
        elements.pointsEarnedElement.textContent =
            score > 0 ? `+${score} Punkte` : '0 Punkte';

        // Update game state
        this.state.score += score;
        window.UIController.updateScoreDisplay();

        console.log("Score calculation complete:", score, "points, total:", this.state.score);

        return score;
    }

    // Show the actual location after a guess
    async showSinglePlayerActualLocation() {
        console.log("showSinglePlayerActualLocation");
        const elements = window.UIController.elements;

        // Clear any existing countdowns
        this.clearCountdowns();

        // Show map details (labels)
        window.MapUtils.toggleMapDetails(true);

        // Handle display based on game mode
        if (this.state.gameMode === 'countries') {
            // Logic for countries mode - highlighting correct country
            await this.showCountryModeResult();
        } else {
            // Logic for point-based modes
            this.showPointModeResult();
        }

        // Remove the automatic countdown - user must click the "Next" button
        elements.resultCountdownElement.style.display = 'none';
        elements.timerElement.style.display = 'none';

        // Show the start button for manual navigation
        elements.startButton.style.display = 'block';
        elements.startButton.disabled = false;

        if (this.state.round >= this.state.totalRounds) {
            elements.startButton.textContent = 'Ergebnisse anzeigen';
        } else {
            elements.startButton.textContent = 'Nächster Ort';
        }
    }

    // Show result for countries mode
    async showCountryModeResult() {
        const targetCountry = this.state.currentLocation.name;
        const actualLatLng = L.latLng(this.state.currentLocation.lat, this.state.currentLocation.lng);

        try {
            if (!window.MapUtils.countryOutlines) {
                await window.MapUtils.loadCountryOutlines(this.state.gameMode);
            }

            // Find target country layer
            let targetCountryLayer = window.MapUtils.findCountryLayerByName(targetCountry);

            // Handle user's selected country and target country visualization
            const hasUserGuess = this.state.selectedCountryLayer !== null;
            const hasTargetCountry = targetCountryLayer !== null;

            // Highlight the target (correct) country
            if (hasTargetCountry) {
                targetCountryLayer.setStyle({
                    fillColor: '#5cb85c',  // Success green
                    fillOpacity: 0.6,
                    weight: 3,
                    color: '#5cb85c'
                });

                targetCountryLayer.bringToFront();
                this.state.playerMarkers.push(targetCountryLayer);

                // Create marker at exact location
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#5cb85c',
                    targetCountry,
                    true
                );

                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                this.state.playerMarkers.push(actualMarker);
            } else {
                // Fallback if target country not found
                const actualMarker = window.MapUtils.createMarker(
                    actualLatLng.lat,
                    actualLatLng.lng,
                    '#5cb85c',
                    targetCountry,
                    true
                );

                actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
                this.state.playerMarkers.push(actualMarker);

                // Create a circle to highlight the area
                const highlightCircle = L.circle(actualLatLng, {
                    color: '#5cb85c',
                    fillColor: '#5cb85c',
                    fillOpacity: 0.4,
                    radius: 300000  // 300km radius
                }).addTo(window.MapUtils.map);

                this.state.playerMarkers.push(highlightCircle);
            }

            // Handle user's guess
            if (hasUserGuess) {
                // Style based on correctness
                const style = this.state.correctCountrySelected ?
                    { fillColor: '#5cb85c', fillOpacity: 0.6, weight: 3, color: '#5cb85c' } : // Correct - green
                    { fillColor: '#d9534f', fillOpacity: 0.5, weight: 3, color: '#d9534f' };  // Wrong - red

                this.state.selectedCountryLayer.setStyle(style);
                this.state.selectedCountryLayer.bringToFront();
                this.state.playerMarkers.push(this.state.selectedCountryLayer);

                // Get center of selected country for line drawing
                const selectedBounds = this.state.selectedCountryLayer.getBounds();
                const selectedCenter = selectedBounds.getCenter();

                // Create marker for user's guess
                const guessMarkerColor = this.state.correctCountrySelected ? '#5cb85c' : '#d9534f';
                const guessMarkerLabel = this.state.correctCountrySelected ? 'Dein Tipp (Richtig!)' : 'Dein Tipp (Falsch)';

                const guessMarker = window.MapUtils.createMarker(
                    selectedCenter.lat,
                    selectedCenter.lng,
                    guessMarkerColor,
                    guessMarkerLabel,
                    false
                );

                this.state.playerMarkers.push(guessMarker);

                // Draw line connecting guess to actual location
                const polyline = window.MapUtils.drawLine(
                    selectedCenter.lat, selectedCenter.lng,
                    actualLatLng.lat, actualLatLng.lng,
                    guessMarkerColor
                );

                this.state.playerMarkers.push(polyline);
            }

            // Fit map to show both countries
            if (hasUserGuess && hasTargetCountry) {
                try {
                    const bounds = L.latLngBounds();
                    bounds.extend(targetCountryLayer.getBounds());
                    bounds.extend(this.state.selectedCountryLayer.getBounds());
                    bounds.extend(actualLatLng);

                    window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
                } catch (e) {
                    console.error("Error fitting bounds:", e);
                    window.MapUtils.map.setView(actualLatLng, 5);
                }
            } else if (hasTargetCountry) {
                // Just show target country if no user guess
                window.MapUtils.map.fitBounds(targetCountryLayer.getBounds(), { padding: [50, 50] });
            } else {
                // Fallback to centering on actual location
                window.MapUtils.map.setView(actualLatLng, 5);
            }

        } catch (error) {
            console.error("Error with country outlines:", error);
            this.handleFallbackDisplay(actualLatLng, targetCountry);
        }
    }

    // Show result for point-based modes
    showPointModeResult() {
        const actualLatLng = L.latLng(this.state.currentLocation.lat, this.state.currentLocation.lng);

        // Create marker for actual location
        const actualMarker = window.MapUtils.createMarker(
            actualLatLng.lat,
            actualLatLng.lng,
            '#5cb85c',  // Green for correct location
            this.state.currentLocation.name,
            true
        );

        this.state.playerMarkers.push(actualMarker);

        // Add location name to the popup
        actualMarker.bindPopup(
            `<div class="popup-content">🎯 <strong>${this.state.currentLocation.name}</strong></div>`,
            {autoClose: false}
        ).openPopup();

        // Draw line between guess and actual location
        if (this.state.guessMarker) {
            const guessLatLng = this.state.guessMarker.getLatLng();

            // Determine if guess was close enough
            const distance = guessLatLng.distanceTo(actualLatLng);
            const isCloseEnough = distance < 50000; // 50km threshold

            // Create colored marker based on accuracy
            const markerColor = isCloseEnough ? '#5cb85c' : '#d9534f';
            const guessMarkerColored = window.MapUtils.createMarker(
                guessLatLng.lat,
                guessLatLng.lng,
                markerColor,
                isCloseEnough ? 'Dein Tipp (Nah dran!)' : 'Dein Tipp',
                false
            );

            this.state.playerMarkers.push(guessMarkerColored);

            // Draw line connecting points
            const polyline = window.MapUtils.drawLine(
                guessLatLng.lat, guessLatLng.lng,
                actualLatLng.lat, actualLatLng.lng,
                markerColor
            );

            this.state.playerMarkers.push(polyline);

            // Fit map to show both markers
            const bounds = L.latLngBounds([guessLatLng, actualLatLng]);
            window.MapUtils.map.fitBounds(bounds, { padding: [100, 100] });
        }
    }

    // Fallback display if normal display fails
    handleFallbackDisplay(actualLatLng, targetCountry) {
        console.log("Using fallback display for:", targetCountry);

        // Create a circle to highlight the area
        const highlightCircle = L.circle(actualLatLng, {
            color: '#5cb85c',
            fillColor: '#5cb85c',
            fillOpacity: 0.4,
            radius: 300000  // 300km radius
        }).addTo(window.MapUtils.map);

        this.state.playerMarkers.push(highlightCircle);

        // Show marker at exact coordinates
        const actualMarker = window.MapUtils.createMarker(
            actualLatLng.lat,
            actualLatLng.lng,
            '#5cb85c',
            targetCountry,
            true
        );

        actualMarker.bindPopup(`<div class="popup-content">🎯 <strong>${targetCountry}</strong></div>`).openPopup();
        this.state.playerMarkers.push(actualMarker);

        if (this.state.selectedCountryLayer) {
            // Style based on correctness
            if (this.state.correctCountrySelected) {
                this.state.selectedCountryLayer.setStyle({
                    fillColor: '#5cb85c',
                    fillOpacity: 0.6,
                    weight: 3,
                    color: '#5cb85c'
                });
            } else {
                this.state.selectedCountryLayer.setStyle({
                    fillColor: '#d9534f',
                    fillOpacity: 0.3,
                    weight: 2,
                    color: '#d9534f'
                });
            }

            this.state.playerMarkers.push(this.state.selectedCountryLayer);

            // Add marker for user's guess
            const selectedBounds = this.state.selectedCountryLayer.getBounds();
            const selectedCenter = selectedBounds.getCenter();

            const guessMarker = window.MapUtils.createMarker(
                selectedCenter.lat,
                selectedCenter.lng,
                this.state.correctCountrySelected ? '#5cb85c' : '#d9534f',
                this.state.correctCountrySelected ? 'Dein Tipp (Richtig!)' : 'Dein Tipp (Falsch)',
                false
            );

            this.state.playerMarkers.push(guessMarker);

            // Draw connecting line
            const lineColor = this.state.correctCountrySelected ? '#5cb85c' : '#d9534f';
            const polyline = window.MapUtils.drawLine(
                selectedCenter.lat, selectedCenter.lng,
                actualLatLng.lat, actualLatLng.lng,
                lineColor
            );

            this.state.playerMarkers.push(polyline);

            // Fit bounds to include both
            const bounds = L.latLngBounds([
                this.state.selectedCountryLayer.getBounds(),
                [actualLatLng]
            ]);

            window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            // Just zoom to the marker
            window.MapUtils.map.setView(actualLatLng, 5);
        }
    }

    // End single player game
    endSinglePlayerGame() {
        const elements = window.UIController.elements;

        // Clear any ongoing countdowns
        this.clearCountdowns();

        this.state.active = false;

        // Show game over summary
        elements.gameOverContent.innerHTML = `
      <p>Glückwunsch! Deine Endpunktzahl ist: <span id="finalScore">${this.state.score}</span></p>
      <p id="gameOverMessage">${window.UIController.getScoreMessage(this.state.score)}</p>
    `;

        elements.gameOverModal.style.display = 'flex';
    }

    /*** MULTIPLAYER METHODS ***/

    // Initialize multiplayer connection
    initializeMultiplayer() {
        const elements = window.UIController.elements;

        // Clear any existing countdowns
        this.clearCountdowns();

        // Disconnect existing socket if any
        if (this.socket) {
            this.socket.disconnect();
        }

        // Connect to socket.io
        this.socket = io();

        // Set up event handlers
        this.setupSocketEventHandlers();
    }

    // Set up socket event handlers for multiplayer
    setupSocketEventHandlers() {
        const elements = window.UIController.elements;

        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('roomCreated', ({ roomCode, isHost, gameMode, roundDuration, totalRounds }) => {
            // Update game state
            this.state.roomCode = roomCode;
            this.state.isHost = isHost;
            this.state.gameMode = gameMode;

            // Update UI
            elements.roomCodeDisplay.textContent = roomCode;
            elements.waitingRoom.style.display = 'block';
            document.querySelector('.create-game-form').style.display = 'none';

            // Prepare for game
            elements.currentGameModeElement.textContent = this.modeNames[gameMode];
            elements.currentRoomCodeElement.textContent = roomCode;
            elements.maxRoundsElement.textContent = totalRounds;

            // Update map layer for selected game mode
            window.MapUtils.updateMapLayer(gameMode);

            // Make sure country outlines are visible
            if (window.MapUtils.countryOutlines) {
                window.MapUtils.countryOutlines.bringToBack();
            }
        });

        this.socket.on('roomJoined', ({ roomCode, isHost, gameMode, roundDuration, totalRounds }) => {
            // Update game state
            this.state.roomCode = roomCode;
            this.state.isHost = isHost;
            this.state.gameMode = gameMode;

            // Update UI
            elements.waitingForHost.style.display = 'block';
            elements.joinForm.style.display = 'none';
            elements.joinErrorMsg.textContent = '';
            elements.joinedPlayerName.textContent = this.state.username;

            // Prepare for game
            elements.currentGameModeElement.textContent = this.modeNames[gameMode];
            elements.currentRoomCodeElement.textContent = roomCode;
            elements.maxRoundsElement.textContent = totalRounds;

            // Update map layer
            window.MapUtils.updateMapLayer(gameMode);

            // Make sure country outlines are visible
            if (window.MapUtils.countryOutlines) {
                window.MapUtils.countryOutlines.bringToBack();
            }
        });

        this.socket.on('playerList', ({ players }) => {
            // Update waiting room player list
            if (this.state.isHost) {
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
            if (this.state.active) {
                window.UIController.updatePlayersStatus(players);
            }
        });

        this.socket.on('newRound', ({ round, totalRounds, location, timeRemaining }) => {
            // Clear any existing countdowns
            this.clearCountdowns();

            // Prepare for new round - keep outlines
            window.MapUtils.clearMap(false);

            // Store location for reference
            this.state.currentLocation = location;

            // Update game state
            this.state.active = true;
            this.state.hasGuessed = false;
            this.state.correctCountrySelected = false;

            // Update UI
            elements.currentRoundElement.textContent = round;
            elements.maxRoundsElement.textContent = totalRounds;
            elements.currentLocationElement.textContent = location.name;
            elements.timerElement.textContent = this.formatTime(timeRemaining);
            elements.timerElement.style.display = 'inline-block';
            elements.timerElement.style.color = '';
            elements.distanceElement.textContent = '--';
            elements.pointsEarnedElement.textContent = '';
            elements.accuracyTextElement.textContent = '';

            // Update result text based on game mode
            if (this.state.gameMode === 'countries') {
                elements.resultTextElement.textContent = 'Dein Ergebnis:';
            } else {
                elements.resultTextElement.textContent = 'Deine Entfernung zum tatsächlichen Ort:';
            }

            // Show game screen
            window.UIController.showScreen('gameScreen');

            // Show/hide relevant elements
            if (elements.playersStatusElement) elements.playersStatusElement.style.display = 'block';
            if (elements.leaderboardElement) document.getElementById('leaderboardContainer').style.display = 'block';
            if (elements.currentRoomCodeElement) elements.currentRoomCodeElement.parentElement.style.display = 'flex';
            if (elements.startButton) elements.startButton.style.display = 'none';

            // Recenter map based on game mode
            if (this.state.gameMode && this.mapSettings[this.state.gameMode]) {
                const setting = this.mapSettings[this.state.gameMode];
                window.MapUtils.map.setView(setting.center, setting.zoom);
            }

            // Ensure country outlines are loaded
            if (!window.MapUtils.countryOutlines) {
                window.MapUtils.loadCountryOutlines(this.state.gameMode);
            } else {
                window.MapUtils.countryOutlines.bringToBack();
            }
        });

        this.socket.on('timeUpdate', ({ timeRemaining }) => {
            elements.timerElement.textContent = this.formatTime(timeRemaining);

            // Highlight timer if less than 10 seconds remaining
            if (timeRemaining <= 10) {
                elements.timerElement.style.color = '#ff4d4d';
            } else {
                elements.timerElement.style.color = '';
            }
        });

        this.socket.on('playerGuessed', ({ username, hasGuessed }) => {
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

        this.socket.on('guessResult', ({ distance, points, isCorrectCountry }) => {
            // Update player's own distance and points
            this.state.correctCountrySelected = isCorrectCountry;

            if (this.state.gameMode === 'countries' && isCorrectCountry) {
                elements.distanceElement.textContent = 'Richtig!';
                elements.accuracyTextElement.textContent = 'Perfekt! Du hast das richtige Land ausgewählt!';
            } else {
                elements.distanceElement.textContent = `${distance} km`;

                if (this.state.gameMode === 'countries') {
                    elements.accuracyTextElement.textContent = `Falsches Land ausgewählt. Das richtige Land war ${this.state.currentLocation.name}.`;
                }
            }

            elements.pointsEarnedElement.textContent = `Du hast ${points} Punkte verdient`;
            this.state.score += points;
            elements.playerScoreElement.textContent = this.state.score;
        });

        this.socket.on('roundEnded', ({ actualLocation, guesses, leaderboard, resultDelay }) => {
            // Store actual location coordinates
            const actualLatLng = L.latLng(actualLocation.lat, actualLocation.lng);

            // Show map details (labels)
            window.MapUtils.toggleMapDetails(true);

            // Create marker for actual location
            const actualMarker = window.MapUtils.createMarker(
                actualLocation.lat,
                actualLocation.lng,
                '#2e4057',
                actualLocation.name,
                true
            );

            actualMarker.openPopup();

            // For country mode, highlight the correct country
            if (this.state.gameMode === 'countries' && window.MapUtils.countryOutlines) {
                this.handleMultiplayerCountryResult(actualLocation, guesses, actualLatLng);
            } else {
                this.handleMultiplayerPointResult(guesses, actualLocation, actualLatLng);
            }

            // Update leaderboard
            window.UIController.updateLeaderboard(leaderboard);

            // Make sure outlines are visible
            if (window.MapUtils.countryOutlines) {
                window.MapUtils.countryOutlines.bringToBack();
            }

            // Clear any existing result countdown
            if (this.resultCountdownInterval) {
                clearInterval(this.resultCountdownInterval);
                this.resultCountdownInterval = null;
            }

            // Show result countdown timer
            if (resultDelay) {
                let countdown = resultDelay;
                elements.resultCountdownElement.textContent = `Nächste Runde in: ${countdown}s`;
                elements.resultCountdownElement.style.display = 'block';

                this.resultCountdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown <= 0) {
                        clearInterval(this.resultCountdownInterval);
                        this.resultCountdownInterval = null;
                        elements.resultCountdownElement.style.display = 'none';
                    } else {
                        elements.resultCountdownElement.textContent = `Nächste Runde in: ${countdown}s`;
                    }
                }, 1000);

                // Also update the timer display
                elements.timerElement.style.display = 'inline-block';
                elements.timerElement.textContent = this.formatTime(countdown);
                elements.timerElement.style.color = '';

                if (this.countdownInterval) {
                    clearInterval(this.countdownInterval);
                    this.countdownInterval = null;
                }

                this.countdownInterval = setInterval(() => {
                    countdown--;
                    if (countdown <= 0) {
                        clearInterval(this.countdownInterval);
                        this.countdownInterval = null;
                        elements.timerElement.style.display = 'none';
                        elements.timerElement.style.color = '';
                    } else {
                        elements.timerElement.textContent = this.formatTime(countdown);
                        if (countdown <= 5) {
                            elements.timerElement.style.color = '#ff4d4d';
                        }
                    }
                }, 1000);
            }
        });

        this.socket.on('gameOver', ({ leaderboard }) => {
            // Clear any existing countdowns
            this.clearCountdowns();

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
                if (player.username === this.state.username) {
                    row.style.fontWeight = 'bold';
                }

                tbody.appendChild(row);
            });

            table.appendChild(thead);
            table.appendChild(tbody);

            elements.finalLeaderboard.appendChild(table);
            elements.gameOverContent.innerHTML = '';
            elements.gameOverContent.appendChild(elements.finalLeaderboard);

            // Update game over buttons based on host status
            if (this.state.isHost) {
                elements.newGameBtn.textContent = 'Restart Game';
            } else {
                elements.newGameBtn.textContent = 'Rejoin';
            }

            elements.newGameBtn.style.display = 'block';
            elements.gameOverModal.style.display = 'flex';

            // Reset game state
            this.state.active = false;
            this.state.hasGuessed = false;
            this.state.score = 0;
        });

        this.socket.on('error', ({ message }) => {
            window.UIController.showError(message);
        });
    }

    // Handle multiplayer country mode result display
    handleMultiplayerCountryResult(actualLocation, guesses, actualLatLng) {
        let targetCountryLayer = null;

        // Find the correct country layer
        window.MapUtils.countryOutlines.eachLayer(layer => {
            const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
            if (countryName === actualLocation.name ||
                countryName.toLowerCase() === actualLocation.name.toLowerCase()) {
                targetCountryLayer = layer;
            }
        });

        if (targetCountryLayer) {
            // Highlight the correct country
            targetCountryLayer.setStyle({
                fillColor: '#5cb85c',
                fillOpacity: 0.5,
                weight: 3,
                color: '#5cb85c'
            });

            // Find my own guess
            const myGuess = guesses.find(g => g.username === this.state.username);

            if (myGuess && myGuess.selectedCountry !== actualLocation.name) {
                // Find the country layer for my selection
                let mySelectedLayer = null;
                window.MapUtils.countryOutlines.eachLayer(layer => {
                    const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
                    if (countryName === myGuess.selectedCountry) {
                        mySelectedLayer = layer;
                    }
                });

                if (mySelectedLayer) {
                    // Highlight my wrong selection
                    mySelectedLayer.setStyle({
                        fillColor: '#d9534f',
                        fillOpacity: 0.3,
                        weight: 2,
                        color: '#d9534f'
                    });

                    // Draw line from my selection to actual location
                    const selectedBounds = mySelectedLayer.getBounds();
                    const selectedCenter = selectedBounds.getCenter();

                    const polyline = window.MapUtils.drawLine(
                        selectedCenter.lat, selectedCenter.lng,
                        actualLatLng.lat, actualLatLng.lng,
                        '#d9534f'  // red line
                    );
                }
            }
        }
    }

    // Handle multiplayer point mode result display
    handleMultiplayerPointResult(guesses, actualLocation, actualLatLng) {
        // Create markers for all guesses and lines to actual location
        guesses.forEach(guess => {
            // Skip country mode when drawing markers
            if (this.state.gameMode === 'countries') return;

            // Create enhanced markers with player names
            const marker = window.MapUtils.createMarker(
                guess.lat,
                guess.lng,
                guess.color,
                guess.username,
                false
            );

            // Draw lines for all players
            window.MapUtils.drawLine(
                guess.lat, guess.lng,
                actualLocation.lat, actualLocation.lng,
                guess.color
            );
        });

        // Fit map to show all markers
        const bounds = [];
        bounds.push([actualLocation.lat, actualLocation.lng]);

        if (this.state.gameMode !== 'countries') {
            guesses.forEach(guess => bounds.push([guess.lat, guess.lng]));
        } else {
            // For country mode handling
            this.fitMapForCountryMode(actualLocation, guesses, bounds);
        }

        if (bounds.length > 0) {
            window.MapUtils.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }

    // Fit map for country mode in multiplayer
    fitMapForCountryMode(actualLocation, guesses, bounds) {
        // Find the correct country and make sure it's visible
        let targetCountryLayer = null;

        window.MapUtils.countryOutlines.eachLayer(layer => {
            const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
            if (countryName === actualLocation.name) {
                targetCountryLayer = layer;
            }
        });

        if (targetCountryLayer) {
            const countryBounds = targetCountryLayer.getBounds();
            bounds.push([countryBounds.getSouthWest().lat, countryBounds.getSouthWest().lng]);
            bounds.push([countryBounds.getNorthEast().lat, countryBounds.getNorthEast().lng]);
        }

        // Include my selected country if it was wrong
        const myGuess = guesses.find(g => g.username === this.state.username);

        if (myGuess && myGuess.selectedCountry !== actualLocation.name) {
            let mySelectedLayer = null;

            window.MapUtils.countryOutlines.eachLayer(layer => {
                const countryName = layer.feature.properties.ADMIN || layer.feature.properties.NAME;
                if (countryName === myGuess.selectedCountry) {
                    mySelectedLayer = layer;
                }
            });

            if (mySelectedLayer) {
                const myBounds = mySelectedLayer.getBounds();
                bounds.push([myBounds.getSouthWest().lat, myBounds.getSouthWest().lng]);
                bounds.push([myBounds.getNorthEast().lat, myBounds.getNorthEast().lng]);
            }
        }
    }

    // Create a multiplayer room
    createRoom(username, gameMode, roundDuration, totalRounds, resultDelay) {
        this.state.username = username;
        this.state.gameMode = gameMode;

        // Create room on server
        this.socket.emit('createRoom', {
            username,
            gameMode,
            roundDuration,
            totalRounds,
            resultDelay
        });
    }

    // Join an existing multiplayer room
    joinRoom(username, roomCode) {
        this.state.username = username;

        // Join room on server
        this.socket.emit('joinRoom', {
            username,
            roomCode
        });
    }

    // Restart/rejoin a multiplayer game
    restartMultiplayerGame() {
        // Clear countdowns
        this.clearCountdowns();

        if (this.state.isHost) {
            // For host, restart the game
            this.socket.emit('restartGame');
        } else {
            // For non-hosts, rejoin the same room
            if (this.state.roomCode) {
                this.joinRoom(this.state.username, this.state.roomCode);
            }
        }
    }

    // Start a multiplayer game (host only)
    startMultiplayerGame() {
        // Ensure outlines are loaded
        if (!window.MapUtils.countryOutlines && this.state.gameMode) {
            window.MapUtils.loadCountryOutlines(this.state.gameMode);
        }

        this.socket.emit('startGame');
    }

    // Submit a guess in multiplayer
    submitMultiplayerGuess(lat, lng) {
        if (!this.socket) return;

        // For countries mode, include the selected country
        if (this.state.gameMode === 'countries' && this.state.selectedCountry) {
            console.log(`Submitting country guess: ${this.state.selectedCountry}`);

            // Get center of the selected country for visualization
            let selectedCenter = { lat: lat, lng: lng };
            let selectedBounds = null;

            if (this.state.selectedCountryLayer) {
                selectedBounds = this.state.selectedCountryLayer.getBounds();
                selectedCenter = selectedBounds.getCenter();
            }

            // Check if the selected country matches the target
            const targetCountry = this.state.currentLocation.name;
            const targetEnglishName = this.state.currentLocation.english_name || targetCountry;

            // Check if selected country matches target (including English name variants)
            let isCorrectCountry = false;
            if (this.state.selectedCountry === targetCountry ||
                this.state.selectedCountry === targetEnglishName ||
                this.state.selectedCountry.toLowerCase() === targetCountry.toLowerCase() ||
                this.state.selectedCountry.toLowerCase() === targetEnglishName.toLowerCase()) {
                isCorrectCountry = true;
            }

            // Also check special country mappings
            const mappings = window.GameConfig.countryNameMappings;
            for (const [standard, variations] of Object.entries(mappings)) {
                if ((standard === targetCountry || standard === targetEnglishName) &&
                    variations.includes(this.state.selectedCountry)) {
                    isCorrectCountry = true;
                    break;
                }
            }

            // Send the guess to the server
            this.socket.emit('submitGuess', {
                lat: selectedCenter.lat,
                lng: selectedCenter.lng,
                selectedCountry: this.state.selectedCountry,
                isCorrectCountry: isCorrectCountry
            });

            // Visual feedback - highlight the selected country
            if (this.state.selectedCountryLayer) {
                this.state.selectedCountryLayer.setStyle(window.GameConfig.countryStyles.selected);
                this.state.selectedCountryLayer.bringToFront();
            }
        } else {
            // Standard point-based guess
            this.socket.emit('submitGuess', {
                lat: lat,
                lng: lng
            });
        }

        // Update UI to show player has guessed
        window.UIController.elements.confirmBtnContainer.style.display = 'none';

        // Mark player as having guessed in the UI
        const playerItems = window.UIController.elements.playersStatusElement.querySelectorAll('.player-item');
        playerItems.forEach(item => {
            const nameEl = item.querySelector('span');
            if (nameEl && nameEl.textContent === this.state.username) {
                const statusIndicator = item.querySelector('.status-indicator');
                if (statusIndicator) {
                    statusIndicator.classList.add('guessed');
                    item.querySelector('.player-status').lastChild.textContent = 'Geraten';
                }
            }
        });
    }
}

// Create and export a single instance
window.GameEngine = new GameEngine();