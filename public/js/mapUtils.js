class MapUtils {
    constructor() {
        // Initialize Leaflet map
        this.map = L.map('map').setView([30, 0], 2);

        // Initialize with base layer
        this.currentMapLayer = this.createBaseLayer();

        // Country outline layer
        this.countryOutlines = null;
    }

    // Create the base map layer (no labels)
    createBaseLayer() {
        const config = window.GameConfig.tileLayers.base;
        return L.tileLayer(config.url, config.options).addTo(this.map);
    }

    // Create detailed map layer (with labels)
    createDetailedLayer() {
        const config = window.GameConfig.tileLayers.detailed;
        return L.tileLayer(config.url, config.options);
    }

    // Update map layer based on game mode
    updateMapLayer(gameMode) {
        // Remove previous layers
        if (this.currentMapLayer) {
            this.map.removeLayer(this.currentMapLayer);
        }

        if (this.countryOutlines) {
            this.map.removeLayer(this.countryOutlines);
            this.countryOutlines = null;
        }

        // Add base layer
        this.currentMapLayer = this.createBaseLayer();

        // Update map view based on game mode settings
        if (gameMode && window.GameConfig.mapSettings[gameMode]) {
            const setting = window.GameConfig.mapSettings[gameMode];
            this.map.setView(setting.center, setting.zoom);
        }

        // Always load country outlines for all game modes
        return this.loadCountryOutlines(gameMode);
    }

    // Load country outline GeoJSON
    loadCountryOutlines(gameMode) {
        return new Promise((resolve, reject) => {
            // If outlines already exist, remove them first
            if (this.countryOutlines) {
                this.map.removeLayer(this.countryOutlines);
                this.countryOutlines = null;
            }

            // Get settings for the game mode
            const modeSettings = window.GameConfig.mapSettings[gameMode] || window.GameConfig.mapSettings.countries;

            // Determine which GeoJSON source to use
            let geoJsonUrl = window.GameConfig.geoJsonSources.world;
            if (gameMode === 'european-cities') {
                geoJsonUrl = window.GameConfig.geoJsonSources.europe;
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
                    // Special handling for German cities mode
                    if (gameMode === 'german-cities') {
                        this.handleGermanCitiesMap(data, modeSettings);
                    } else {
                        // Standard approach for other modes
                        this.countryOutlines = L.geoJSON(data, {
                            style: modeSettings.style || window.GameConfig.countryStyles.default,
                            filter: modeSettings.countryFilter || (() => true),
                            onEachFeature: (feature, layer) => {
                                // For countries mode, add click handlers
                                if (gameMode === 'countries') {
                                    this.addCountryClickHandlers(layer);
                                } else {
                                    // For other modes, make sure clicks pass through
                                    layer.on('click', (e) => {
                                        return true;
                                    });
                                }
                            }
                        }).addTo(this.map);
                    }

                    if (this.countryOutlines) {
                        // Make sure outlines are behind other elements
                        this.countryOutlines.bringToBack();

                        // Make countries clickable if in countries mode
                        if (gameMode === 'countries') {
                            this.makeCountriesClickable();
                        }
                    }

                    resolve(this.countryOutlines);
                })
                .catch(error => {
                    console.error('Error loading GeoJSON:', error);
                    reject(error);
                });
        });
    }

    // Special handling for German cities mode
    handleGermanCitiesMap(data, modeSettings) {
        // Find Germany feature
        const germanyFeature = data.features.find(feature =>
            feature.properties.ADMIN === 'Germany' ||
            feature.properties.NAME === 'Germany');

        if (germanyFeature) {
            console.log("Found Germany in GeoJSON data, creating special layer");

            // Create enhanced layer just for Germany
            this.countryOutlines = L.geoJSON(germanyFeature, {
                style: {
                    color: '#1a1a1a',
                    weight: 3,
                    fillColor: '#f8f8f8',
                    fillOpacity: 0.08
                }
            }).addTo(this.map);

            // Make sure it's in the background
            this.countryOutlines.bringToBack();
        } else {
            console.error("Germany not found in GeoJSON data");
            // Fall back to all countries
            this.countryOutlines = L.geoJSON(data, {
                style: modeSettings.style || window.GameConfig.countryStyles.default
            }).addTo(this.map);
        }
    }

    // Add click and hover handlers to countries
    makeCountriesClickable() {
        if (!this.countryOutlines) return;

        // Get game engine reference
        const engine = window.GameEngine;

        // Reset any previous selections
        if (engine.state.selectedCountryLayer) {
            this.countryOutlines.resetStyle(engine.state.selectedCountryLayer);
            engine.state.selectedCountryLayer = null;
            engine.state.selectedCountry = null;
        }

        // Add click handlers to each country layer
        this.countryOutlines.eachLayer(layer => {
            this.addCountryClickHandlers(layer);
        });

        console.log("Countries are now clickable");
    }

    // Add click and hover handlers to a country layer
    addCountryClickHandlers(layer) {
        // Get game engine reference
        const engine = window.GameEngine;
        const elements = window.UIController.elements;
        const self = this; // Store reference to MapUtils instance

        layer.on('click', function(e) {
            if (!engine.state.active || engine.state.hasGuessed) return;

            // Stop event propagation to prevent map's click handler
            L.DomEvent.stopPropagation(e);

            // Reset previous selection if any
            if (engine.state.selectedCountryLayer) {
                self.countryOutlines.resetStyle(engine.state.selectedCountryLayer);
            }

            // Set new selection
            engine.state.selectedCountryLayer = this;
            engine.state.selectedCountry = this.feature.properties.ADMIN ||
                this.feature.properties.NAME;

            // Highlight selected country with animation for better feedback
            this.setStyle(window.GameConfig.countryStyles.selected);

            // Add subtle animation for better feedback in multiplayer
            if (engine.state.multiplayer) {
                // Briefly flash the selection for better visibility
                const originalOpacity = window.GameConfig.countryStyles.selected.fillOpacity;
                const enhancedStyle = {...window.GameConfig.countryStyles.selected};

                // Flash effect (slightly brighter)
                enhancedStyle.fillOpacity = Math.min(0.7, originalOpacity * 1.5);
                this.setStyle(enhancedStyle);

                // Return to normal after brief flash
                setTimeout(() => {
                    this.setStyle(window.GameConfig.countryStyles.selected);
                }, 300);
            }

            console.log("Country selected:", engine.state.selectedCountry);

            // Show confirm button
            elements.confirmBtnContainer.style.display = 'flex';
        });

        // Add mouseover effect for better UX
        layer.on('mouseover', function() {
            if (!engine.state.active || engine.state.hasGuessed) return;
            if (this === engine.state.selectedCountryLayer) return;

            this.setStyle(window.GameConfig.countryStyles.hover);
        });

        // Add mouseout effect
        layer.on('mouseout', function() {
            if (!engine.state.active || engine.state.hasGuessed) return;
            if (this === engine.state.selectedCountryLayer) return;

            self.countryOutlines.resetStyle(this);
        });
    }

    // Prepare country selection for multiplayer mode
    prepareCountrySelectForMultiplayer() {
        // Make sure outlines are loaded
        if (!this.countryOutlines && window.GameEngine.state.gameMode === 'countries') {
            console.log("Loading country outlines for multiplayer");
            this.loadCountryOutlines('countries')
                .then(() => {
                    this.makeCountriesClickable();
                })
                .catch(err => {
                    console.error("Failed to load country outlines:", err);
                });
        } else if (this.countryOutlines) {
            // Make sure countries are clickable
            this.makeCountriesClickable();
        }
    }

    // Switch between map types (with/without labels)
    toggleMapDetails(showDetails) {
        if (this.currentMapLayer) {
            this.map.removeLayer(this.currentMapLayer);
        }

        if (showDetails) {
            // Show detailed map with labels
            this.currentMapLayer = this.createDetailedLayer().addTo(this.map);
        } else {
            // Show basic map without labels
            this.currentMapLayer = this.createBaseLayer();
        }

        // Update game state
        window.GameEngine.state.showingResults = showDetails;

        // Keep country outlines visible
        if (this.countryOutlines) {
            if (!this.map.hasLayer(this.countryOutlines)) {
                this.map.addLayer(this.countryOutlines);
            }
            this.countryOutlines.bringToBack();
        } else {
            // If outlines were somehow removed, reload them
            this.loadCountryOutlines(window.GameEngine.state.gameMode);
        }
    }

    // Find country by name with various matching strategies
    findCountryLayerByName(countryName) {
        if (!this.countryOutlines || !countryName) return null;

        let foundLayer = null;

        // Find English name from GameEngine locations data
        let englishName = countryName;
        const engine = window.GameEngine;

        if (engine.locations && engine.locations.countries) {
            const countryData = engine.locations.countries.find(country =>
                country.name === countryName);

            if (countryData && countryData.english_name) {
                englishName = countryData.english_name;
            }
        }

        // Try exact match first
        this.countryOutlines.eachLayer(layer => {
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

            this.countryOutlines.eachLayer(layer => {
                const adminName = layer.feature.properties.ADMIN;
                const name = layer.feature.properties.NAME;
                const layerCountryName = adminName || name;

                if (layerCountryName && layerCountryName.toLowerCase() === lowerEnglishName) {
                    foundLayer = layer;
                }
            });
        }

        // Try special mappings for country name variations
        if (!foundLayer) {
            const mappings = window.GameConfig.countryNameMappings;

            for (const [standard, variations] of Object.entries(mappings)) {
                if (variations.includes(englishName) || standard === englishName) {
                    this.countryOutlines.eachLayer(layer => {
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

    // Clear map of temporary elements (markers, lines, etc.)
    clearMap(clearOutlines = false) {
        const engine = window.GameEngine;

        // Clear temporary marker
        if (engine.state.tempMarker) {
            try {
                this.map.removeLayer(engine.state.tempMarker);
            } catch (e) {
                console.error("Error removing temp marker:", e);
            }
            engine.state.tempMarker = null;
        }

        // Clear guess marker
        if (engine.state.guessMarker) {
            try {
                this.map.removeLayer(engine.state.guessMarker);
            } catch (e) {
                console.error("Error removing guess marker:", e);
            }
            engine.state.guessMarker = null;
        }

        // Reset selected country style
        if (engine.state.selectedCountryLayer && this.countryOutlines) {
            try {
                this.countryOutlines.resetStyle(engine.state.selectedCountryLayer);
            } catch (e) {
                console.error("Error resetting country style:", e);
            }
            engine.state.selectedCountryLayer = null;
            engine.state.selectedCountry = null;
        }

        // Clear all player markers
        if (engine.state.playerMarkers && engine.state.playerMarkers.length > 0) {
            engine.state.playerMarkers.forEach((marker, index) => {
                try {
                    if (marker && marker._map) {
                        this.map.removeLayer(marker);
                    }
                } catch (e) {
                    console.error(`Error removing marker ${index}:`, e);
                }
            });
        }

        // Remove all additional layers
        this.map.eachLayer(layer => {
            // Skip base tile layer and country outlines
            if (layer === this.currentMapLayer) return;
            if (layer === this.countryOutlines && !clearOutlines) return;

            // Remove markers, lines, polygons, etc.
            if (layer instanceof L.Marker ||
                layer instanceof L.Circle ||
                layer instanceof L.Polyline ||
                layer instanceof L.Polygon) {
                try {
                    this.map.removeLayer(layer);
                } catch (e) {
                    console.error("Error removing additional layer:", e);
                }
            }
        });

        // Reset player markers array
        engine.state.playerMarkers = [];

        // Return to basic map without labels
        if (engine.state.showingResults) {
            this.toggleMapDetails(false);
        }

        // Handle country outlines
        if (clearOutlines && this.countryOutlines) {
            try {
                this.map.removeLayer(this.countryOutlines);
                this.countryOutlines = null;
                this.loadCountryOutlines(engine.state.gameMode);
            } catch (e) {
                console.error("Error removing country outlines:", e);
            }
        } else if (this.countryOutlines) {
            this.countryOutlines.bringToBack();
        } else if (engine.state.gameMode) {
            this.loadCountryOutlines(engine.state.gameMode);
        }

        // Hide confirm button
        document.querySelector('.confirm-button-container').style.display = 'none';
    }

    clearMarkersOnly() {
        const engine = window.GameEngine;

        console.log("Clearing only markers (preserving country outlines)");

        // Clear temporary marker
        if (engine.state.tempMarker) {
            try {
                this.map.removeLayer(engine.state.tempMarker);
            } catch (e) {
                console.error("Error removing temp marker:", e);
            }
            engine.state.tempMarker = null;
        }

        // Clear guess marker
        if (engine.state.guessMarker) {
            try {
                this.map.removeLayer(engine.state.guessMarker);
            } catch (e) {
                console.error("Error removing guess marker:", e);
            }
            engine.state.guessMarker = null;
        }

        // Reset selected country style but keep the country outlines
        if (engine.state.selectedCountryLayer && this.countryOutlines) {
            try {
                this.countryOutlines.resetStyle(engine.state.selectedCountryLayer);
            } catch (e) {
                console.error("Error resetting country style:", e);
            }
            engine.state.selectedCountryLayer = null;
            engine.state.selectedCountry = null;
        }

        // Clear all player markers
        if (engine.state.playerMarkers && engine.state.playerMarkers.length > 0) {
            engine.state.playerMarkers.forEach((marker, index) => {
                try {
                    if (marker && marker._map) {
                        this.map.removeLayer(marker);
                    }
                } catch (e) {
                    console.error(`Error removing marker ${index}:`, e);
                }
            });
        }

        // Remove all markers, polylines, polygons but NOT country outlines
        this.map.eachLayer(layer => {
            // Skip base tile layer and country outlines
            if (layer === this.currentMapLayer) return;
            if (layer === this.countryOutlines) return;

            // Remove markers, lines, polygons, etc.
            if (layer instanceof L.Marker ||
                layer instanceof L.Circle ||
                layer instanceof L.Polyline ||
                layer instanceof L.Polygon) {
                try {
                    this.map.removeLayer(layer);
                } catch (e) {
                    console.error("Error removing additional layer:", e);
                }
            }
        });

        // Reset player markers array
        engine.state.playerMarkers = [];

        // Return to basic map without labels if in results mode
        if (engine.state.showingResults) {
            this.toggleMapDetails(false);
        }

        // Make sure country outlines are visible and in back
        if (this.countryOutlines) {
            console.log("Ensuring country outlines remain visible");
            if (!this.map.hasLayer(this.countryOutlines)) {
                this.map.addLayer(this.countryOutlines);
            }
            this.countryOutlines.bringToBack();
        }

        // Hide confirm button
        document.querySelector('.confirm-button-container').style.display = 'none';
    }

    // Create a custom marker
    createMarker(lat, lng, color, username, isActual = false) {
        let markerHtml;
        let iconSize;
        let iconAnchor;

        if (isActual) {
            // Special marker for actual location
            const actualSettings = window.GameConfig.markers.actual;
            markerHtml = `
        <div style="background-color: ${actualSettings.color}; 
                   width: ${actualSettings.size}px; 
                   height: ${actualSettings.size}px; 
                   border-radius: 50%; 
                   border: ${actualSettings.border}px solid white; 
                   position: relative;">
          <div style="position: absolute; 
                      width: 6px; 
                      height: 6px; 
                      background-color: white; 
                      border-radius: 50%; 
                      top: 3px; 
                      left: 3px;">
          </div>
        </div>`;
            iconSize = [actualSettings.size, actualSettings.size];
            iconAnchor = [actualSettings.size/2, actualSettings.size/2];
        } else {
            // Standard marker with optional username
            markerHtml = `
        <div style="position: relative; text-align: center;">
          <div style="background-color: ${color}; 
                     width: 20px; 
                     height: 20px; 
                     border-radius: 50%; 
                     border: 2px solid white; 
                     margin: 0 auto;">
          </div>
          ${username ? `
            <div style="position: absolute; 
                        top: 22px; 
                        left: 50%; 
                        transform: translateX(-50%); 
                        background-color: rgba(255,255,255,0.8); 
                        padding: 2px 4px; 
                        border-radius: 3px; 
                        font-size: 10px; 
                        white-space: nowrap; 
                        font-weight: bold;">
              ${username}
            </div>` : ''}
        </div>`;
            iconSize = [80, 40]; // Wider to accommodate username
            iconAnchor = [40, 10];
        }

        const marker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-div-icon',
                html: markerHtml,
                iconSize: iconSize,
                iconAnchor: iconAnchor
            })
        }).addTo(this.map);

        // Add popup with details
        let popupContent = isActual
            ? `<div class="popup-content">🎯 <strong>${window.GameEngine.state.currentLocation.name}</strong></div>`
            : `<div class="popup-content"><strong>${username}'s Tipp</strong></div>`;

        marker.bindPopup(popupContent);

        return marker;
    }

    // Draw line between two points
    drawLine(startLat, startLng, endLat, endLng, color) {
        const styleKey = color === '#5cb85c' ? 'correct' : 'incorrect';
        const style = window.GameConfig.polylines[styleKey];

        return L.polyline(
            [[startLat, startLng], [endLat, endLng]],
            {
                color: color || style.color,
                dashArray: style.dashArray,
                weight: style.weight
            }
        ).addTo(this.map);
    }

    // Place marker for user's guess in single player
    placeSinglePlayerGuessMarker(latlng) {
        const engine = window.GameEngine;

        // Remove existing guess marker
        if (engine.state.guessMarker) {
            this.map.removeLayer(engine.state.guessMarker);
        }

        // Create new marker
        engine.state.guessMarker = this.createMarker(
            latlng.lat,
            latlng.lng,
            window.GameConfig.markers.guess.color,
            'Dein Tipp',
            false
        );

        // Add to player markers array
        engine.state.playerMarkers.push(engine.state.guessMarker);
    }

    // Fix map visibility on medium screens
    fixMapVisibility() {
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

            // Ensure map renders correctly
            setTimeout(() => {
                this.map.invalidateSize();
            }, 100);
        } else {
            // Reset custom styles
            mapContainer.style.display = '';
            mapContainer.style.marginBottom = '';
        }
    }

    // Add fixed styles for responsive design
    addFixedStyles() {
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

    // Calculate distance between two points
    calculateDistance(latlng1, latlng2) {
        // Use Leaflet's built-in distance calculation
        const distanceInMeters = latlng1.distanceTo(latlng2);

        // Convert to kilometers and round
        let distanceInKm = Math.round(distanceInMeters / 1000);

        // Cap distance at reasonable maximum
        const MAX_REASONABLE_DISTANCE = 20000; // Half of Earth's circumference
        if (distanceInKm > MAX_REASONABLE_DISTANCE) {
            console.warn(`Calculated distance ${distanceInKm} km exceeds maximum reasonable distance. Capping at ${MAX_REASONABLE_DISTANCE} km.`);
            distanceInKm = MAX_REASONABLE_DISTANCE;
        }

        return distanceInKm;
    }
}

// Create and export a single instance
window.MapUtils = new MapUtils();