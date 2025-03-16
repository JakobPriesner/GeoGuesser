// Initialize the UI Controller module
window.UIController = {};

// Define elements object
const elements = {
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

    // Multiplayer screens and elements
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

    // Add the result countdown element
    resultCountdownElement: document.getElementById('resultCountdown') ||
        (() => {
            // Create the element if it doesn't exist
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

            // Find where to append it - we'll add it after the accuracy text
            const resultInfo = document.querySelector('.result');
            if (resultInfo) {
                resultInfo.appendChild(countdownEl);
            } else {
                document.querySelector('.game-panel').appendChild(countdownEl);
            }

            return countdownEl;
        })()
};

// Function to switch between screens
function showScreen(screenId) {
    elements.gameScreens.forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Show error modal
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorModal.style.display = 'flex';
}

// Update players status display for multiplayer
function updatePlayersStatus(players, guessedPlayers = []) {
    elements.playersStatusElement.innerHTML = '';

    // Create a container for the player status items
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

        if (guessedPlayers.includes(player.username)) {
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

// Update leaderboard
function updateLeaderboard(players) {
    const tbody = elements.leaderboardElement.querySelector('tbody');
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
        if (player.username === window.GameState.state.username) {
            row.classList.add('current-player');
        }

        tbody.appendChild(row);
    });
}

// Update score display
function updateScoreDisplay() {
    elements.playerScoreElement.textContent = window.GameState.state.score;
}

function getScoreMessage(score) {
    const maxScore = window.GameState.state.totalRounds * 100;
    const percentage = (score / maxScore) * 100;

    if (percentage >= 90) return 'Geographie-Genie!';
    if (percentage >= 75) return 'Ausgezeichnete Geographiekenntnisse!';
    if (percentage >= 60) return 'Gut gemacht!';
    if (percentage >= 40) return 'Nicht schlecht!';
    return 'Weiter erkunden!';
}

function populateGameModeSelectors() {
    const gameModes = window.GameState.gameModes;

    const modeGrid = document.querySelector('.game-mode-grid');
    if (modeGrid) {
        modeGrid.innerHTML = '';

        if (!gameModes || gameModes.length === 0) {
            modeGrid.innerHTML = '<div style="text-align: center; padding: 20px;"><p>Keine Spielmodi verfügbar. Bitte Seite neu laden.</p></div>';
            console.error("No game modes available to populate selector");
            return;
        }

        gameModes.forEach(mode => {
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

            button.addEventListener('click', function() {
                window.GameState.state.gameMode = this.getAttribute('data-mode');
                elements.currentGameModeElement.textContent = germanName;

                window.MapUtils.updateMapLayer(window.GameState.state.gameMode);

                if (window.MapUtils.countryOutlines) {
                    window.MapUtils.countryOutlines.bringToBack();
                }

                // Set up for single player
                window.GameState.state.multiplayer = false;

                // Show/hide relevant elements
                if (elements.playersStatusElement) elements.playersStatusElement.style.display = 'none';
                if (elements.leaderboardElement) document.getElementById('leaderboardContainer').style.display = 'block'; // Show leaderboard always
                if (elements.currentRoomCodeElement) elements.currentRoomCodeElement.parentElement.style.display = 'none';
                if (elements.startButton) {
                    elements.startButton.style.display = 'block';
                    elements.startButton.textContent = 'Spiel starten';
                }
                elements.timerElement.style.display = 'none';

                showScreen('gameScreen');
            });

            modeGrid.appendChild(button);
        });
    }

    // Game mode dropdown in create game form
    const modeSelect = elements.gameModeSelect;
    if (modeSelect) {
        modeSelect.innerHTML = '';

        // Check if we have game modes
        if (!gameModes || gameModes.length === 0) {
            const option = document.createElement('option');
            option.value = "";
            option.textContent = "Keine Spielmodi verfügbar";
            modeSelect.appendChild(option);
            modeSelect.disabled = true;
            return;
        }

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

function resetUI() {
    // Reset UI elements
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

    if (elements.leaderboardElement && elements.leaderboardElement.parentElement) {
        document.getElementById('leaderboardContainer').style.display = 'none';
    }

    if (elements.hostUsernameInput) elements.hostUsernameInput.value = '';
    if (elements.joinUsernameInput) elements.joinUsernameInput.value = '';
    if (elements.roomCodeInput) elements.roomCodeInput.value = '';

    if (elements.waitingRoom) elements.waitingRoom.style.display = 'none';
    if (document.querySelector('.create-game-form')) {
        document.querySelector('.create-game-form').style.display = 'block';
    }
    if (elements.waitingForHost) elements.waitingForHost.style.display = 'none';
    if (elements.joinForm) elements.joinForm.style.display = 'block';
    if (elements.joinErrorMsg) elements.joinErrorMsg.textContent = '';

    if (elements.resultDelayInput) elements.resultDelayInput.value = '10';
}

// Assign all functions to the UIController object
window.UIController.elements = elements;
window.UIController.showScreen = showScreen;
window.UIController.showError = showError;
window.UIController.updatePlayersStatus = updatePlayersStatus;
window.UIController.updateLeaderboard = updateLeaderboard;
window.UIController.updateScoreDisplay = updateScoreDisplay;
window.UIController.getScoreMessage = getScoreMessage;
window.UIController.populateGameModeSelectors = populateGameModeSelectors;
window.UIController.resetUI = resetUI;