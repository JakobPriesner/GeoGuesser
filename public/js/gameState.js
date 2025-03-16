// gameState.js - Core game state and constants

// Game state object to track the current game state
const gameState = {
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
    locations: null, // Will store locations for single player mode
    playerMarkers: [],
    gameMode: null, // Track current game mode
    selectedCountry: null,      // Store the name of the selected country
    selectedCountryLayer: null, // Store the GeoJSON layer of the selected country
    correctCountrySelected: false // Flag to track if selected country is correct
};

// Will store available game modes from server
let gameModes = [];
let modeNames = {};

// Map settings for different game modes
const mapSettings = {
    'german-cities': { center: [51.1657, 10.4515], zoom: 6 },
    'european-cities': { center: [48.0000, 15.0000], zoom: 4 },
    'countries': { center: [30, 0], zoom: 2 },
    'capitals': { center: [30, 0], zoom: 2 },
    'world-landmarks': { center: [30, 0], zoom: 2 }
};

// Function to format time for the timer display
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

// Reset game state to initial values
function resetGameState() {
    gameState.active = false;
    gameState.multiplayer = false;
    gameState.isHost = false;
    gameState.roomCode = null;
    gameState.hasGuessed = false;
    gameState.showingResults = false;
    gameState.score = 0;
    gameState.round = 0;
    gameState.usedLocations = [];
    gameState.username = null;
    gameState.gameMode = null;
    gameState.tempMarker = null;
    gameState.guessMarker = null;
    gameState.playerMarkers = [];
    gameState.selectedCountry = null;
    gameState.selectedCountryLayer = null;
    gameState.correctCountrySelected = false;
}

// Fetch available game modes from the server
async function fetchGameModes() {
    try {
        const response = await fetch('/api/gamemodes');
        if (!response.ok) {
            throw new Error('Failed to fetch game modes');
        }

        // Update the exported GameState.gameModes directly
        window.GameState.gameModes = await response.json();

        // Create name lookup object
        window.GameState.modeNames = {};
        window.GameState.gameModes.forEach(mode => {
            window.GameState.modeNames[mode.id] = mode.name;
        });

        return window.GameState.gameModes;
    } catch (error) {
        console.error('Error fetching game modes:', error);
        throw error;
    }
}

// Fetch location data for single player mode
async function fetchLocations() {
    try {
        const response = await fetch('/api/locations');
        if (!response.ok) {
            throw new Error('Failed to fetch locations');
        }

        gameState.locations = await response.json();
        return gameState.locations;
    } catch (error) {
        console.error('Error fetching locations:', error);
        throw error;
    }
}

// Get random location for single player mode
function getRandomLocation(gameMode, usedLocations) {
    if (!gameState.locations || !gameState.locations[gameMode]) {
        return null;
    }

    const locations = gameState.locations[gameMode];
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
        if (locations.length === 0) {
            return null;
        }
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

// Export objects and functions
window.GameState = {
    state: gameState,
    gameModes: [], // Initialize as empty array to be filled
    modeNames: {}, // Initialize as empty object to be filled
    mapSettings,
    formatTime,
    calculateDistance,
    deg2rad,
    resetGameState,
    fetchGameModes,
    fetchLocations,
    getRandomLocation
};