// config.js - Game configuration settings and constants

const GameConfig = {
    // Default game settings
    defaults: {
        singlePlayer: {
            totalRounds: 10,
            resultDelay: 0  // No automatic delay in single player
        },
        multiplayer: {
            totalRounds: 10,
            roundDuration: 60,
            resultDelay: 10
        }
    },

    // Map settings for different game modes
    mapSettings: {
        'german-cities': {
            center: [51.1657, 10.4515],
            zoom: 6,
            countryFilter: (feature) => feature.properties.ADMIN === 'Germany',
            style: {
                color: '#1a1a1a',
                weight: 3,
                fillColor: '#f8f8f8',
                fillOpacity: 0.08
            }
        },
        'european-cities': {
            center: [48.0000, 15.0000],
            zoom: 4,
            countryFilter: (feature) => feature.properties.NAME !== undefined,
            style: {
                color: '#333',
                weight: 2,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            }
        },
        'countries': {
            center: [30, 0],
            zoom: 2,
            countryFilter: null,
            style: {
                color: '#333',
                weight: 1.5,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            }
        },
        'capitals': {
            center: [30, 0],
            zoom: 2,
            countryFilter: null,
            style: {
                color: '#333',
                weight: 1,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            }
        },
        'world-landmarks': {
            center: [30, 0],
            zoom: 2,
            countryFilter: null,
            style: {
                color: '#333',
                weight: 1,
                fillColor: '#f8f8f8',
                fillOpacity: 0.1
            }
        }
    },

    // Map tile layers
    tileLayers: {
        base: {
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?language=de',
            options: {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }
        },
        detailed: {
            url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?language=de',
            options: {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 19
            }
        }
    },

    // GeoJSON sources for country outlines
    geoJsonSources: {
        world: 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson',
        europe: 'https://raw.githubusercontent.com/leakyMirror/map-of-europe/master/GeoJSON/europe.geojson'
    },

    // Marker settings
    markers: {
        actual: {
            color: '#2e4057',
            size: 16,
            border: 2
        },
        guess: {
            color: '#ef8354',
            size: 20,
            border: 2
        },
        correct: {
            color: '#5cb85c',
            size: 20,
            border: 2
        },
        incorrect: {
            color: '#d9534f',
            size: 20,
            border: 2
        }
    },

    // Polyline styles
    polylines: {
        correct: {
            color: '#5cb85c',
            dashArray: '5, 10',
            weight: 2
        },
        incorrect: {
            color: '#d9534f',
            dashArray: '5, 10',
            weight: 2
        }
    },

    // Country styles
    countryStyles: {
        default: {
            color: '#333',
            weight: 1,
            fillColor: '#f8f8f8',
            fillOpacity: 0.1
        },
        hover: {
            fillOpacity: 0.2,
            weight: 2
        },
        selected: {
            fillColor: '#ef8354',
            fillOpacity: 0.4,
            weight: 3,
            color: '#ef8354'
        },
        correct: {
            fillColor: '#5cb85c',
            fillOpacity: 0.6,
            weight: 3,
            color: '#5cb85c'
        },
        incorrect: {
            fillColor: '#d9534f',
            fillOpacity: 0.5,
            weight: 3,
            color: '#d9534f'
        }
    },

    scoringThresholds: {
        'german-cities': [
            { distance: 1, score: 1000, message: 'Perfekt! 🎯' },
            { distance: 5, score: 900, message: 'Ausgezeichnet! 🏆' },
            { distance: 15, score: 800, message: 'Sehr gut! 👏' },
            { distance: 50, score: 650, message: 'Gut! 👍' },
            { distance: 100, score: 500, message: 'Nicht schlecht! 🙂' },
            { distance: 200, score: 250, message: 'Du kannst das besser! 🤔' },
            { distance: 400, score: 100, message: 'Weit daneben! 😕' },
            { distance: Infinity, score: 50, message: 'Sehr weit daneben! 😢' }
        ],
        'european-cities': [
            { distance: 1, score: 1000, message: 'Perfekt! 🎯' },
            { distance: 5, score: 900, message: 'Ausgezeichnet! 🏆' },
            { distance: 15, score: 800, message: 'Sehr gut! 👏' },
            { distance: 50, score: 650, message: 'Gut! 👍' },
            { distance: 200, score: 500, message: 'Nicht schlecht! 🙂' },
            { distance: 500, score: 250, message: 'Du kannst das besser! 🤔' },
            { distance: 1000, score: 100, message: 'Weit daneben! 😕' },
            { distance: Infinity, score: 50, message: 'Sehr weit daneben! 😢' }
        ],
        'countries': [
            { distance: 0, score: 1000, message: 'Perfekt! 🎯' }, // Correct country
            { distance: Infinity, score: 0, message: 'Falsch!' }  // Wrong country
        ],
        'capitals': [
            { distance: 1, score: 1000, message: 'Perfekt! 🎯' },
            { distance: 5, score: 900, message: 'Ausgezeichnet! 🏆' },
            { distance: 15, score: 800, message: 'Sehr gut! 👏' },
            { distance: 50, score: 650, message: 'Gut! 👍' },
            { distance: 200, score: 500, message: 'Nicht schlecht! 🙂' },
            { distance: 500, score: 250, message: 'Du kannst das besser! 🤔' },
            { distance: 1000, score: 100, message: 'Weit daneben! 😕' },
            { distance: Infinity, score: 50, message: 'Sehr weit daneben! 😢' }
        ],
        'world-landmarks': [
            { distance: 1, score: 1000, message: 'Perfekt! 🎯' },
            { distance: 5, score: 900, message: 'Ausgezeichnet! 🏆' },
            { distance: 15, score: 800, message: 'Sehr gut! 👏' },
            { distance: 50, score: 650, message: 'Gut! 👍' },
            { distance: 200, score: 500, message: 'Nicht schlecht! 🙂' },
            { distance: 500, score: 250, message: 'Du kannst das besser! 🤔' },
            { distance: 1000, score: 100, message: 'Weit daneben! 😕' },
            { distance: Infinity, score: 50, message: 'Sehr weit daneben! 😢' }
        ]
    },

    // Special country name mappings for better matching
    countryNameMappings: {
        'United States': ['USA', 'United States of America', 'US'],
        'United Kingdom': ['UK', 'Great Britain', 'England'],
        'Russian Federation': ['Russia'],
        'Czech Republic': ['Czechia'],
        'Deutschland': ['Germany'],
        'Frankreich': ['France'],
        'Italien': ['Italy'],
        'Spanien': ['Spain'],
        'Niederlande': ['Netherlands'],
        'Schweiz': ['Switzerland']
    },

    // Game result messages based on score percentage
    resultMessages: [
        { threshold: 90, message: 'Geographie-Genie!' },
        { threshold: 75, message: 'Ausgezeichnete Geographiekenntnisse!' },
        { threshold: 60, message: 'Gut gemacht!' },
        { threshold: 40, message: 'Nicht schlecht!' },
        { threshold: 0, message: 'Weiter erkunden!' }
    ]
};

// Export configuration
window.GameConfig = GameConfig;