// Pool Score Tracker - Complete Firebase Version
// This file contains all the logic for the pool score tracker app

// Replace with your Firebase configuration
var firebaseConfig = {
  apiKey: "AIzaSyDx1pPAOEDxaI4MRHvQChS9tvamc9sWuds",
  authDomain: "poolscoretracker-99754.firebaseapp.com",
  projectId: "poolscoretracker-99754",
  storageBucket: "poolscoretracker-99754.firebasestorage.app",
  messagingSenderId: "277496691173",
  appId: "1:277496691173:web:b547cca68b846e62ed970c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();

// App state
var appState = {
  view: 'game',                // Current view: 'game', 'profiles', 'stats'
  activeGame: null,            // Current active game
  players: [],                 // Players in the active game
  gameMode: 'standard',        // 'standard' or 'snooker'
  activePlayerId: null,        // ID of the active player
  playerProfiles: [],          // All player profiles
  editingProfile: null,        // Profile being edited
  completedGames: [],          // History of completed games
  selectedProfileForStats: null, // Profile selected for viewing stats
  customPointsPlayerId: null,  // Player ID for adding custom points
  showingNewGameModal: false,
  showingGameHistoryModal: false,
  showingGameResultsModal: false,
  showingEditProfileModal: false,
  showingDeleteProfileModal: false,
  showingCustomPointsModal: false,
  gameDurationTimer: null,     // Timer for updating the game duration clock
  gameDurationValues: null     // Object holding game duration values
};

// Utility function to determine if text should be white or black based on background color
function getContrastColor(hexColor) {
  // Default to black if invalid color
  if (!hexColor || hexColor === 'transparent') return '#000000';
  
  // Convert named colors to hex
  const colorMap = {
    'red': '#ff0000',
    'blue': '#0000ff',
    'green': '#008000',
    'yellow': '#ffff00',
    'purple': '#800080',
    'orange': '#ffa500',
    'brown': '#a52a2a',
    'black': '#000000',
    'pink': '#ffc0cb',
  };
  
  // If it's a named color, convert to hex
  hexColor = colorMap[hexColor.toLowerCase()] || hexColor;
  
  // Remove the hash if present
  hexColor = hexColor.replace('#', '');
  
  // Convert to RGB
  let r, g, b;
  if (hexColor.length === 3) {
    r = parseInt(hexColor.slice(0, 1).repeat(2), 16);
    g = parseInt(hexColor.slice(1, 2).repeat(2), 16);
    b = parseInt(hexColor.slice(2, 3).repeat(2), 16);
  } else {
    r = parseInt(hexColor.slice(0, 2), 16);
    g = parseInt(hexColor.slice(2, 4), 16);
    b = parseInt(hexColor.slice(4, 6), 16);
  }
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return white or black based on luminance
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

// DOM Elements
var loadingScreen = document.getElementById('loading-screen');
var appContainer = document.getElementById('app');
var gameView = document.getElementById('game-view');
var profilesList = document.getElementById('profiles-list');
var statsView = document.getElementById('stats-view');
var newGameModal = document.getElementById('new-game-modal');
var gameHistoryModal = document.getElementById('game-history-modal');
var gameResultsModal = document.getElementById('game-results-modal');
var editProfileModal = document.getElementById('edit-profile-modal');
var deleteProfileModal = document.getElementById('delete-profile-modal');
var customPointsModal = document.getElementById('custom-points-modal');
var gameHistoryContent = document.getElementById('game-history-content');
var gameResultsContent = document.getElementById('game-results-content');

// Function to update the live clock
function updateLiveClock() {
  if (!appState.activeGame || !appState.gameDurationValues || !appState.gameDurationValues.startTime) return;
  
  const clockElement = document.getElementById('live-clock');
  if (!clockElement) return;
  
  // Get the game start time - this is stored once when the game starts
  // and is never reset during game play
  const startTime = appState.gameDurationValues.startTime;
  const currentTime = new Date();
  const gameDurationMs = currentTime - startTime;
  
  // Calculate hours, minutes, seconds
  const totalSeconds = Math.floor(gameDurationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Format with leading zeros
  const formattedHours = hours.toString().padStart(2, '0');
  const formattedMinutes = minutes.toString().padStart(2, '0');
  const formattedSeconds = seconds.toString().padStart(2, '0');
  
  // Update the clock display
  clockElement.textContent = `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
  
  // Also update the stored values
  appState.gameDurationValues.hours = formattedHours;
  appState.gameDurationValues.minutes = formattedMinutes;
  appState.gameDurationValues.seconds = formattedSeconds;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing Pool Score Tracker...');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load player profiles
  loadPlayerProfiles().then(function() {
    // Hide loading screen
    loadingScreen.style.display = 'none';
    appContainer.style.display = 'block';
    
    // Load game state or show empty state
    checkForActiveGame();
  }).catch(function(error) {
    console.error('Error initializing app:', error);
    alert('Error initializing app: ' + error.message);
  });
});

// Set up event listeners
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.addEventListener('click', function() {
      var tabName = this.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
  
  // New Game Button (will be added dynamically)
  
  // Create Profile Button
  document.getElementById('create-profile-btn').addEventListener('click', function() {
    showEditProfileModal();
  });
  
  // New Game Modal
  document.getElementById('start-game-btn').addEventListener('click', handleStartNewGame);
  document.getElementById('cancel-new-game-btn').addEventListener('click', function() {
    toggleNewGameModal(false);
  });
  document.getElementById('add-player-btn').addEventListener('click', addPlayerInput);
  
  // Close buttons for all modals
  document.querySelectorAll('.modal .close').forEach(function(closeBtn) {
    closeBtn.addEventListener('click', function() {
      var modal = this.closest('.modal');
      if (modal.id === 'new-game-modal') toggleNewGameModal(false);
      else if (modal.id === 'game-history-modal') toggleGameHistoryModal(false);
      else if (modal.id === 'game-results-modal') toggleGameResultsModal(false);
      else if (modal.id === 'edit-profile-modal') toggleEditProfileModal(false);
      else if (modal.id === 'delete-profile-modal') toggleDeleteProfileModal(false);
      else if (modal.id === 'custom-points-modal') toggleCustomPointsModal(false);
    });
  });
  
  // Profile modals
  document.getElementById('save-profile-btn').addEventListener('click', saveProfile);
  document.getElementById('cancel-edit-profile-btn').addEventListener('click', function() {
    toggleEditProfileModal(false);
  });
  document.getElementById('confirm-delete-profile-btn').addEventListener('click', deleteProfile);
  document.getElementById('cancel-delete-profile-btn').addEventListener('click', function() {
    toggleDeleteProfileModal(false);
  });
  
  // Custom points modal
  document.getElementById('add-custom-points-btn').addEventListener('click', addCustomPoints);
  document.getElementById('cancel-custom-points-btn').addEventListener('click', function() {
    toggleCustomPointsModal(false);
  });
  
  // Game history modal
  document.getElementById('close-history-btn').addEventListener('click', function() {
    toggleGameHistoryModal(false);
  });
  
  // Game results modal
  document.getElementById('close-results-btn').addEventListener('click', function() {
    toggleGameResultsModal(false);
  });
  document.getElementById('new-game-from-results-btn').addEventListener('click', function() {
    toggleGameResultsModal(false);
    toggleNewGameModal(true);
  });
}

// Switch between tabs
function switchTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(function(tab) {
    tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(function(content) {
    content.classList.toggle('active', content.id === tabName + '-tab');
  });
  
  // Update app state
  appState.view = tabName;
  
  // Special handling for tabs
  if (tabName === 'profiles') {
    renderProfiles();
  } else if (tabName === 'stats') {
    renderStats();
  }
}

// Load player profiles from Firebase
async function loadPlayerProfiles() {
  try {
    const snapshot = await db.collection('playerProfiles').orderBy('firstName').get();
    appState.playerProfiles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // If no profiles exist, create some sample ones
    if (appState.playerProfiles.length === 0) {
      console.log('No profiles found, creating empty profiles array');
      appState.playerProfiles = [];
    }
    
    return appState.playerProfiles;
  } catch (error) {
    console.error('Error loading player profiles:', error);
    // Fallback to empty array
    appState.playerProfiles = [];
    return [];
  }
}

// Check if there's an active game
async function checkForActiveGame() {
  try {
    // Look for active games in Firebase
    const snapshot = await db.collection('games')
      .where('isCompleted', '==', false)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (!snapshot.empty) {
      // Found an active game
      const gameDoc = snapshot.docs[0];
      const game = {
        id: gameDoc.id,
        ...gameDoc.data()
      };
      
      // Load players for this game
      const playersSnapshot = await db.collection('players')
        .where('gameId', '==', game.id)
        .get();
      
      const players = playersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Set active game and players
      appState.activeGame = game;
      appState.players = players;
      appState.gameMode = game.gameMode || 'standard';
      appState.activePlayerId = game.activePlayerId || (players.length > 0 ? players[0].id : null);
      
      // Render the game view
      renderGameView();
      
      // Start the game timer
      // Clear any existing timer first
      if (appState.gameDurationTimer) {
        clearInterval(appState.gameDurationTimer);
      }
      
      // Start new timer for tracking elapsed game time
      appState.gameDurationTimer = setInterval(() => {
        if (!appState.activeGame || appState.activeGame.isCompleted) {
          clearInterval(appState.gameDurationTimer);
          appState.gameDurationTimer = null;
          return;
        }
        
        // Update the live clock
        updateLiveClock();
      }, 1000); // Update every second
    } else {
      // No active game, show empty state
      renderEmptyGameState();
    }
  } catch (error) {
    console.error('Error checking for active game:', error);
    renderEmptyGameState();
  }
}

// Render the empty game state
function renderEmptyGameState() {
  gameView.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">🎱</div>
      <h3>No Active Game</h3>
      <p>Start a new game to begin tracking scores!</p>
      <button id="show-new-game-btn" class="secondary">Start New Game</button>
      <button id="show-game-history-btn">View Game History</button>
    </div>
  `;
  
  // Add event listeners
  document.getElementById('show-new-game-btn').addEventListener('click', function() {
    toggleNewGameModal(true);
  });
  
  document.getElementById('show-game-history-btn').addEventListener('click', function() {
    loadGameHistory().then(function() {
      toggleGameHistoryModal(true);
    });
  });
}

// Render the game view - Optimized for single screen view
function renderGameView() {
  if (!appState.activeGame || !appState.players.length) {
    renderEmptyGameState();
    return;
  }
  
  const game = appState.activeGame;
  const players = appState.players;
  const activePlayer = players.find(p => p.id === appState.activePlayerId) || players[0];
  
  // Calculate the winning player (highest score)
  const maxScore = Math.max(...players.map(p => p.score || 0));
  const winningPlayers = players.filter(p => p.score === maxScore);
  
  // Only initialize the startTime if not already set
  if (!appState.gameDurationValues || !appState.gameDurationValues.startTime) {
    // Calculate game start time using the explicit startTime if available, otherwise createdAt
    const startTime = game.startTime 
      ? new Date(game.startTime.seconds * 1000) 
      : (game.createdAt ? new Date(game.createdAt.seconds * 1000) : new Date());
    
    // Initialize game duration values with the start time
    appState.gameDurationValues = {
      startTime: startTime,
      hours: '00',
      minutes: '00',
      seconds: '00'
    };
  }
  
  // Use the stored startTime for display
  updateLiveClock();
  
  // Get the formatted time from the live clock element
  const clockElement = document.getElementById('live-clock');
  const durationText = clockElement ? clockElement.textContent : '00:00:00';
  
  // Generate player cards HTML - Compact version
  const playerCardsHTML = players.map(player => {
    const isActive = player.id === appState.activePlayerId;
    const isWinning = player.score === maxScore && player.score > 0;
    
    // Get last 5 balls from player's history (if available)
    const ballHistory = player.ballsHistory || [];
    const lastFiveBalls = ballHistory.slice(-5).reverse(); // Get last 5 and reverse for newest first
    
    // Generate ball history HTML
    const ballHistoryHTML = lastFiveBalls.map(ball => {
      return `<span class="ball-history-item" style="background-color: ${ball.color}; color: ${getContrastColor(ball.color)};">${ball.value}</span>`;
    }).join('');
    
    return `
      <div class="player-card-compact ${isActive ? 'active' : ''} ${isWinning ? 'winning' : ''}">
        <div class="player-info">
          <span class="player-order">${players.indexOf(player) + 1}</span>
          <span class="player-name">${player.name}</span>
          <span class="score">${player.score || 0}</span>
        </div>
        <div class="ball-history">
          ${ballHistoryHTML || '<span class="no-balls">No balls scored yet</span>'}
        </div>
        <div class="player-actions">
          ${isActive ? 
            `<span class="active-badge">Active</span>` : 
            `<button class="set-active-btn small" data-player-id="${player.id}">Make Active</button>`
          }
        </div>
      </div>
    `;
  }).join('');
  
  // Generate scoring panel based on game mode - more compact
  const scoringPanelHTML = appState.gameMode === 'standard' 
    ? renderStandardScoringPanel() 
    : renderSnookerScoringPanel();
  
  // Render the complete game view with a 50/50 split layout
  gameView.innerHTML = `
    <div class="game-container">
      <!-- Top status bar with game info -->
      <div class="status-bar">
        <div>
          <strong>${game.name || 'Game'}</strong>
        </div>
        <div>
          Target: ${game.targetScore || 100} | Mode: ${game.gameMode === 'snooker' ? 'Snooker' : 'Standard'}
        </div>
      </div>
      
      <!-- Live clock display -->
      <div class="live-clock-container">
        <div id="live-clock">${durationText}</div>
      </div>
      
      <!-- Two-column layout - equal width for players and scoring -->
      <div class="game-layout-50-50">
        <!-- Left column: Player cards - equal width -->
        <div class="player-column-50">
          <h3>Players</h3>
          <div class="player-cards-container">
            ${playerCardsHTML}
          </div>
          <div class="action-buttons">
            <button id="undo-btn" class="secondary small">Undo</button>
            <button id="custom-points-btn" data-player-id="${activePlayer.id}" class="small">Custom Points</button>
            <button id="end-game-btn" class="danger small">End Game</button>
          </div>
        </div>
        
        <!-- Right column: Scoring panel - equal width -->
        <div class="scoring-column-50">
          <h3>Scoring for ${activePlayer.name}</h3>
          <div class="scoring-panel-compact">
            ${scoringPanelHTML}
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Add CSS for the new layout
  const styleElement = document.getElementById('game-dynamic-styles');
  if (!styleElement) {
    const newStyle = document.createElement('style');
    newStyle.id = 'game-dynamic-styles';
    newStyle.textContent = `
      .game-layout-50-50 {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
      }
      .player-column-50, .scoring-column-50 {
        flex: 1;
        min-width: 300px;
        max-width: calc(50% - 10px);
      }
      .live-clock-container {
        text-align: center;
        margin: 15px 0;
      }
      #live-clock {
        font-size: 24px;
        font-weight: bold;
        font-family: monospace;
        background: #333;
        color: #4cc9f0;
        padding: 10px 15px;
        border-radius: 5px;
        display: inline-block;
      }
      .player-cards-container {
        max-height: 350px;
        overflow-y: auto;
      }
      .ball-history {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin: 5px 0;
      }
      .ball-history-item {
        display: inline-block;
        width: 22px;
        height: 22px;
        line-height: 22px;
        text-align: center;
        border-radius: 50%;
        font-size: 11px;
        font-weight: bold;
      }
      .no-balls {
        font-size: 12px;
        color: #999;
        font-style: italic;
      }
    `;
    document.head.appendChild(newStyle);
  }
  
  // Add event listeners for buttons
  document.querySelectorAll('.set-active-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const playerId = this.getAttribute('data-player-id');
      setActivePlayer(playerId);
    });
  });
  
  document.querySelectorAll('.add-points-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      if (appState.gameMode === 'standard') {
        toggleCustomPointsModal(true, this.getAttribute('data-player-id'));
      }
    });
  });
  
  document.querySelectorAll('.custom-points-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      toggleCustomPointsModal(true, this.getAttribute('data-player-id'));
    });
  });
  
  // Add event listeners for score buttons based on game mode
  if (appState.gameMode === 'standard') {
    document.querySelectorAll('.ball-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const points = parseInt(this.getAttribute('data-points'));
        const ballColor = this.getAttribute('data-color');
        addPointsToPlayer(appState.activePlayerId, points, ballColor);
      });
    });
    
    // Special action buttons
    document.querySelectorAll('.special-action-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        handleSpecialAction(action);
      });
    });
  } else if (appState.gameMode === 'snooker') {
    document.querySelectorAll('.snooker-ball-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const points = parseInt(this.getAttribute('data-points'));
        const ballColor = this.getAttribute('data-color');
        addPointsToPlayer(appState.activePlayerId, points, ballColor);
      });
    });
    
    // Snooker special buttons
    document.querySelectorAll('.snooker-special-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const action = this.getAttribute('data-action');
        handleSnookerSpecialAction(action);
      });
    });
  }
  
  // Game control buttons
  document.getElementById('undo-btn').addEventListener('click', undoLastAction);
  document.getElementById('end-game-btn').addEventListener('click', endGame);
}

// Render standard scoring panel - compact version
function renderStandardScoringPanel() {
  return `
    <div class="scoring-grid">
      <div class="scoring-row">
        <button class="ball-btn yellow small" data-points="1" data-color="yellow">1</button>
        <button class="ball-btn blue small" data-points="2" data-color="blue">2</button>
        <button class="ball-btn red small" data-points="3" data-color="red">3</button>
        <button class="ball-btn purple small" data-points="4" data-color="purple">4</button>
        <button class="ball-btn orange small" data-points="5" data-color="orange">5</button>
      </div>
      <div class="scoring-row">
        <button class="ball-btn green small" data-points="6" data-color="green">6</button>
        <button class="ball-btn brown small" data-points="7" data-color="brown">7</button>
        <button class="ball-btn black small" data-points="8" data-color="black">8</button>
        <button class="ball-btn yellow small" data-points="9" data-color="yellow">9</button>
        <button class="ball-btn blue small" data-points="10" data-color="blue">10</button>
      </div>
      <div class="scoring-row">
        <button class="ball-btn red small" data-points="11" data-color="red">11</button>
        <button class="ball-btn purple small" data-points="12" data-color="purple">12</button>
        <button class="ball-btn orange small" data-points="13" data-color="orange">13</button>
        <button class="ball-btn green small" data-points="14" data-color="green">14</button>
        <button class="ball-btn brown small" data-points="15" data-color="brown">15</button>
      </div>
    </div>
    
    <div class="special-actions">
      <div class="special-actions-title">Special Actions</div>
      <div class="special-actions-grid">
        <button class="special-action-btn small" data-action="reset-to-zero">Reset to 0</button>
        <button class="special-action-btn small" data-action="reset-to-minus">Reset to -15</button>
        <button class="special-action-btn small" data-action="reset-to-fifty">Reset to 50</button>
        <button class="special-action-btn small" data-action="penalty-to-opponent">Add Penalty</button>
      </div>
    </div>
  `;
}

// Render snooker scoring panel - compact version
function renderSnookerScoringPanel() {
  return `
    <div class="scoring-grid">
      <div class="scoring-row">
        <button class="snooker-ball-btn red small" data-points="1" data-color="red">Red (1)</button>
        <button class="snooker-ball-btn yellow small" data-points="2" data-color="yellow">Yellow (2)</button>
        <button class="snooker-ball-btn green small" data-points="3" data-color="green">Green (3)</button>
      </div>
      <div class="scoring-row">
        <button class="snooker-ball-btn brown small" data-points="4" data-color="brown">Brown (4)</button>
        <button class="snooker-ball-btn blue small" data-points="5" data-color="blue">Blue (5)</button>
        <button class="snooker-ball-btn pink small" data-points="6" data-color="pink">Pink (6)</button>
      </div>
      <div class="scoring-row">
        <button class="snooker-ball-btn black small" data-points="7" data-color="black">Black (7)</button>
        <button class="snooker-special-btn small" data-action="reset-to-zero">Reset to 0</button>
        <button class="snooker-special-btn small" data-action="penalty-to-opponent">Add Penalty (4)</button>
      </div>
    </div>
  `;
}

// Render profiles
function renderProfiles() {
  if (!appState.playerProfiles.length) {
    profilesList.innerHTML = `
      <div class="empty-state">
        <p>No player profiles yet. Create your first profile!</p>
      </div>
    `;
    return;
  }
  
  profilesList.innerHTML = appState.playerProfiles.map(profile => {
    const displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
    return `
      <div class="player-card" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div class="player-name">${displayName}</div>
          ${profile.nickname ? `<div style="color: #6c757d;">Nickname: ${profile.nickname}</div>` : ''}
        </div>
        <div>
          <button class="view-stats-btn" data-profile-id="${profile.id}">Stats</button>
          <button class="edit-profile-btn" data-profile-id="${profile.id}">Edit</button>
          <button class="delete-profile-btn danger" data-profile-id="${profile.id}">Delete</button>
        </div>
      </div>
    `;
  }).join('');
  
  // Add event listeners
  document.querySelectorAll('.view-stats-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const profileId = this.getAttribute('data-profile-id');
      appState.selectedProfileForStats = appState.playerProfiles.find(p => p.id === profileId);
      switchTab('stats');
    });
  });
  
  document.querySelectorAll('.edit-profile-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const profileId = this.getAttribute('data-profile-id');
      const profile = appState.playerProfiles.find(p => p.id === profileId);
      if (profile) {
        showEditProfileModal(profile);
      }
    });
  });
  
  document.querySelectorAll('.delete-profile-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const profileId = this.getAttribute('data-profile-id');
      const profile = appState.playerProfiles.find(p => p.id === profileId);
      if (profile) {
        showDeleteProfileModal(profile);
      }
    });
  });
}

// Render stats
function renderStats() {
  if (!appState.selectedProfileForStats) {
    statsView.innerHTML = `
      <div class="empty-state">
        <p>Select a player profile to view their stats.</p>
        <button id="go-to-profiles-btn">Go to Profiles</button>
      </div>
    `;
    
    document.getElementById('go-to-profiles-btn').addEventListener('click', function() {
      switchTab('profiles');
    });
    return;
  }
  
  // Get the selected profile
  const profile = appState.selectedProfileForStats;
  
  // Show loading state
  statsView.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h3>${[profile.firstName, profile.lastName].filter(Boolean).join(' ')} - Statistics</h3>
      </div>
      <div class="card-body" style="text-align: center;">
        <div class="loading-spinner"></div>
        <p>Loading player statistics...</p>
      </div>
    </div>
  `;
  
  // Calculate stats from Firebase data
  calculatePlayerStats(profile.id).then(stats => {
    // Get player's game history
    getPlayerGameHistory(profile.id).then(gameHistory => {
      statsView.innerHTML = `
        <div class="card">
          <div class="card-header">
            <h3>${[profile.firstName, profile.lastName].filter(Boolean).join(' ')} - Statistics</h3>
          </div>
          <div class="card-body">
            <!-- Summary Stats Cards -->
            <div class="row">
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Games Played</div>
                  <div class="stat-value">${stats.gamesPlayed}</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Wins</div>
                  <div class="stat-value">${stats.wins}</div>
                  <div class="stat-secondary">Win rate: ${stats.winRate}%</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Average Score</div>
                  <div class="stat-value">${stats.averageScore}</div>
                </div>
              </div>
            </div>
            
            <div class="row" style="margin-top: 15px;">
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Highest Score</div>
                  <div class="stat-value">${stats.highestScore}</div>
                  ${stats.highestScoreGameName ? `<div class="stat-secondary">in ${stats.highestScoreGameName}</div>` : ''}
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Favorite Ball</div>
                  <div class="stat-value">${stats.favoriteBall || 'N/A'}</div>
                  ${stats.favoriteBallCount ? `<div class="stat-secondary">Used ${stats.favoriteBallCount} times</div>` : ''}
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Points Per Game</div>
                  <div class="stat-value">${stats.pointsPerGame}</div>
                </div>
              </div>
            </div>
            
            <!-- Game Duration Stats -->
            <div class="row" style="margin-top: 15px;">
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Average Game Duration</div>
                  <div class="stat-value">${stats.formattedAverageDuration || 'N/A'}</div>
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Shortest Game</div>
                  <div class="stat-value">${stats.formattedShortestGame}</div>
                  ${stats.shortestGameName ? `<div class="stat-secondary">${stats.shortestGameName}</div>` : ''}
                </div>
              </div>
              <div class="col-md-4">
                <div class="stat-card">
                  <div class="stat-title">Longest Game</div>
                  <div class="stat-value">${stats.formattedLongestGame}</div>
                  ${stats.longestGameName ? `<div class="stat-secondary">${stats.longestGameName}</div>` : ''}
                </div>
              </div>
            </div>

            <!-- Ball Distribution Chart -->
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h4>Ball Distribution</h4>
              </div>
              <div class="card-body">
                ${renderBallDistributionChart(stats.ballDistribution)}
              </div>
            </div>
            
            <!-- Performance Over Time -->
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h4>Performance History</h4>
              </div>
              <div class="card-body">
                ${renderPerformanceHistory(gameHistory, stats)}
              </div>
            </div>
            
            <!-- Game History Table -->
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h4>Game History</h4>
              </div>
              <div class="card-body">
                ${renderGameHistoryTable(gameHistory)}
              </div>
            </div>
            
            <!-- Win/Loss Record By Game Mode -->
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h4>Win/Loss Record By Game Mode</h4>
              </div>
              <div class="card-body">
                ${renderWinLossByGameMode(stats.winLossByGameMode)}
              </div>
            </div>
            
            <!-- Recent Opponents -->
            <div class="card" style="margin-top: 20px;">
              <div class="card-header">
                <h4>Recent Opponents</h4>
              </div>
              <div class="card-body">
                ${renderRecentOpponents(stats.recentOpponents)}
              </div>
            </div>
            
            <div style="margin-top: 20px; text-align: right;">
              <button id="back-to-profiles-btn">Back to Profiles</button>
            </div>
          </div>
        </div>
      `;
      
      document.getElementById('back-to-profiles-btn').addEventListener('click', function() {
        switchTab('profiles');
      });
    });
  }).catch(error => {
    console.error('Error rendering stats:', error);
    statsView.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>${[profile.firstName, profile.lastName].filter(Boolean).join(' ')} - Statistics</h3>
        </div>
        <div class="card-body">
          <div class="empty-state">
            <p>Error loading statistics: ${error.message}</p>
            <button id="back-to-profiles-btn">Back to Profiles</button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('back-to-profiles-btn').addEventListener('click', function() {
      switchTab('profiles');
    });
  });
}

// Render ball distribution chart
function renderBallDistributionChart(ballDistribution) {
  if (!ballDistribution || Object.keys(ballDistribution).length === 0) {
    return `<div class="empty-state">No ball data available</div>`;
  }
  
  // Set ball colors
  const ballColors = {
    red: '#e74c3c',
    yellow: '#f1c40f',
    green: '#2ecc71',
    brown: '#795548',
    blue: '#3498db',
    pink: '#e84393',
    black: '#000000',
    custom: '#95a5a6',
    penalty: '#e67e22'
  };
  
  // Sort by count descending
  const sortedBalls = Object.entries(ballDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);  // Take the top 10
  
  // Calculate the max value for scaling
  const maxValue = Math.max(...sortedBalls.map(ball => ball[1]));
  
  // Generate HTML for the chart
  const barsHTML = sortedBalls.map(([ballType, count]) => {
    const percentage = Math.round((count / maxValue) * 100);
    const color = ballColors[ballType.toLowerCase()] || '#95a5a6';
    
    return `
      <div style="margin-bottom: 10px;">
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="width: 20px; height: 20px; border-radius: 50%; background-color: ${color}; margin-right: 10px;"></div>
          <div>${ballType.charAt(0).toUpperCase() + ballType.slice(1)}</div>
          <div style="margin-left: auto;">${count} times</div>
        </div>
        <div style="width: 100%; background-color: #eee; height: 10px; border-radius: 5px;">
          <div style="width: ${percentage}%; background-color: ${color}; height: 10px; border-radius: 5px;"></div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="ball-distribution-chart">
      ${barsHTML}
    </div>
  `;
}

// Render performance history chart
function renderPerformanceHistory(gameHistory, stats) {
  if (!gameHistory || gameHistory.length === 0) {
    return `<div class="empty-state">No game history available</div>`;
  }
  
  // Sort games by date (oldest first)
  const sortedGames = [...gameHistory].sort((a, b) => {
    return a.game.completedAt.seconds - b.game.completedAt.seconds;
  });
  
  // Get last 10 games or all if less than 10
  const recentGames = sortedGames.slice(-10);
  
  // Calculate the running average score
  let totalScore = 0;
  const runningAverages = recentGames.map((gameData, index) => {
    totalScore += gameData.player.score || 0;
    return Math.round(totalScore / (index + 1));
  });
  
  // Generate HTML for the chart
  const gamesHTML = recentGames.map((gameData, index) => {
    const date = new Date(gameData.game.completedAt.seconds * 1000).toLocaleDateString();
    const isWin = gameData.game.winnerId === gameData.player.id;
    const scorePercent = Math.min(Math.round(((gameData.player.score || 0) / stats.highestScore) * 100), 100);
    
    return `
      <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
        <div style="height: 150px; width: 30px; background-color: #eee; margin-bottom: 10px; position: relative;">
          <div style="position: absolute; bottom: 0; width: 100%; height: ${scorePercent}%; background-color: ${isWin ? '#4cc9f0' : '#6c757d'}; border-top-left-radius: 3px; border-top-right-radius: 3px;"></div>
        </div>
        <div style="font-size: 12px; writing-mode: vertical-rl; transform: rotate(180deg); margin-bottom: 5px; height: 40px; text-align: center; overflow: hidden;">
          ${gameData.player.score || 0}pts
        </div>
        <div style="font-size: 10px; color: #6c757d; width: 30px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${date}
        </div>
        <div style="font-size: 10px; margin-top: 5px; color: ${isWin ? '#4cc9f0' : '#6c757d'}; font-weight: ${isWin ? 'bold' : 'normal'};">
          ${isWin ? 'W' : 'L'}
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div>
      <h5>Last ${recentGames.length} Games</h5>
      <div style="display: flex; justify-content: space-around; margin-top: 20px; margin-bottom: 20px;">
        ${gamesHTML}
      </div>
      <div style="text-align: center; margin-top: 10px; color: #6c757d;">
        Average score: <strong>${stats.averageScore}</strong> | Highest score: <strong>${stats.highestScore}</strong>
      </div>
    </div>
  `;
}

// Render game history table
function renderGameHistoryTable(gameHistory) {
  if (!gameHistory || gameHistory.length === 0) {
    return `<div class="empty-state">No game history available</div>`;
  }
  
  // Sort games by date (newest first)
  const sortedGames = [...gameHistory].sort((a, b) => {
    return b.game.completedAt.seconds - a.game.completedAt.seconds;
  });
  
  // Generate HTML for the table
  const rowsHTML = sortedGames.map(gameData => {
    const date = new Date(gameData.game.completedAt.seconds * 1000).toLocaleDateString();
    const isWin = gameData.game.winnerId === gameData.player.id;
    const gameMode = gameData.game.gameMode === 'snooker' ? 'Snooker' : 'Standard';
    
    // Get opponents
    const opponents = gameData.opponents.map(opp => opp.name).join(', ');
    
    return `
      <tr>
        <td>${date}</td>
        <td>${gameData.game.name || 'Unnamed Game'}</td>
        <td>${gameMode}</td>
        <td>${gameData.player.score || 0}</td>
        <td>${opponents}</td>
        <td>
          <span style="color: ${isWin ? '#4cc9f0' : '#6c757d'}; font-weight: ${isWin ? 'bold' : 'normal'};">
            ${isWin ? 'Win' : 'Loss'}
          </span>
        </td>
      </tr>
    `;
  }).join('');
  
  return `
    <div class="table-responsive">
      <table class="table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th>Date</th>
            <th>Game</th>
            <th>Mode</th>
            <th>Score</th>
            <th>Opponents</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    </div>
  `;
}

// Render win/loss by game mode
function renderWinLossByGameMode(winLossByGameMode) {
  if (!winLossByGameMode || Object.keys(winLossByGameMode).length === 0) {
    return `<div class="empty-state">No game mode data available</div>`;
  }
  
  const modesHTML = Object.entries(winLossByGameMode).map(([mode, data]) => {
    const total = data.wins + data.losses;
    const winRate = total > 0 ? Math.round((data.wins / total) * 100) : 0;
    const winWidth = total > 0 ? (data.wins / total) * 100 : 0;
    const lossWidth = total > 0 ? (data.losses / total) * 100 : 0;
    
    return `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <div><strong>${mode}</strong></div>
          <div>${data.wins} wins, ${data.losses} losses (${winRate}% win rate)</div>
        </div>
        <div style="display: flex; height: 20px; border-radius: 10px; overflow: hidden;">
          <div style="width: ${winWidth}%; background-color: #4cc9f0;"></div>
          <div style="width: ${lossWidth}%; background-color: #6c757d;"></div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="win-loss-by-mode">
      ${modesHTML}
    </div>
  `;
}

// Render recent opponents
function renderRecentOpponents(recentOpponents) {
  if (!recentOpponents || recentOpponents.length === 0) {
    return `<div class="empty-state">No opponent data available</div>`;
  }
  
  const opponentsHTML = recentOpponents.map(opponent => {
    const winRate = opponent.gamesPlayed > 0 ? Math.round((opponent.wins / opponent.gamesPlayed) * 100) : 0;
    
    return `
      <div class="player-card" style="margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div class="player-name">${opponent.name}</div>
            <div style="color: #6c757d;">Played ${opponent.gamesPlayed} times</div>
          </div>
          <div>
            <div style="text-align: right;">Win rate: <strong>${winRate}%</strong></div>
            <div style="text-align: right;">${opponent.wins} wins, ${opponent.gamesPlayed - opponent.wins} losses</div>
          </div>
        </div>
        <div style="margin-top: 10px; height: 5px; background-color: #eee; border-radius: 2.5px;">
          <div style="height: 100%; width: ${winRate}%; background-color: #4cc9f0; border-radius: 2.5px;"></div>
        </div>
      </div>
    `;
  }).join('');
  
  return `
    <div class="recent-opponents">
      ${opponentsHTML}
    </div>
  `;
}

// Get player's game history
async function getPlayerGameHistory(profileId) {
  try {
    // Get all players with this profile ID
    const playersSnapshot = await db.collection('players')
      .where('profileId', '==', profileId)
      .get();
    
    if (playersSnapshot.empty) {
      return [];
    }
    
    const playerEntries = playersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Get all games for these players
    const gameIds = [...new Set(playerEntries.map(p => p.gameId))];
    
    // Create array to hold game history
    const gameHistory = [];
    
    // For each game, get all players
    for (const gameId of gameIds) {
      // Get the game
      const gameDoc = await db.collection('games').doc(gameId).get();
      if (!gameDoc.exists || !gameDoc.data().isCompleted) continue;
      
      const game = {
        id: gameDoc.id,
        ...gameDoc.data()
      };
      
      // Get all players in this game
      const gamePlayersSnapshot = await db.collection('players')
        .where('gameId', '==', gameId)
        .get();
      
      const gamePlayers = gamePlayersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Find the player with this profile
      const player = gamePlayers.find(p => p.profileId === profileId);
      if (!player) continue;
      
      // Get opponents (all players except the current one)
      const opponents = gamePlayers.filter(p => p.id !== player.id);
      
      // Add to game history
      gameHistory.push({
        game,
        player,
        opponents
      });
    }
    
    return gameHistory;
  } catch (error) {
    console.error('Error getting player game history:', error);
    return [];
  }
}

// Calculate player stats
async function calculatePlayerStats(profileId) {
  try {
    // Get player's game history
    const gameHistory = await getPlayerGameHistory(profileId);
    
    if (gameHistory.length === 0) {
      return {
        gamesPlayed: 0,
        wins: 0,
        winRate: 0,
        averageScore: 0,
        highestScore: 0,
        highestScoreGameName: null,
        favoriteBall: 'N/A',
        favoriteBallCount: 0,
        pointsPerGame: 0,
        ballDistribution: {},
        winLossByGameMode: {
          'Standard': { wins: 0, losses: 0 },
          'Snooker': { wins: 0, losses: 0 }
        },
        recentOpponents: []
      };
    }
    
    // Initialize stats
    const gamesPlayed = gameHistory.length;
    let wins = 0;
    let totalScore = 0;
    let highestScore = 0;
    let highestScoreGameName = null;
    const ballCounts = {};
    const winLossByGameMode = {
      'Standard': { wins: 0, losses: 0 },
      'Snooker': { wins: 0, losses: 0 }
    };
    const opponentStats = {};
    
    // Process each game
    for (const entry of gameHistory) {
      const { game, player, opponents } = entry;
      
      // Track scores
      const playerScore = player.score || 0;
      totalScore += playerScore;
      
      // Track highest score
      if (playerScore > highestScore) {
        highestScore = playerScore;
        highestScoreGameName = game.name || `Game on ${new Date(game.completedAt.seconds * 1000).toLocaleDateString()}`;
      }
      
      // Track wins and game mode stats
      const isWin = game.winnerId === player.id;
      const gameMode = game.gameMode === 'snooker' ? 'Snooker' : 'Standard';
      
      if (isWin) {
        wins++;
        winLossByGameMode[gameMode].wins++;
      } else {
        winLossByGameMode[gameMode].losses++;
      }
      
      // Track balls
      if (player.ballsHistory && Array.isArray(player.ballsHistory)) {
        player.ballsHistory.forEach(ball => {
          const ballType = ball.color || 'unknown';
          ballCounts[ballType] = (ballCounts[ballType] || 0) + 1;
        });
      }
      
      // Track opponents
      for (const opponent of opponents) {
        const opponentName = opponent.name;
        if (!opponentStats[opponentName]) {
          opponentStats[opponentName] = {
            name: opponentName,
            gamesPlayed: 0,
            wins: 0
          };
        }
        
        opponentStats[opponentName].gamesPlayed++;
        if (isWin) {
          opponentStats[opponentName].wins++;
        }
      }
    }
    
    // Calculate favorite ball
    let favoriteBall = 'N/A';
    let favoriteBallCount = 0;
    for (const [ball, count] of Object.entries(ballCounts)) {
      if (count > favoriteBallCount) {
        favoriteBallCount = count;
        favoriteBall = ball;
      }
    }
    
    // Calculate averages
    const averageScore = gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0;
    const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
    const pointsPerGame = gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0;
    
    // Calculate average game duration
    let totalDuration = 0;
    let gamesWithDuration = 0;
    let shortestGame = Number.MAX_SAFE_INTEGER;
    let longestGame = 0;
    let shortestGameName = null;
    let longestGameName = null;
    
    for (const entry of gameHistory) {
      const { game } = entry;
      if (game.durationMinutes) {
        totalDuration += game.durationMinutes;
        gamesWithDuration++;
        
        // Track shortest game
        if (game.durationMinutes < shortestGame) {
          shortestGame = game.durationMinutes;
          shortestGameName = game.name || `Game on ${new Date(game.completedAt.seconds * 1000).toLocaleDateString()}`;
        }
        
        // Track longest game
        if (game.durationMinutes > longestGame) {
          longestGame = game.durationMinutes;
          longestGameName = game.name || `Game on ${new Date(game.completedAt.seconds * 1000).toLocaleDateString()}`;
        }
      }
    }
    
    const averageDuration = gamesWithDuration > 0 ? Math.round(totalDuration / gamesWithDuration) : 0;
    
    // Format duration values for display
    const formatDuration = (minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };
    
    // Get top opponents (most games played)
    const recentOpponents = Object.values(opponentStats)
      .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
      .slice(0, 5);
    
    return {
      gamesPlayed,
      wins,
      winRate,
      averageScore,
      highestScore,
      highestScoreGameName,
      favoriteBall: favoriteBall.charAt(0).toUpperCase() + favoriteBall.slice(1),
      favoriteBallCount,
      pointsPerGame,
      ballDistribution: ballCounts,
      winLossByGameMode,
      recentOpponents,
      // Duration statistics
      averageDuration,
      formattedAverageDuration: formatDuration(averageDuration),
      shortestGame: shortestGame !== Number.MAX_SAFE_INTEGER ? shortestGame : 0,
      formattedShortestGame: shortestGame !== Number.MAX_SAFE_INTEGER ? formatDuration(shortestGame) : 'N/A',
      shortestGameName,
      longestGame,
      formattedLongestGame: longestGame > 0 ? formatDuration(longestGame) : 'N/A',
      longestGameName
    };
  } catch (error) {
    console.error('Error calculating player stats:', error);
    return {
      gamesPlayed: 0,
      wins: 0,
      winRate: 0,
      averageScore: 0,
      highestScore: 0,
      highestScoreGameName: null,
      favoriteBall: 'N/A',
      favoriteBallCount: 0,
      pointsPerGame: 0,
      ballDistribution: {},
      winLossByGameMode: {
        'Standard': { wins: 0, losses: 0 },
        'Snooker': { wins: 0, losses: 0 }
      },
      recentOpponents: [],
      // Duration statistics defaults
      averageDuration: 0,
      formattedAverageDuration: 'N/A',
      shortestGame: 0,
      formattedShortestGame: 'N/A',
      shortestGameName: null,
      longestGame: 0,
      formattedLongestGame: 'N/A',
      longestGameName: null
    };
  }
}

// Show edit profile modal
function showEditProfileModal(profile = null) {
  appState.editingProfile = profile;
  
  document.getElementById('edit-profile-title').textContent = profile ? 'Edit Player Profile' : 'Create Player Profile';
  document.getElementById('edit-profile-id').value = profile ? profile.id : '';
  document.getElementById('profile-first-name').value = profile ? profile.firstName : '';
  document.getElementById('profile-last-name').value = profile ? profile.lastName : '';
  document.getElementById('profile-nickname').value = profile ? (profile.nickname || '') : '';
  
  toggleEditProfileModal(true);
}

// Show delete profile modal
function showDeleteProfileModal(profile) {
  if (!profile) return;
  
  document.getElementById('delete-profile-name').textContent = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  document.getElementById('delete-profile-id').value = profile.id;
  
  toggleDeleteProfileModal(true);
}

// Save profile
async function saveProfile() {
  const firstName = document.getElementById('profile-first-name').value.trim();
  const lastName = document.getElementById('profile-last-name').value.trim();
  const nickname = document.getElementById('profile-nickname').value.trim();
  const profileId = document.getElementById('edit-profile-id').value;
  
  if (!firstName || !lastName) {
    alert('First and last name are required!');
    return;
  }
  
  try {
    if (profileId) {
      // Update existing profile
      await db.collection('playerProfiles').doc(profileId).update({
        firstName,
        lastName,
        nickname: nickname || null,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Update local state
      const index = appState.playerProfiles.findIndex(p => p.id === profileId);
      if (index !== -1) {
        appState.playerProfiles[index] = {
          ...appState.playerProfiles[index],
          firstName,
          lastName,
          nickname: nickname || null
        };
      }
    } else {
      // Create new profile
      const docRef = await db.collection('playerProfiles').add({
        firstName,
        lastName,
        nickname: nickname || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      
      // Add to local state
      appState.playerProfiles.push({
        id: docRef.id,
        firstName,
        lastName,
        nickname: nickname || null
      });
    }
    
    // Close modal and refresh profiles
    toggleEditProfileModal(false);
    renderProfiles();
  } catch (error) {
    console.error('Error saving profile:', error);
    alert('Error saving profile: ' + error.message);
  }
}

// Delete profile
async function deleteProfile() {
  const profileId = document.getElementById('delete-profile-id').value;
  
  if (!profileId) return;
  
  try {
    // Delete profile from Firebase
    await db.collection('playerProfiles').doc(profileId).delete();
    
    // Remove from local state
    appState.playerProfiles = appState.playerProfiles.filter(p => p.id !== profileId);
    
    // Close modal and refresh profiles
    toggleDeleteProfileModal(false);
    renderProfiles();
  } catch (error) {
    console.error('Error deleting profile:', error);
    alert('Error deleting profile: ' + error.message);
  }
}

// Set active player
async function setActivePlayer(playerId) {
  try {
    if (!appState.activeGame) return;
    
    // Update game in Firebase
    await db.collection('games').doc(appState.activeGame.id).update({
      activePlayerId: playerId
    });
    
    // Update local state
    appState.activePlayerId = playerId;
    
    // Re-render game view
    renderGameView();
  } catch (error) {
    console.error('Error setting active player:', error);
    alert('Error setting active player: ' + error.message);
  }
}

// Add points to player
async function addPointsToPlayer(playerId, points, ballColor) {
  try {
    const player = appState.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Create the ball object
    const ball = {
      color: ballColor,
      value: points
    };
    
    // Record this action for undo
    await recordAction({
      gameId: appState.activeGame.id,
      playerId: playerId,
      actionType: 'add_points',
      points: points,
      ball: ball,
      previousScore: player.score || 0
    });
    
    // Update player in Firebase
    const newScore = (player.score || 0) + points;
    const ballsHistory = [...(player.ballsHistory || []), ball];
    
    await db.collection('players').doc(playerId).update({
      score: newScore,
      ballsHistory: ballsHistory
    });
    
    // Update local state
    player.score = newScore;
    player.ballsHistory = ballsHistory;
    
    // Check if game is complete
    checkGameCompletion();
    
    // Re-render game view
    renderGameView();
  } catch (error) {
    console.error('Error adding points to player:', error);
    alert('Error adding points: ' + error.message);
  }
}

// Add custom points
function addCustomPoints() {
  const points = parseInt(document.getElementById('custom-points').value);
  const playerId = appState.customPointsPlayerId;
  
  if (isNaN(points) || !playerId) {
    alert('Please enter a valid number of points.');
    return;
  }
  
  addPointsToPlayer(playerId, points, 'custom');
  toggleCustomPointsModal(false);
}

// Handle special actions for standard game
function handleSpecialAction(action) {
  if (!appState.activePlayerId) return;
  
  switch (action) {
    case 'reset-to-zero':
      resetPlayerScore(appState.activePlayerId, 0);
      break;
    case 'reset-to-minus':
      resetPlayerScore(appState.activePlayerId, -15);
      break;
    case 'reset-to-fifty':
      resetPlayerScore(appState.activePlayerId, 50);
      break;
    case 'penalty-to-opponent':
      addPenaltyToOpponent();
      break;
  }
}

// Handle special actions for snooker game
function handleSnookerSpecialAction(action) {
  if (!appState.activePlayerId) return;
  
  switch (action) {
    case 'reset-to-zero':
      resetPlayerScore(appState.activePlayerId, 0);
      break;
    case 'penalty-to-opponent':
      addSnookerPenaltyToOpponent();
      break;
  }
}

// Reset player score
async function resetPlayerScore(playerId, newScore) {
  try {
    const player = appState.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Record this action for undo
    await recordAction({
      gameId: appState.activeGame.id,
      playerId: playerId,
      actionType: 'reset_score',
      previousScore: player.score || 0,
      newScore: newScore
    });
    
    // Update player in Firebase
    await db.collection('players').doc(playerId).update({
      score: newScore
    });
    
    // Update local state
    player.score = newScore;
    
    // Re-render game view
    renderGameView();
  } catch (error) {
    console.error('Error resetting player score:', error);
    alert('Error resetting score: ' + error.message);
  }
}

// Add penalty to opponent (standard game)
function addPenaltyToOpponent() {
  if (appState.players.length < 2) return;
  
  const activePlayer = appState.players.find(p => p.id === appState.activePlayerId);
  if (!activePlayer) return;
  
  // Find opponent (next player)
  const activePlayerIndex = appState.players.indexOf(activePlayer);
  const opponentIndex = (activePlayerIndex + 1) % appState.players.length;
  const opponent = appState.players[opponentIndex];
  
  // Add penalty of 15 points
  addPointsToPlayer(opponent.id, -15, 'penalty');
}

// Add penalty to opponent (snooker game)
function addSnookerPenaltyToOpponent() {
  if (appState.players.length < 2) return;
  
  const activePlayer = appState.players.find(p => p.id === appState.activePlayerId);
  if (!activePlayer) return;
  
  // Find opponent (there should be exactly 2 players in snooker)
  const opponent = appState.players.find(p => p.id !== appState.activePlayerId);
  if (!opponent) return;
  
  // Add penalty of 7 points
  addPointsToPlayer(opponent.id, 7, 'penalty');
}

// Record an action for undo
async function recordAction(action) {
  try {
    // Add timestamp
    action.timestamp = firebase.firestore.FieldValue.serverTimestamp();
    
    // Add to Firebase
    const docRef = await db.collection('actions').add(action);
    
    console.log('Action recorded:', action);
    return {
      id: docRef.id,
      ...action
    };
  } catch (error) {
    console.error('Error recording action:', error);
    throw error;
  }
}

// Undo last action
async function undoLastAction() {
  try {
    if (!appState.activeGame) return;
    
    // Get the last action for this game
    const snapshot = await db.collection('actions')
      .where('gameId', '==', appState.activeGame.id)
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      alert('No actions to undo.');
      return;
    }
    
    const actionDoc = snapshot.docs[0];
    const action = {
      id: actionDoc.id,
      ...actionDoc.data()
    };
    
    // Undo based on action type
    if (action.actionType === 'add_points') {
      const player = appState.players.find(p => p.id === action.playerId);
      if (player) {
        // Revert score
        await db.collection('players').doc(action.playerId).update({
          score: action.previousScore,
          ballsHistory: firebase.firestore.FieldValue.arrayRemove(action.ball)
        });
        
        // Update local state
        player.score = action.previousScore;
        player.ballsHistory = (player.ballsHistory || []).filter(ball => 
          ball.color !== action.ball.color || ball.value !== action.ball.value
        );
      }
    } else if (action.actionType === 'reset_score') {
      const player = appState.players.find(p => p.id === action.playerId);
      if (player) {
        // Revert score
        await db.collection('players').doc(action.playerId).update({
          score: action.previousScore
        });
        
        // Update local state
        player.score = action.previousScore;
      }
    }
    
    // Delete the action
    await db.collection('actions').doc(action.id).delete();
    
    // Re-render game view
    renderGameView();
  } catch (error) {
    console.error('Error undoing last action:', error);
    alert('Error undoing action: ' + error.message);
  }
}

// Check if game is complete
function checkGameCompletion() {
  if (!appState.activeGame || appState.activeGame.isCompleted) return;
  
  const targetScore = appState.activeGame.targetScore || 100;
  const gameMode = appState.activeGame.gameMode || 'standard';
  
  // For both game modes: find the player with the highest score
  const highestScore = Math.max(...appState.players.map(p => p.score || 0));
  const leadingPlayer = appState.players.find(p => p.score === highestScore);
  
  // Check if game should end based on game mode
  if (gameMode === 'standard') {
    // In standard mode, game ends when a player reaches target score
    if (highestScore >= targetScore) {
      endGame(leadingPlayer);
    }
  }
  // Note: In snooker mode, game only ends manually
  // For both modes, the user can manually end the game with the highest-scoring player as winner
}

// End game
async function endGame(winningPlayer = null) {
  try {
    if (!appState.activeGame) return;
    
    // Always find the player with the highest score as the winner
    // regardless of which player was passed or game mode
    const highestScore = Math.max(...appState.players.map(p => p.score || 0));
    winningPlayer = appState.players.find(p => p.score === highestScore);
    
    // Calculate game duration
    let durationMinutes = 0;
    if (appState.activeGame.startTime) {
      const startTime = appState.activeGame.startTime.seconds ? 
        new Date(appState.activeGame.startTime.seconds * 1000) : 
        new Date(appState.activeGame.createdAt.seconds * 1000);
      
      const currentTime = new Date();
      durationMinutes = Math.floor((currentTime - startTime) / 60000); // Duration in minutes
    }
    
    // Create update object with duration
    const updateData = {
      isCompleted: true,
      completedAt: firebase.firestore.FieldValue.serverTimestamp(),
      durationMinutes: durationMinutes // Save the game duration
    };
    
    // Always include winnerId based on highest score
    if (winningPlayer && winningPlayer.id) {
      updateData.winnerId = winningPlayer.id;
    }
    
    // Update game in Firebase
    await db.collection('games').doc(appState.activeGame.id).update(updateData);
    
    // Update local state
    appState.activeGame.isCompleted = true;
    appState.activeGame.winnerId = winningPlayer && winningPlayer.id ? winningPlayer.id : null;
    appState.activeGame.durationMinutes = durationMinutes;
    
    // Clear duration update timer if it exists
    if (appState.gameDurationTimer) {
      clearInterval(appState.gameDurationTimer);
      appState.gameDurationTimer = null;
    }
    
    // Show game results
    showGameResults();
  } catch (error) {
    console.error('Error ending game:', error);
    alert('Error ending game: ' + error.message);
  }
}

// Show game results
function showGameResults() {
  if (!appState.activeGame || !appState.players.length) return;
  
  // Sort players by score (highest first)
  const sortedPlayers = [...appState.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Generate HTML for each player
  const playersHTML = sortedPlayers.map((player, index) => {
    const isWinner = player.id === appState.activeGame.winnerId;
    return `
      <div class="player-card ${isWinner ? 'winning' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="player-order">${index + 1}</span>
            <span class="player-name">${player.name}</span>
            ${isWinner ? '<span style="margin-left: 10px; color: gold;">🏆 Winner</span>' : ''}
          </div>
          <div class="score">${player.score || 0}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Format duration if available
  let durationText = '';
  if (appState.activeGame.durationMinutes) {
    const hours = Math.floor(appState.activeGame.durationMinutes / 60);
    const minutes = appState.activeGame.durationMinutes % 60;
    durationText = hours > 0 ? 
      `Duration: ${hours}h ${minutes}m` : 
      `Duration: ${minutes}m`;
  }
  
  // Set the results content
  gameResultsContent.innerHTML = `
    <div>
      <h4>${appState.activeGame.name || 'Game'} - Results</h4>
      <div style="color: #6c757d; margin-bottom: 15px;">
        ${appState.activeGame.gameMode === 'snooker' ? 'Snooker' : 'Standard'} - 
        Target: ${appState.activeGame.targetScore || 100}
        ${durationText ? ' - ' + durationText : ''}
      </div>
      <div style="margin-top: 15px;">
        ${playersHTML}
      </div>
    </div>
  `;
  
  // Show the modal
  toggleGameResultsModal(true);
  
  // Reset active game
  appState.activeGame = null;
  appState.players = [];
  appState.activePlayerId = null;
  
  // Show empty state in game view
  renderEmptyGameState();
}

// Load game history
async function loadGameHistory() {
  try {
    // Get completed games from Firebase
    const snapshot = await db.collection('games')
      .where('isCompleted', '==', true)
      .orderBy('completedAt', 'desc')
      .limit(10)
      .get();
    
    const games = [];
    
    for (const doc of snapshot.docs) {
      const game = {
        id: doc.id,
        ...doc.data()
      };
      
      // Get players for this game
      const playersSnapshot = await db.collection('players')
        .where('gameId', '==', game.id)
        .get();
      
      game.players = playersSnapshot.docs.map(playerDoc => ({
        id: playerDoc.id,
        ...playerDoc.data()
      }));
      
      games.push(game);
    }
    
    appState.completedGames = games;
    
    // Generate HTML for the history
    if (games.length === 0) {
      gameHistoryContent.innerHTML = `
        <div class="empty-state">
          <p>No completed games yet.</p>
        </div>
      `;
      return;
    }
    
    const gamesHTML = games.map(game => {
      const date = game.completedAt ? new Date(game.completedAt.seconds * 1000).toLocaleDateString() : 'Unknown date';
      const winner = game.players.find(p => p.id === game.winnerId);
      
      // Format duration if available
      let durationText = '';
      if (game.durationMinutes) {
        const hours = Math.floor(game.durationMinutes / 60);
        const minutes = game.durationMinutes % 60;
        durationText = hours > 0 ? 
          `${hours}h ${minutes}m` : 
          `${minutes}m`;
      }
      
      return `
        <div class="game-history-item card" style="margin-bottom: 15px;">
          <div class="card-body">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <h4>${game.name || 'Game'}</h4>
                <div style="color: #6c757d;">
                  ${date} - ${game.gameMode === 'snooker' ? 'Snooker' : 'Standard'}
                  ${durationText ? ` - Duration: ${durationText}` : ''}
                </div>
              </div>
              <div>
                <div>Winner: <strong>${winner ? winner.name : 'Unknown'}</strong></div>
                <div>Score: ${winner ? winner.score : 'N/A'}</div>
              </div>
            </div>
            
            <div style="margin-top: 10px;">
              <button class="view-game-details-btn" data-game-id="${game.id}">View Details</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
    
    gameHistoryContent.innerHTML = gamesHTML;
    
    // Add event listeners for view details buttons
    document.querySelectorAll('.view-game-details-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const gameId = this.getAttribute('data-game-id');
        showGameDetails(gameId);
      });
    });
  } catch (error) {
    console.error('Error loading game history:', error);
    gameHistoryContent.innerHTML = `
      <div class="empty-state">
        <p>Error loading game history: ${error.message}</p>
      </div>
    `;
  }
}

// Show game details
function showGameDetails(gameId) {
  const game = appState.completedGames.find(g => g.id === gameId);
  if (!game) return;
  
  // Sort players by score (highest first)
  const sortedPlayers = [...game.players].sort((a, b) => (b.score || 0) - (a.score || 0));
  
  // Generate HTML for each player
  const playersHTML = sortedPlayers.map((player, index) => {
    const isWinner = player.id === game.winnerId;
    return `
      <div class="player-card ${isWinner ? 'winning' : ''}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <span class="player-order">${index + 1}</span>
            <span class="player-name">${player.name}</span>
            ${isWinner ? '<span style="margin-left: 10px; color: gold;">🏆 Winner</span>' : ''}
          </div>
          <div class="score">${player.score || 0}</div>
        </div>
      </div>
    `;
  }).join('');
  
  // Format duration if available
  let durationText = '';
  if (game.durationMinutes) {
    const hours = Math.floor(game.durationMinutes / 60);
    const minutes = game.durationMinutes % 60;
    durationText = hours > 0 ? 
      `Duration: ${hours}h ${minutes}m` : 
      `Duration: ${minutes}m`;
  }
  
  // Create a temporary div for the details
  const detailsDiv = document.createElement('div');
  detailsDiv.innerHTML = `
    <h4>${game.name || 'Game'} - Details</h4>
    <div style="color: #6c757d; margin-bottom: 15px;">
      ${new Date(game.completedAt.seconds * 1000).toLocaleDateString()} - 
      ${game.gameMode === 'snooker' ? 'Snooker' : 'Standard'} - 
      Target: ${game.targetScore || 100}
      ${durationText ? ' - ' + durationText : ''}
    </div>
    <div>
      ${playersHTML}
    </div>
    <div style="margin-top: 15px; text-align: right;">
      <button id="back-to-history-btn">Back to History</button>
    </div>
  `;
  
  // Replace content and add event listener
  gameHistoryContent.innerHTML = '';
  gameHistoryContent.appendChild(detailsDiv);
  
  document.getElementById('back-to-history-btn').addEventListener('click', function() {
    loadGameHistory();
  });
}

// Add player input for new game
function addPlayerInput() {
  const playersContainer = document.getElementById('players-container');
  const playerInputs = playersContainer.querySelectorAll('.player-input');
  
  // Limit the number of players based on game mode
  const gameMode = document.getElementById('game-mode').value;
  const maxPlayers = gameMode === 'snooker' ? 2 : 6;
  
  if (playerInputs.length >= maxPlayers) {
    alert(`Maximum ${maxPlayers} players allowed for ${gameMode === 'snooker' ? 'Snooker' : 'Standard'} mode.`);
    return;
  }
  
  // Create new player input
  const newPlayerInput = document.createElement('div');
  newPlayerInput.className = 'player-input';
  newPlayerInput.innerHTML = `
    <div class="row" style="margin-bottom: 10px;">
      <div class="col">
        <select class="player-profile-select form-control">
          <option value="">Select a profile...</option>
          ${appState.playerProfiles.map(profile => `
            <option value="${profile.id}">${profile.firstName} ${profile.lastName}</option>
          `).join('')}
        </select>
      </div>
      <div class="col">
        <input type="text" class="new-player-input form-control" placeholder="Or enter player name">
      </div>
      <div style="width: 40px; padding-left: 5px;">
        <button type="button" class="remove-player-btn danger" style="padding: 8px; width: 30px; height: 30px; line-height: 1;">×</button>
      </div>
    </div>
  `;
  
  playersContainer.appendChild(newPlayerInput);
  
  // Show all remove buttons if there are more than 2 players
  if (playerInputs.length + 1 > 2) {
    playersContainer.querySelectorAll('.remove-player-btn').forEach(btn => {
      btn.style.display = 'block';
    });
  }
  
  // Add event listener to the new remove button
  newPlayerInput.querySelector('.remove-player-btn').addEventListener('click', function() {
    removePlayerInput(this);
  });
}

// Remove player input
function removePlayerInput(button) {
  const playersContainer = document.getElementById('players-container');
  const playerInput = button.closest('.player-input');
  
  if (playerInput) {
    playerInput.remove();
    
    // Hide remove buttons if there are only 2 players left
    const remainingInputs = playersContainer.querySelectorAll('.player-input');
    if (remainingInputs.length <= 2) {
      playersContainer.querySelectorAll('.remove-player-btn').forEach(btn => {
        btn.style.display = 'none';
      });
    }
  }
}

// Handle starting a new game
async function handleStartNewGame() {
  // Get form values
  const name = document.getElementById('game-name').value.trim() || `Game ${new Date().toLocaleDateString()}`;
  const gameMode = document.getElementById('game-mode').value;
  const targetScore = parseInt(document.getElementById('target-score').value) || 100;
  
  // Get players
  const playerInputs = document.querySelectorAll('.player-input');
  const players = [];
  
  for (let i = 0; i < playerInputs.length; i++) {
    const input = playerInputs[i];
    const profileSelect = input.querySelector('.player-profile-select');
    const nameInput = input.querySelector('.new-player-input');
    
    let playerName = '';
    let profileId = null;
    
    if (profileSelect.value) {
      // Player selected from profiles
      profileId = profileSelect.value;
      const profile = appState.playerProfiles.find(p => p.id === profileId);
      playerName = `${profile.firstName} ${profile.lastName}`;
    } else {
      // Manual player name
      playerName = nameInput.value.trim();
    }
    
    if (!playerName) {
      alert(`Please enter a name for Player ${i + 1}`);
      return;
    }
    
    players.push({
      name: playerName,
      profileId: profileId,
      order: i + 1
    });
  }
  
  // Validate game mode specific rules
  if (gameMode === 'snooker' && players.length !== 2) {
    alert('Snooker requires exactly 2 players.');
    return;
  }
  
  if (players.length < 2) {
    alert('Please add at least 2 players.');
    return;
  }
  
  try {
    // Get the current timestamp for game creation
    const startTime = firebase.firestore.FieldValue.serverTimestamp();
    
    // Create game in Firebase with duration tracking
    const gameRef = await db.collection('games').add({
      name,
      gameMode,
      targetScore,
      isCompleted: false,
      createdAt: startTime,
      startTime: startTime, // Explicit start time for duration tracking
      activePlayerId: null
    });
    
    const gameId = gameRef.id;
    
    // Create players
    const createdPlayers = [];
    
    for (const player of players) {
      const playerRef = await db.collection('players').add({
        gameId,
        name: player.name,
        profileId: player.profileId,
        score: 0,
        ballsHistory: [],
        order: player.order
      });
      
      createdPlayers.push({
        id: playerRef.id,
        gameId,
        name: player.name,
        profileId: player.profileId,
        score: 0,
        ballsHistory: [],
        order: player.order
      });
    }
    
    // Set first player as active
    const firstPlayer = createdPlayers[0];
    await db.collection('games').doc(gameId).update({
      activePlayerId: firstPlayer.id
    });
    
    // Update local state
    appState.activeGame = {
      id: gameId,
      name,
      gameMode,
      targetScore,
      isCompleted: false,
      activePlayerId: firstPlayer.id
    };
    
    appState.players = createdPlayers;
    appState.gameMode = gameMode;
    appState.activePlayerId = firstPlayer.id;
    
    // Close modal and render game
    toggleNewGameModal(false);
    renderGameView();
    
    // Start a timer to update the live clock every second
    // Clear any existing timer first
    if (appState.gameDurationTimer) {
      clearInterval(appState.gameDurationTimer);
    }
    
    // Set up game duration tracking for the entire game
    appState.gameDurationValues = {
      startTime: new Date(), // Local time tracking
      hours: '00',
      minutes: '00',
      seconds: '00'
    };
    
    // Start new timer
    appState.gameDurationTimer = setInterval(() => {
      if (!appState.activeGame || appState.activeGame.isCompleted) {
        clearInterval(appState.gameDurationTimer);
        appState.gameDurationTimer = null;
        return;
      }
      
      // Update the live clock
      updateLiveClock();
    }, 1000); // Update every second
  } catch (error) {
    console.error('Error creating new game:', error);
    alert('Error creating new game: ' + error.message);
  }
}

// Update profiles in the new game modal
function updateProfilesInNewGameModal() {
  const profileSelects = document.querySelectorAll('.player-profile-select');
  
  profileSelects.forEach(select => {
    const currentValue = select.value;
    
    // Clear options except the first one
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    // Add profile options
    appState.playerProfiles.forEach(profile => {
      const option = document.createElement('option');
      option.value = profile.id;
      option.textContent = `${profile.firstName} ${profile.lastName}`;
      select.appendChild(option);
    });
    
    // Restore selected value if it still exists
    if (currentValue) {
      select.value = currentValue;
    }
  });
}

// Toggle new game modal
function toggleNewGameModal(show) {
  appState.showingNewGameModal = show;
  newGameModal.style.display = show ? 'block' : 'none';
  
  if (show) {
    // Reset form
    document.getElementById('game-name').value = `Game ${new Date().toLocaleDateString()}`;
    document.getElementById('game-mode').value = 'standard';
    document.getElementById('target-score').value = '100';
    
    // Reset player inputs
    const playersContainer = document.getElementById('players-container');
    const playerInputs = playersContainer.querySelectorAll('.player-input');
    
    // Remove all but the first two player inputs
    for (let i = 2; i < playerInputs.length; i++) {
      playerInputs[i].remove();
    }
    
    // Clear values in the first two
    for (let i = 0; i < 2; i++) {
      if (playerInputs[i]) {
        playerInputs[i].querySelector('.player-profile-select').value = '';
        playerInputs[i].querySelector('.new-player-input').value = '';
      }
    }
    
    // Hide remove buttons
    playersContainer.querySelectorAll('.remove-player-btn').forEach(btn => {
      btn.style.display = 'none';
    });
    
    // Update profiles in selects
    updateProfilesInNewGameModal();
  }
}

// Toggle game history modal
function toggleGameHistoryModal(show) {
  appState.showingGameHistoryModal = show;
  gameHistoryModal.style.display = show ? 'block' : 'none';
  
  if (show) {
    loadGameHistory();
  }
}

// Toggle game results modal
function toggleGameResultsModal(show) {
  appState.showingGameResultsModal = show;
  gameResultsModal.style.display = show ? 'block' : 'none';
}

// Toggle edit profile modal
function toggleEditProfileModal(show) {
  appState.showingEditProfileModal = show;
  editProfileModal.style.display = show ? 'block' : 'none';
  
  if (!show) {
    appState.editingProfile = null;
  }
}

// Toggle delete profile modal
function toggleDeleteProfileModal(show) {
  appState.showingDeleteProfileModal = show;
  deleteProfileModal.style.display = show ? 'block' : 'none';
}

// Toggle custom points modal
function toggleCustomPointsModal(show, playerId = null) {
  appState.showingCustomPointsModal = show;
  customPointsModal.style.display = show ? 'block' : 'none';
  
  if (show) {
    appState.customPointsPlayerId = playerId;
    document.getElementById('custom-points').value = '0';
  } else {
    appState.customPointsPlayerId = null;
  }
}
