function getScoringThresholds(gameMode) {
    if (gameMode === 'german-cities') {
        return [25, 50, 100, 200];
    } else if (gameMode === 'european-cities') {
        return [50, 150, 300, 600];
    } else if (gameMode === 'world-landmarks' || gameMode === 'capitals') {
        return [100, 300, 700, 1500];
    } else { // countries
        return [300, 600, 1200, 2500];
    }
}

function calculateSinglePlayerScore() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    let distance;
    let pointsEarned;
    let actualLatLng;

    // Get the actual coordinates for distance calculation
    actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);

    if (gameState.gameMode === 'countries') {
        // For country mode, check if the selected country matches
        const targetCountry = gameState.currentLocation.name;
        const selectedCountry = gameState.selectedCountry;

        // Store whether the guess is correct in gameState for reference
        gameState.correctCountrySelected = (selectedCountry === targetCountry);

        if (gameState.correctCountrySelected) {
            // Correct country selection - full points
            elements.distanceElement.textContent = 'Richtig!';
            elements.accuracyTextElement.textContent = 'Perfekt! Du hast das richtige Land ausgewählt!';
            pointsEarned = 100;
            distance = 0;
        } else {
            // Wrong country - check if the center of the selected country is within the target country's boundaries
            const selectedBounds = gameState.selectedCountryLayer.getBounds();
            const selectedCenter = selectedBounds.getCenter();

            // Try to find the target country layer
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
                // Center is within the target country - full points
                elements.distanceElement.textContent = 'Richtig!';
                elements.accuracyTextElement.textContent = 'Dein ausgewähltes Land liegt im richtigen Land!';
                pointsEarned = 100;
                distance = 0;
                // Set as correct to avoid drawing a line to the actual country
                gameState.correctCountrySelected = true;
            } else {
                // Wrong country - calculate distance between selection and target
                // Get the center point of the selected country for distance calculation
                distance = window.GameState.calculateDistance(
                    selectedCenter.lat, selectedCenter.lng,
                    actualLatLng.lat, actualLatLng.lng
                );
                const roundedDistance = Math.round(distance);

                elements.distanceElement.textContent = `${roundedDistance} km`;
                elements.accuracyTextElement.textContent = `Falsches Land ausgewählt. Das richtige Land war ${targetCountry}.`;

                // Use the standard distance-based scoring
                const thresholds = getScoringThresholds(gameState.gameMode);

                if (distance < thresholds[0]) {
                    pointsEarned = 75;
                } else if (distance < thresholds[1]) {
                    pointsEarned = 50;
                } else if (distance < thresholds[2]) {
                    pointsEarned = 25;
                } else if (distance < thresholds[3]) {
                    pointsEarned = 10;
                } else {
                    pointsEarned = 5;
                }
            }
        }
    } else {
        // For point-based modes, calculate distance as before
        const guessLatLng = gameState.guessMarker.getLatLng();

        distance = window.GameState.calculateDistance(
            guessLatLng.lat, guessLatLng.lng,
            actualLatLng.lat, actualLatLng.lng
        );
        const roundedDistance = Math.round(distance);

        elements.distanceElement.textContent = `${roundedDistance} km`;

        const thresholds = getScoringThresholds(gameState.gameMode);

        if (distance < thresholds[0]) {
            elements.accuracyTextElement.textContent = 'Perfekt! Fast genau getroffen!';
            pointsEarned = 100;
        } else if (distance < thresholds[1]) {
            elements.accuracyTextElement.textContent = 'Sehr gut! Ausgezeichnete Kenntnisse!';
            pointsEarned = 75;
        } else if (distance < thresholds[2]) {
            elements.accuracyTextElement.textContent = 'Gute Schätzung!';
            pointsEarned = 50;
        } else if (distance < thresholds[3]) {
            elements.accuracyTextElement.textContent = 'Nicht schlecht!';
            pointsEarned = 25;
        } else {
            elements.accuracyTextElement.textContent = 'Mehr Glück beim nächsten Mal!';
            pointsEarned = 10;
        }
    }

    gameState.score += pointsEarned;

    // Add points earned message
    elements.pointsEarnedElement.textContent = `Du hast ${pointsEarned} Punkte verdient`;

    window.UIController.updateScoreDisplay();

    return {
        distance: typeof distance === 'number' ? Math.round(distance) : distance,
        points: pointsEarned
    };
}

window.ScoreUtils = {
    getScoringThresholds,
    calculateSinglePlayerScore
};