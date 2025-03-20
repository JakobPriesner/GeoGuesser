// uiController.js - User interface management

class UIController {
    constructor() {
        // Define all UI elements
        this.elements = this.initializeElements();
    }

    // Initialize and collect all UI elements
    initializeElements() {
        return {
            // Buttons
            homeButton: document.getElementById('homeButton'),
            confirmGuessBtn: document.getElementById('confirmGuessBtn'),
            singlePlayerWelcomeBtn: document.getElementById('singlePlayerWelcomeBtn'),
            createMultiplayerBtn: document.getElementById('createMultiplayerBtn'),
            joinMultiplayerBtn: document.getElementById('joinMultiplayerBtn'),
            backFromModeBtn: document.getElementById('backFromModeBtn'),
            createRoomBtn: document.getElementById('createRoomBtn'),
            backFromCreateGameBtn: document.getElementById('backFromCreateGameBtn'),
            startGameBtn: document.getElementById('startGameBtn'),
            startButton: document.getElementById('startButton'),
            joinRoomBtn: document.getElementById('joinRoomBtn'),
            backFromJoinBtn: document.getElementById('backFromJoinBtn'),
            newGameBtn: document.getElementById('newGameBtn'),
            backToMenuBtn: document.getElementById('backToMenuBtn'),
            closeErrorBtn: document.getElementById('closeErrorBtn'),

            // Game info elements
            confirmBtnContainer: document.querySelector('.confirm-button-container'),
            currentLocationElement: document.getElementById('currentLocation'),
            distanceElement: document.getElementById('distance'),
            currentRoundElement: document.getElementById('currentRound'),
            maxRoundsElement: document.getElementById('maxRounds'),
            playerScoreElement: document.getElementById('playerScore'),
            pointsEarnedElement: document.getElementById('pointsEarned'),
            timerElement: document.getElementById('timer'),
            currentGameModeElement: document.getElementById('currentGameMode'),
            currentRoomCodeElement: document.getElementById('currentRoomCode'),
            playersStatusElement: document.getElementById('playersStatus'),
            leaderboardElement: document.getElementById('leaderboard'),
            accuracyTextElement: document.getElementById('accuracyText'),
            resultTextElement: document.getElementById('resultText'),

            // Game screens
            welcomeScreen: document.getElementById('welcomeScreen'),
            modeSelectionScreen: document.getElementById('modeSelectionScreen'),
            createGameScreen: document.getElementById('createGameScreen'),
            joinGameScreen: document.getElementById('joinGameScreen'),
            gameScreen: document.getElementById('gameScreen'),
            gameScreens: document.querySelectorAll('.game-screens > div'),

            // Multiplayer elements
            hostUsernameInput: document.getElementById('hostUsername'),
            gameModeSelect: document.getElementById('gameModeSelect'),
            roundDurationInput: document.getElementById('roundDuration'),
            totalRoundsInput: document.getElementById('totalRounds'),
            resultDelayInput: document.getElementById('resultDelay'),
            waitingRoom: document.getElementById('waitingRoom'),
            roomCodeDisplay: document.getElementById('roomCodeDisplay'),
            waitingPlayers: document.getElementById('waitingPlayers'),
            joinUsernameInput: document.getElementById('joinUsername'),
            roomCodeInput: document.getElementById('roomCode'),
            joinErrorMsg: document.getElementById('joinErrorMsg'),
            waitingForHost: document.getElementById('waitingForHost'),
            joinedPlayers: document.getElementById('joinedPlayers'),
            joinForm: document.getElementById('joinForm'),
            joinedPlayerName: document.getElementById('joinedPlayerName'),

            // Modals
            gameOverModal: document.getElementById('gameOverModal'),
            gameOverContent: document.getElementById('gameOverContent'),
            finalLeaderboard: document.getElementById('finalLeaderboard'),
            errorModal: document.getElementById('errorModal'),
            errorMessage: document.getElementById('errorMessage'),

            // Result countdown element - create if it doesn't exist
            resultCountdownElement: document.getElementById('resultCountdown') ||
                this.createResultCountdownElement()
        };
    }

    // Create result countdown element if needed
    createResultCountdownElement() {
        const countdownEl = document.createElement('div');
        countdownEl.id = 'resultCountdown';
        countdownEl.className = 'result-countdown';
        countdownEl.style.display = 'none';
        countdownEl.style.marginTop = '10px';
        countdownEl.style.padding = '5px 10px';
        countdownEl.style.backgroundColor = '#4f5d75';
        countdownEl.style.color = 'white';
        countdownEl.style.borderRadius = '4px';
        countdownEl.style.textAlign = 'center';
        countdownEl.style.fontWeight = 'bold';

        // Find where to append it - add it after the accuracy text
        const resultInfo = document.querySelector('.result');
        if (resultInfo) {
            resultInfo.appendChild(countdownEl);
        } else {
            document.querySelector('.game-panel').appendChild(countdownEl);
        }

        return countdownEl;
    }

    // Switch between screens
    showScreen(screenId) {
        this.elements.gameScreens.forEach(screen => {
            screen.classList.remove('active');
        });

        document.getElementById(screenId).classList.add('active');
    }

    // Show error modal
    showError(message) {
        this.elements.errorMessage.textContent = message;
        this.elements.errorModal.style.display = 'flex';
    }

    // Update player status in multiplayer
    updatePlayersStatus(players, guessedPlayers = []) {
        const elements = this.elements;
        elements.playersStatusElement.innerHTML = '';

        // Create container for player items
        const statusContainer = document.createElement('div');
        statusContainer.className = 'waiting-players';

        players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';

            if (player.isHost) {
                playerItem.classList.add('host');
            }

            const playerName = document.createElement('span');
            playerName.textContent = player.username;

            const statusIndicator = document.createElement('div');
            statusIndicator.className = 'player-status';

            const indicator = document.createElement('div');
            indicator.className = 'status-indicator';

            if (guessedPlayers.includes(player.username) || player.hasGuessed) {
                indicator.classList.add('guessed');
                statusIndicator.appendChild(indicator);
                statusIndicator.appendChild(document.createTextNode('Geraten'));
            } else {
                statusIndicator.appendChild(indicator);
                statusIndicator.appendChild(document.createTextNode('Überlegt...'));
            }

            playerItem.appendChild(playerName);
            playerItem.appendChild(statusIndicator);
            statusContainer.appendChild(playerItem);
        });

        elements.playersStatusElement.appendChild(statusContainer);
    }

    // Update multiplayer leaderboard
    updateLeaderboard(players) {
        const tbody = this.elements.leaderboardElement.querySelector('tbody');
        tbody.innerHTML = '';

        players.forEach((player, index) => {
            const row = document.createElement('tr');

            const rankCell = document.createElement('td');
            rankCell.className = 'rank-column';
            rankCell.textContent = index + 1;

            const nameCell = document.createElement('td');
            nameCell.textContent = player.username;

            const scoreCell = document.createElement('td');
            scoreCell.textContent = player.score;

            const guessCell = document.createElement('td');
            guessCell.textContent = player.lastGuess || '--';

            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);
            row.appendChild(guessCell);

            // Highlight current player
            if (player.username === window.GameEngine.state.username) {
                row.classList.add('current-player');
            }

            tbody.appendChild(row);
        });
    }

    // Update score display
    updateScoreDisplay() {
        this.elements.playerScoreElement.textContent = window.GameEngine.state.score;
    }

    // Get message based on score percentage
    getScoreMessage(score) {
        const engine = window.GameEngine;
        const maxScore = engine.state.totalRounds * 1000; // Max possible score
        const percentage = (score / maxScore) * 100;

        // Use config for score messages
        const messages = window.GameConfig.resultMessages;
        for (const { threshold, message } of messages) {
            if (percentage >= threshold) {
                return message;
            }
        }

        // Default message if none matched
        return 'Weiter erkunden!';
    }

    // Populate game mode selectors
    populateGameModeSelectors() {
        const engine = window.GameEngine;
        const gameModes = engine.gameModes;

        // Populate mode selection grid
        const modeGrid = document.querySelector('.game-mode-grid');
        if (modeGrid) {
            modeGrid.innerHTML = '';

            if (!gameModes || gameModes.length === 0) {
                modeGrid.innerHTML = '<div style="text-align: center; padding: 20px;"><p>Keine Spielmodi verfügbar. Bitte Seite neu laden.</p></div>';
                console.error("No game modes available to populate selector");
                return;
            }

            // Create button for each game mode
            gameModes.forEach(mode => {
                // Get localized name
                let germanName = mode.name;
                if (mode.id === 'german-cities') germanName = 'Deutsche Städte';
                if (mode.id === 'european-cities') germanName = 'Europäische Städte';
                if (mode.id === 'countries') germanName = 'Länder';
                if (mode.id === 'capitals') germanName = 'Hauptstädte';
                if (mode.id === 'world-landmarks') germanName = 'Weltbekannte Wahrzeichen';

                const button = document.createElement('button');
                button.setAttribute('data-mode', mode.id);
                button.className = 'mode-button';
                button.textContent = `${germanName} (${mode.count})`;

                // Add click handler
                button.addEventListener('click', () => {
                    engine.state.gameMode = mode.id;
                    this.elements.currentGameModeElement.textContent = germanName;

                    window.MapUtils.updateMapLayer(engine.state.gameMode);

                    if (window.MapUtils.countryOutlines) {
                        window.MapUtils.countryOutlines.bringToBack();
                    }

                    // Set up for single player
                    engine.state.multiplayer = false;

                    // Show/hide relevant elements
                    if (this.elements.playersStatusElement) {
                        this.elements.playersStatusElement.style.display = 'none';
                    }

                    if (this.elements.leaderboardElement) {
                        document.getElementById('leaderboardContainer').style.display = 'block';
                    }

                    if (this.elements.currentRoomCodeElement) {
                        this.elements.currentRoomCodeElement.parentElement.style.display = 'none';
                    }

                    if (this.elements.startButton) {
                        this.elements.startButton.style.display = 'block';
                        this.elements.startButton.textContent = 'Spiel starten';
                    }

                    this.elements.timerElement.style.display = 'none';

                    this.showScreen('gameScreen');
                });

                modeGrid.appendChild(button);
            });
        }

        // Populate dropdown in create game form
        const modeSelect = this.elements.gameModeSelect;
        if (modeSelect) {
            modeSelect.innerHTML = '';

            if (!gameModes || gameModes.length === 0) {
                const option = document.createElement('option');
                option.value = "";
                option.textContent = "Keine Spielmodi verfügbar";
                modeSelect.appendChild(option);
                modeSelect.disabled = true;
                return;
            }

            // Add option for each mode
            gameModes.forEach(mode => {
                let germanName = mode.name;
                if (mode.id === 'german-cities') germanName = 'Deutsche Städte';
                if (mode.id === 'european-cities') germanName = 'Europäische Städte';
                if (mode.id === 'countries') germanName = 'Länder';
                if (mode.id === 'capitals') germanName = 'Hauptstädte';
                if (mode.id === 'world-landmarks') germanName = 'Weltbekannte Wahrzeichen';

                const option = document.createElement('option');
                option.value = mode.id;
                option.textContent = `${germanName} (${mode.count})`;
                modeSelect.appendChild(option);
            });
        }
    }

    // Reset UI to initial state
    resetUI() {
        const elements = this.elements;

        // Reset display elements
        elements.currentRoundElement.textContent = '0';
        elements.playerScoreElement.textContent = '0';
        elements.distanceElement.textContent = '--';
        elements.currentLocationElement.textContent = '-';
        elements.accuracyTextElement.textContent = '';
        elements.pointsEarnedElement.textContent = '';

        // Hide timer
        elements.timerElement.style.display = 'none';

        // Hide result countdown
        if (elements.resultCountdownElement) {
            elements.resultCountdownElement.style.display = 'none';
        }

        // Hide leaderboard
        if (elements.leaderboardElement && elements.leaderboardElement.parentElement) {
            document.getElementById('leaderboardContainer').style.display = 'none';
        }

        // Reset form fields
        if (elements.hostUsernameInput) elements.hostUsernameInput.value = '';
        if (elements.joinUsernameInput) elements.joinUsernameInput.value = '';
        if (elements.roomCodeInput) elements.roomCodeInput.value = '';

        // Reset multiplayer UI
        if (elements.waitingRoom) elements.waitingRoom.style.display = 'none';
        if (document.querySelector('.create-game-form')) {
            document.querySelector('.create-game-form').style.display = 'block';
        }
        if (elements.waitingForHost) elements.waitingForHost.style.display = 'none';
        if (elements.joinForm) elements.joinForm.style.display = 'block';
        if (elements.joinErrorMsg) elements.joinErrorMsg.textContent = '';

        // Set default result delay
        if (elements.resultDelayInput) elements.resultDelayInput.value = '10';
    }

    // Create a final leaderboard for game over screen
    createFinalLeaderboard(players) {
        const container = document.createElement('div');

        const table = document.createElement('table');
        table.className = 'leaderboard';

        // Create header row
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const headers = [
            { text: 'Rang', className: 'rank-column' },
            { text: 'Spieler', className: '' },
            { text: 'Punkte', className: '' }
        ];

        headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header.text;
            if (header.className) th.className = header.className;
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);

        // Create table body with player data
        const tbody = document.createElement('tbody');

        players.forEach((player, index) => {
            const row = document.createElement('tr');

            // Rank cell
            const rankCell = document.createElement('td');
            rankCell.textContent = index + 1;

            // Name cell
            const nameCell = document.createElement('td');
            nameCell.textContent = player.username;

            // Score cell
            const scoreCell = document.createElement('td');
            scoreCell.textContent = player.score;

            // Add all cells to row
            row.appendChild(rankCell);
            row.appendChild(nameCell);
            row.appendChild(scoreCell);

            // Highlight current player
            if (player.username === window.GameEngine.state.username) {
                row.style.fontWeight = 'bold';
            }

            tbody.appendChild(row);
        });

        // Assemble table
        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(table);

        return container;
    }
}

// Create and export a single instance
window.UIController = new UIController();