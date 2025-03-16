const fs = require('fs');
const path = require('path');

class LocationService {
    constructor() {
        this.locationsPath = path.join(__dirname, '../data/locations.json');
        this.locations = null;
        this.loadLocations();
    }

    // Load all locations from the JSON file
    loadLocations() {
        try {
            const data = fs.readFileSync(this.locationsPath, 'utf8');
            this.locations = JSON.parse(data);
            console.log(`Loaded ${Object.keys(this.locations).length} location categories`);
        } catch (err) {
            console.error('Error loading locations:', err);
            // Initialize with empty object if file doesn't exist
            this.locations = {};
            this.saveLocations(); // Create the file
        }
    }

    // Save locations back to the JSON file
    saveLocations() {
        try {
            // Create directory if it doesn't exist
            const dir = path.dirname(this.locationsPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            fs.writeFileSync(this.locationsPath, JSON.stringify(this.locations, null, 2), 'utf8');
            console.log('Locations saved to file');
        } catch (err) {
            console.error('Error saving locations:', err);
        }
    }

    // Get all available categories
    getCategories() {
        return Object.keys(this.locations);
    }

    // Get all locations for a specific category
    getLocations(category) {
        return this.locations[category] || [];
    }

    // Get a random location from a category that hasn't been used yet
    getRandomLocation(category, usedLocations = []) {
        const locations = this.getLocations(category);
        if (!locations || locations.length === 0) {
            return null;
        }

        // Filter out used locations
        let availableLocations = locations.filter((_, index) => !usedLocations.includes(index));

        // If all locations have been used, reset
        if (availableLocations.length === 0) {
            return locations[Math.floor(Math.random() * locations.length)];
        }

        return availableLocations[Math.floor(Math.random() * availableLocations.length)];
    }

    // Add a new location to a category
    addLocation(category, location) {
        if (!this.locations[category]) {
            this.locations[category] = [];
        }

        // Check if location already exists
        const exists = this.locations[category].some(loc =>
            loc.name === location.name &&
            loc.lat === location.lat &&
            loc.lng === location.lng
        );

        if (!exists) {
            this.locations[category].push(location);
            this.saveLocations();
            return true;
        }

        return false;
    }

    // Add a new category
    addCategory(category) {
        if (!this.locations[category]) {
            this.locations[category] = [];
            this.saveLocations();
            return true;
        }
        return false;
    }

    // Update a location
    updateLocation(category, index, updatedLocation) {
        if (this.locations[category] && this.locations[category][index]) {
            this.locations[category][index] = updatedLocation;
            this.saveLocations();
            return true;
        }
        return false;
    }

    // Remove a location
    removeLocation(category, index) {
        if (this.locations[category] && this.locations[category][index]) {
            this.locations[category].splice(index, 1);
            this.saveLocations();
            return true;
        }
        return false;
    }

    // Remove a category
    removeCategory(category) {
        if (this.locations[category]) {
            delete this.locations[category];
            this.saveLocations();
            return true;
        }
        return false;
    }

    // Import locations from JSON
    importLocations(jsonData) {
        try {
            const newLocations = JSON.parse(jsonData);
            this.locations = { ...this.locations, ...newLocations };
            this.saveLocations();
            return true;
        } catch (err) {
            console.error('Error importing locations:', err);
            return false;
        }
    }

    // Export all locations as JSON
    exportLocations() {
        return JSON.stringify(this.locations, null, 2);
    }
}

module.exports = new LocationService();