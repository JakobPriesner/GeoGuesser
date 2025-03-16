# GeoGuesser Location Database

This directory contains the JSON database of locations used in the GeoGuesser game. The database is organized by categories, with each category containing a list of locations with their coordinates.

## Database Structure

The database is a JSON file with the following structure:

```json
{
  "category-name": [
    { "name": "Location Name", "lat": 12.3456, "lng": 78.9012 },
    ...
  ],
  "another-category": [
    ...
  ]
}
```

Each location must have:
- `name`: The display name of the location
- `lat`: Latitude (decimal degrees)
- `lng`: Longitude (decimal degrees)

## Adding New Locations

### Manual Method

To add new locations or categories:

1. Open `locations.json` in a text editor
2. Follow the existing structure to add new locations or categories
3. Save the file

### Format Guidelines

- Use kebab-case for category names (e.g., `world-cities`, `european-landmarks`)
- Be consistent with naming formats within a category
- Use accurate coordinates (you can find these using Google Maps or similar services)

### Example: Adding a New Category

To add a new category of "Famous Mountains":

```json
"famous-mountains": [
  { "name": "Mount Everest", "lat": 27.9881, "lng": 86.9250 },
  { "name": "K2", "lat": 35.8800, "lng": 76.5151 },
  { "name": "Matterhorn", "lat": 45.9766, "lng": 7.6585 },
  ...
]
```

## Tips for Getting Coordinates

1. Go to [Google Maps](https://www.google.com/maps)
2. Right-click on the location
3. Select "What's here?"
4. The coordinates will appear in the info card at the bottom
5. Use these coordinates for the `lat` and `lng` values

## Validation

Before restarting the server, make sure your JSON is valid. You can use online validators like [JSONLint](https://jsonlint.com/).

## Programmatic Access

If you need to modify the database programmatically, the server provides a LocationService module with methods to:

- Get all categories
- Get locations for a specific category
- Add new locations
- Add new categories
- Update existing locations
- Remove locations or categories
- Import/export the database

Please refer to the `services/locationService.js` file for implementation details.