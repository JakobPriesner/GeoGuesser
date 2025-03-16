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

function loadCountryOutlines(gameMode) {
    // If outlines already exist, remove them first to prevent duplicates
    if (countryOutlines) {
        map.removeLayer(countryOutlines);
        countryOutlines = null;
    }

    // Define URLs for different GeoJSON outlines
    let geoJsonUrl;
    let geoJsonStyle = {
        color: '#333',
        weight: 2,
        fillColor: '#f8f8f8',
        fillOpacity: 0.1
    };

    switch (gameMode) {
        case 'german-cities':
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 2,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            };
            break;
        case 'european-cities':
            geoJsonUrl = 'https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson';
            break;
        case 'countries':
            geoJsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
            geoJsonStyle = {
                color: '#333',
                weight: 1,
                fillColor: '#f8f8f8',
                // Use higher fillOpacity for countries mode for better visibility
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
                fillOpacity: 0.05
            };
            break;
        default:
            return;
    }

    fetch(geoJsonUrl)
        .then(response => response.json())
        .then(data => {
            if (gameMode === 'german-cities') {
                data.features = data.features.filter(feature =>
                    feature.properties.ADMIN === 'Germany'
                );
            }

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

            if (countryOutlines) {
                countryOutlines.bringToBack();

                // If in countries mode, make countries clickable
                if (gameMode === 'countries') {
                    makeCountriesClickable();
                }
            }
        })
        .catch(error => {
            console.error('Error loading GeoJSON:', error);
        });
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

    if (countryOutlines) {
        countryOutlines.bringToBack();
    }
}

function clearMap(clearOutlines = true) {
    const gameState = window.GameState.state;

    if (gameState.tempMarker) {
        map.removeLayer(gameState.tempMarker);
        gameState.tempMarker = null;
    }

    if (gameState.guessMarker) {
        map.removeLayer(gameState.guessMarker);
        gameState.guessMarker = null;
    }

    // Reset selected country if any
    if (gameState.selectedCountryLayer && countryOutlines) {
        countryOutlines.resetStyle(gameState.selectedCountryLayer);
        gameState.selectedCountryLayer = null;
        gameState.selectedCountry = null;
    }

    // Remove all markers and lines
    map.eachLayer(function(layer) {
        if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    gameState.playerMarkers = [];

    // Return to basic map without labels
    if (gameState.showingResults) {
        toggleMapDetails(false);
    }

    // Only clear outlines if explicitly requested
    if (clearOutlines && countryOutlines) {
        map.removeLayer(countryOutlines);
        countryOutlines = null;
    }

    document.querySelector('.confirm-button-container').style.display = 'none';
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
        ? `<div class="popup-content">🎯 <strong>${gameState.currentLocation.name}</strong></div>`
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

// Export map utilities
window.MapUtils = {
    map,
    countryOutlines,
    currentMapLayer,
    updateMapLayer,
    loadCountryOutlines,
    makeCountriesClickable,
    toggleMapDetails,
    clearMap,
    createMarker,
    drawLine,
    placeSinglePlayerGuessMarker,
    fixMapVisibility,
    addFixedStyles
};