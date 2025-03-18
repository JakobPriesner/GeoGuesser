// scoreUtils.js - Updated version to use english_name property

function calculateSinglePlayerScore() {
    const gameState = window.GameState.state;
    const elements = window.UIController.elements;

    let distance = 0;
    let score = 0;
    let accuracyText = '';

    if (gameState.gameMode === 'countries') {
        // For countries mode, check if selected country matches target
        const targetCountry = gameState.currentLocation.name;
        const targetCountryEnglish = gameState.currentLocation.english_name || targetCountry;
        const selectedCountry = gameState.selectedCountry;

        if (selectedCountry) {
            // Debug logging
            console.log(`Comparing - Target: "${targetCountry}" (English: "${targetCountryEnglish}") with Selected: "${selectedCountry}"`);

            // Match using English name (coming from GeoJSON) with our stored English translation
            gameState.correctCountrySelected =
                selectedCountry === targetCountryEnglish ||
                selectedCountry.toLowerCase() === targetCountryEnglish.toLowerCase();

            if (gameState.correctCountrySelected) {
                score = 1000; // Full points for correct country
                accuracyText = 'Perfekt! 🎯';
                distance = 0;
            } else {
                // Calculate distance between selected country center and target
                if (gameState.selectedCountryLayer) {
                    const selectedBounds = gameState.selectedCountryLayer.getBounds();
                    const selectedCenter = selectedBounds.getCenter();
                    const targetLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);

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
        const actualLatLng = L.latLng(gameState.currentLocation.lat, gameState.currentLocation.lng);
        const guessLatLng = gameState.guessMarker ? gameState.guessMarker.getLatLng() : null;

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
    gameState.score += score;
    window.UIController.updateScoreDisplay();

    console.log("Score calculation complete:", score, "points, total:", gameState.score);

    return score;
}

// Export score utilities
window.ScoreUtils = {
    calculateSinglePlayerScore
};