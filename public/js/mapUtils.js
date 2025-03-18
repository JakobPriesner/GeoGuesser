let countryOutlines = null;

const map = L.map('map').setView([30, 0], 2);
let currentMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?language=de', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

function updateMapLayer(gameMode) {
    if (currentMapLayer) {
        map.removeLayer(currentMapLayer);
    }

    // Remove previous country outlines
    if (countryOutlines) {
        map.removeLayer(countryOutlines);
        countryOutlines = null;
    }

    // Set OpenStreetMap to German language
    currentMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?language=de', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);

    // Update map view based on game mode
    if (gameMode && window.GameState.mapSettings[gameMode]) {
        const setting = window.GameState.mapSettings[gameMode];
        map.setView(setting.center, setting.zoom);
    }

    // Always load country outlines for all game modes
    loadCountryOutlines(gameMode);
}

function makeCountriesClickable() {
    if (!countryOutlines) return;

    // Reset any previous selections
    if (window.GameState.state.selectedCountryLayer) {
        countryOutlines.resetStyle(window.GameState.state.selectedCountryLayer);
        window.GameState.state.selectedCountryLayer = null;
        window.GameState.state.selectedCountry = null;
    }

    // Add click handler to each country
    countryOutlines.eachLayer(layer => {
        layer.on('click', function(e) {
            if (!window.GameState.state.active || window.GameState.state.hasGuessed) return;

            // Stop event propagation to prevent the map's click handler from firing
            L.DomEvent.stopPropagation(e);

            // Reset previous selection if any
            if (window.GameState.state.selectedCountryLayer) {
                countryOutlines.resetStyle(window.GameState.state.selectedCountryLayer);
            }

            // Set new selection
            window.GameState.state.selectedCountryLayer = this;
            window.GameState.state.selectedCountry = this.feature.properties.ADMIN ||
                this.feature.properties.NAME;

            // Highlight selected country
            this.setStyle({
                fillColor: '#ef8354',
                fillOpacity: 0.4,
                weight: 3,
                color: '#ef8354'
            });

            // Show confirm button
            document.querySelector('.confirm-button-container').style.display = 'flex';
        });

        // Add mouseover effect for better UX
        layer.on('mouseover', function() {
            if (!window.GameState.state.active || window.GameState.state.hasGuessed) return;
            if (this === window.GameState.state.selectedCountryLayer) return;

            this.setStyle({
                fillOpacity: 0.2,
                weight: 2
            });
        });

        // Add mouseout effect
        layer.on('mouseout', function() {
            if (!window.GameState.state.active || window.GameState.state.hasGuessed) return;
            if (this === window.GameState.state.selectedCountryLayer) return;

            countryOutlines.resetStyle(this);
        });
    });
}

// Critical fix - properly expose countryOutlines in the MapUtils object
function loadCountryOutlines(gameMode) {
    // If outlines already exist, remove them first to prevent duplicates
    if (countryOutlines) {
        map.removeLayer(countryOutlines);
        countryOutlines = null;
    }

    let geoJsonUrl;
    let geoJsonStyle = {
        color: '#333',
        weight: 2,
        fillColor: '#f8f8f8',
        fillOpacity: 0.1
    };

    // Determine which GeoJSON to load and how to style it based on game mode
    switch (gameMode) {
        case 'german-cities':
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#4a4a4a',     // Darker border color for better visibility
                weight: 2.5,           // Slightly thicker border
                fillColor: '#f8f8f8',
                fillOpacity: 0.12      // Slightly more visible fill
            };
            break;
        case 'european-cities':
            geoJsonUrl = 'https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 2,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            };
            break;
        case 'countries':
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 1.5,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            };
            break;
        case 'capitals':
        case 'world-landmarks':
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 1,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            };
            break;
        default:
            // For any other mode, still load world country outlines by default
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 1,
                fillColor: '#f8f8f8',
                fillOpacity: 0.05
            };
            break;
    }

    console.log("Loading country data from:", geoJsonUrl);

    fetch(geoJsonUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to fetch GeoJSON: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // For German cities mode, handle Germany specifically
            if (gameMode === 'german-cities') {
                // First, keep only Germany for the main outline
                const germanyFeature = data.features.find(feature =>
                    feature.properties.ADMIN === 'Germany' ||
                    feature.properties.NAME === 'Germany');

                if (germanyFeature) {
                    // Create a special layer just for Germany with enhanced visibility
                    countryOutlines = L.geoJSON(germanyFeature, {
                        style: {
                            color: '#1a1a1a',        // Very dark gray for German border
                            weight: 3,              // Thicker border for Germany
                            fillColor: '#f8f8f8',
                            fillOpacity: 0.08       // Very subtle fill
                        }
                    }).addTo(map);
                } else {
                    console.error("Germany not found in GeoJSON data");
                    // Fall back to all countries
                    countryOutlines = L.geoJSON(data, {
                        style: geoJsonStyle
                    }).addTo(map);
                }
            } else {
                // For all other modes, use the standard approach
                countryOutlines = L.geoJSON(data, {
                    style: geoJsonStyle,
                    filter: function(feature) {
                        if (gameMode === 'european-cities') {
                            return feature.properties.NAME !== undefined;
                        }
                        return true;
                    },
                    // Add event handlers to prevent handling events for certain game modes
                    onEachFeature: function(feature, layer) {
                        // For european-cities and other modes, make sure clicks pass through to the map
                        if (gameMode !== 'countries') {
                            layer.on('click', function(e) {
                                // Let the event bubble up to the map
                                return true;
                            });
                        }
                    }
                }).addTo(map);
            }

            if (countryOutlines) {
                // Always make sure country outlines are visible but behind other elements
                countryOutlines.bringToBack();

                if (gameMode === 'countries') {
                    makeCountriesClickable();
                }

                // CRITICAL FIX: Update the window.MapUtils.countryOutlines reference
                window.MapUtils.countryOutlines = countryOutlines;

                // Log some countries for debugging
                if (gameMode === 'countries') {
                    let countryCounter = 0;
                    countryOutlines.eachLayer(layer => {
                        if (countryCounter < 5) { // Just log a few for debugging
                            countryCounter++;
                        }
                    });
                }
            }

            return countryOutlines;
        })
        .catch(error => {
            console.error('Error loading GeoJSON:', error);
            reject(error);
        });
}

// Add a method that gets country by name to help with matching
// Enhanced findCountryLayerByName function for English name matching

function findCountryLayerByName(countryName) {
    if (!countryOutlines) return null;
    if (!countryName) return null;

    let foundLayer = null;

    // Find the English name for this country from our locations data
    let englishName = countryName;

    // Check if this is the German name and we need to find the English equivalent
    const locations = window.GameState.locations;
    if (locations && locations.countries) {
        // Find the country in our data
        const countryData = locations.countries.find(country =>
            country.name === countryName);

        // If found and has english_name, use that
        if (countryData && countryData.english_name) {
            englishName = countryData.english_name;
        }
    }

    // First try exact match
    countryOutlines.eachLayer(layer => {
        const adminName = layer.feature.properties.ADMIN;
        const name = layer.feature.properties.NAME;
        const layerCountryName = adminName || name;

        if (layerCountryName === englishName) {
            foundLayer = layer;
        }
    });

    // If not found, try case-insensitive match
    if (!foundLayer) {
        const lowerEnglishName = englishName.toLowerCase();

        countryOutlines.eachLayer(layer => {
            const adminName = layer.feature.properties.ADMIN;
            const name = layer.feature.properties.NAME;
            const layerCountryName = adminName || name;

            if (layerCountryName && layerCountryName.toLowerCase() === lowerEnglishName) {
                foundLayer = layer;
            }
        });
    }

    // Special cases for countries with name variations
    if (!foundLayer) {
        const countryVariations = {
            'United States': ['USA', 'United States of America', 'US'],
            'United Kingdom': ['UK', 'Great Britain', 'England'],
            'Russian Federation': ['Russia'],
            'Czech Republic': ['Czechia']
        };

        for (const [standard, variations] of Object.entries(countryVariations)) {
            if (variations.includes(englishName) || standard === englishName) {
                countryOutlines.eachLayer(layer => {
                    const adminName = layer.feature.properties.ADMIN;
                    const name = layer.feature.properties.NAME;
                    const layerCountryName = adminName || name;

                    if ([standard, ...variations].includes(layerCountryName)) {
                        foundLayer = layer;
                    }
                });

                if (foundLayer) break;
            }
        }
    }

    return foundLayer;
}

function toggleMapDetails(showDetails) {
    if (currentMapLayer) {
        map.removeLayer(currentMapLayer);
    }

    if (showDetails) {
        // Detailed map with labels (for results)
        currentMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?language=de', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
    } else {
        // Basic map without labels (for guessing)
        currentMapLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?language=de', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
    }

    window.GameState.state.showingResults = showDetails;

    // IMPORTANT: Keep country outlines visible after toggling map details
    if (countryOutlines) {
        // Ensure outlines are still visible
        if (!map.hasLayer(countryOutlines)) {
            map.addLayer(countryOutlines);
        }
        countryOutlines.bringToBack();
    } else {
        // If outlines were somehow removed, try to reload them
        loadCountryOutlines(window.GameState.state.gameMode);
    }
}

// Enhanced clearMap function with more thorough layer cleanup
function clearMap(clearOutlines = false) { // Changed default to false to keep outlines
    const gameState = window.GameState.state;

    if (gameState.tempMarker) {
        try {
            map.removeLayer(gameState.tempMarker);
        } catch (e) {
            console.error("Error removing temp marker:", e);
        }
        gameState.tempMarker = null;
    }

    if (gameState.guessMarker) {
        try {
            map.removeLayer(gameState.guessMarker);
        } catch (e) {
            console.error("Error removing guess marker:", e);
        }
        gameState.guessMarker = null;
    }

    // Reset selected country style if any but keep outlines visible
    if (gameState.selectedCountryLayer && countryOutlines) {
        try {
            countryOutlines.resetStyle(gameState.selectedCountryLayer);
        } catch (e) {
            console.error("Error resetting country style:", e);
        }
        gameState.selectedCountryLayer = null;
        gameState.selectedCountry = null;
    }

    // Clear all player markers
    if (gameState.playerMarkers && gameState.playerMarkers.length > 0) {

        // First pass: try to remove each marker individually
        gameState.playerMarkers.forEach((marker, index) => {
            try {
                if (marker && marker._map) {
                    map.removeLayer(marker);
                }
            } catch (e) {
                console.error(`Error removing marker ${index}:`, e);
            }
        });
    }

    map.eachLayer(layer => {
        // Skip the base tile layer and country outlines
        if (layer === currentMapLayer) return;
        if (layer === countryOutlines && !clearOutlines) return;

        // Remove all other types of layers that might be left
        if (layer instanceof L.Marker ||
            layer instanceof L.Circle ||
            layer instanceof L.Polyline ||
            layer instanceof L.Polygon) {
            try {
                map.removeLayer(layer);
            } catch (e) {
                console.error("Error removing additional layer:", e);
            }
        }
    });

    // Reset the player markers array
    gameState.playerMarkers = [];

    // Return to basic map without labels
    if (gameState.showingResults) {
        toggleMapDetails(false);
    }

    // Only clear outlines if explicitly requested
    if (clearOutlines && countryOutlines) {
        try {
            map.removeLayer(countryOutlines);
            countryOutlines = null;
            // Since we're explicitly clearing outlines, reload them to maintain visibility
            loadCountryOutlines(gameState.gameMode);
        } catch (e) {
            console.error("Error removing country outlines:", e);
        }
    } else if (countryOutlines) {
        // Make sure outlines are always visible and in the back
        countryOutlines.bringToBack();
    } else if (gameState.gameMode) {
        // If outlines were somehow removed, reload them
        loadCountryOutlines(gameState.gameMode);
    }

    // Hide the confirm button
    document.querySelector('.confirm-button-container').style.display = 'none';

    if (!clearOutlines) {
        loadCountryOutlines(gameState.gameMode);
    }
}

function createMarker(lat, lng, color, username, isActual = false) {
    let markerHtml;
    let iconSize;
    let iconAnchor;

    if (isActual) {
        markerHtml = `<div style="background-color: #2e4057; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; position: relative;">
            <div style="position: absolute; width: 6px; height: 6px; background-color: white; border-radius: 50%; top: 3px; left: 3px;"></div>
        </div>`;
        iconSize = [16, 16];
        iconAnchor = [8, 8];
    } else {
        markerHtml = `
        <div style="position: relative; text-align: center;">
            <div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; margin: 0 auto;"></div>
            ${username ? `<div style="position: absolute; top: 22px; left: 50%; transform: translateX(-50%); background-color: rgba(255,255,255,0.8); padding: 2px 4px; border-radius: 3px; font-size: 10px; white-space: nowrap; font-weight: bold;">${username}</div>` : ''}
        </div>`;
        iconSize = [80, 40]; // Wider to accommodate the username
        iconAnchor = [40, 10];
    }

    const marker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'custom-div-icon',
            html: markerHtml,
            iconSize: iconSize,
            iconAnchor: iconAnchor
        })
    }).addTo(map);

    // Add popup with more details
    let popupContent = isActual
        ? `<div class="popup-content">🎯 <strong>${window.GameState.state.currentLocation.name}</strong></div>`
        : `<div class="popup-content"><strong>${username}'s Tipp</strong></div>`;

    marker.bindPopup(popupContent);

    return marker;
}

// Draw line between guess and actual location
function drawLine(guessLat, guessLng, actualLat, actualLng, color) {
    return L.polyline([[guessLat, guessLng], [actualLat, actualLng]], {
        color: color,
        dashArray: '5, 10',
        weight: 2
    }).addTo(map);
}

// Place marker for the user's guess (single player)
function placeSinglePlayerGuessMarker(latlng) {
    const gameState = window.GameState.state;

    // Remove existing guess marker if any
    if (gameState.guessMarker) {
        map.removeLayer(gameState.guessMarker);
    }

    // Create new marker for the guess using our enhanced function
    gameState.guessMarker = createMarker(
        latlng.lat,
        latlng.lng,
        '#ef8354',
        'Dein Tipp',
        false
    );

    gameState.playerMarkers.push(gameState.guessMarker);
}

// Fix map visibility on medium screens
function fixMapVisibility() {
    const mapContainer = document.querySelector('.map-container');
    const gameContainer = document.querySelector('.game-container');

    if (!mapContainer || !gameContainer) return;

    const windowWidth = window.innerWidth;

    if (windowWidth > 480 && windowWidth <= 767) {
        // Medium screen fixes
        mapContainer.style.display = 'block';
        mapContainer.style.width = '100%';
        mapContainer.style.height = '45vh';
        mapContainer.style.minHeight = '300px';
        mapContainer.style.marginBottom = '15px';

        // Also make sure the map renders correctly
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    } else {
        // Reset custom styles when outside this range
        mapContainer.style.display = '';
        mapContainer.style.marginBottom = '';
    }
}

// Add CSS fixes for medium screens
function addFixedStyles() {
    const styleTag = document.createElement('style');
    styleTag.textContent = `
        @media (min-width: 481px) and (max-width: 767px) {
            .map-container {
                display: block !important;
                width: 100% !important;
                height: 45vh !important;
                min-height: 300px !important;
                margin-bottom: 15px !important;
            }
            
            .game-container {
                flex-direction: column !important;
            }
            
            .game-panel {
                width: 100% !important;
            }
        }
    `;
    document.head.appendChild(styleTag);
}

function calculateDistance(latlng1, latlng2) {
    // Use Leaflet's built-in distance calculation
    const distanceInMeters = latlng1.distanceTo(latlng2);

    // Convert to kilometers and round to nearest integer
    let distanceInKm = Math.round(distanceInMeters / 1000);

    // Ensure distance is reasonable (max ~20,000 km is half the Earth's circumference)
    const MAX_REASONABLE_DISTANCE = 20000;
    if (distanceInKm > MAX_REASONABLE_DISTANCE) {
        console.warn(`Calculated distance ${distanceInKm} km exceeds maximum reasonable distance. Capping at ${MAX_REASONABLE_DISTANCE} km.`);
        distanceInKm = MAX_REASONABLE_DISTANCE;
    }

    return distanceInKm;
}

// Export map utilities
window.MapUtils = {
    map,
    countryOutlines, // This reference will be updated when loadCountryOutlines is called
    currentMapLayer,
    updateMapLayer,
    loadCountryOutlines,
    findCountryLayerByName, // New helper function
    makeCountriesClickable,
    toggleMapDetails,
    clearMap,
    createMarker,
    drawLine,
    placeSinglePlayerGuessMarker,
    fixMapVisibility,
    addFixedStyles
};