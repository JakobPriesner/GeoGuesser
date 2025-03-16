# GeoGuesser Multiplayer Game

A multiplayer geography game where players compete to guess the locations of cities, countries, and landmarks.

## Features

- Server-based multiplayer sessions
- Real-time gameplay with Socket.io
- Room-based game creation and joining
- Customizable game settings (rounds, timer)
- Player leaderboard
- Real-time status updates

## Game Modes

- German Cities
- Countries
- World Capitals
- World Cities

## How to Play

1. **Create a Game:**
    - Enter your username
    - Select a game mode
    - Set round duration and number of rounds
    - Share the room code with other players

2. **Join a Game:**
    - Enter your username
    - Input the 6-digit room code
    - Wait for the host to start the game

3. **During the Game:**
    - A location name will be shown
    - Click on the map where you think it is
    - Confirm your guess
    - See how all players guessed after each round
    - View the leaderboard to see everyone's scores

## Running the Application

### Using Docker (Recommended)

```bash
# Build and run with Docker Compose
docker-compose up -d

# The game will be available at http://localhost:3000
```

### Manual Setup

```bash
# Install dependencies
npm install

# Start the server
npm start

# The game will be available at http://localhost:3000
```

## Project Structure

- `/server.js` - Node.js server using Express and Socket.io
- `/public/` - Client-side files
    - `index.html` - Main HTML file
    - `main.js` - Client-side JavaScript with game logic
- `Dockerfile` & `docker-compose.yml` - Docker configuration

## Technical Details

- **Server:** Node.js + Express
- **Real-time Communication:** Socket.io
- **Map:** Leaflet.js
- **Containerization:** Docker

## Customization

You can extend the game by:
- Adding more location databases
- Implementing more game modes
- Adding user accounts and persistent leaderboards

## License

MIT