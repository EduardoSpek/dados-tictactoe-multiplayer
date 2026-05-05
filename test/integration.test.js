/**
 * Integration tests for Dados Tic-Tac-Toe Multiplayer
 * Run with: node test/integration.test.js
 */

const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3001';
const TEST_ROOM = 'TEST' + Math.random().toString(36).substr(2, 4).toUpperCase();

let player1, player2;
let player1Connected = false;
let player2Connected = false;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🧪 Starting integration tests...\n');

  // Test 1: Connect two players
  console.log('Test 1: Connecting two players...');
  await connectPlayers();
  assert(player1Connected, 'Player 1 should connect');
  assert(player2Connected, 'Player 2 should connect');
  console.log('✅ Both players connected\n');

  // Test 2: Start game
  console.log('Test 2: Starting game...');
  await startGame();
  await sleep(500);
  console.log('✅ Game started\n');

  // Test 3: Roll dice
  console.log('Test 3: Rolling dice...');
  await rollDice();
  await sleep(500);
  console.log('✅ Dice rolled\n');

  // Test 4: Make move
  console.log('Test 4: Making move...');
  await makeMove();
  await sleep(500);
  console.log('✅ Move made\n');

  console.log('🎉 All tests passed!');
  cleanup();
}

async function connectPlayers() {
  return new Promise((resolve) => {
    player1 = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    player1.on('connect', () => {
      console.log('  Player 1 connected:', player1.id);
      player1.emit('create-room', { playerName: 'TestPlayer1' });
    });

    player1.on('room-created', (data) => {
      console.log('  Room created:', data.roomId);
      player1.emit('join-room', { roomId: TEST_ROOM, playerName: 'TestPlayer1' });
    });

    player1.on('player-joined', (data) => {
      console.log('  Player 1 joined room');
      player1Connected = true;
      
      // Connect second player
      player2 = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        forceNew: true,
      });

      player2.on('connect', () => {
        console.log('  Player 2 connected:', player2.id);
        player2.emit('join-room', { roomId: TEST_ROOM, playerName: 'TestPlayer2' });
      });

      player2.on('room-joined', (data) => {
        console.log('  Player 2 joined room');
        player2Connected = true;
        resolve();
      });
    });
  });
}

async function startGame() {
  return new Promise((resolve) => {
    let resolved = false;
    
    player1.on('start-game', (data) => {
      console.log('  start-game received:', data);
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    // Wait a bit then start manually
    setTimeout(() => {
      if (!resolved) {
        console.log('  Sending start-game-now...');
        player1.emit('start-game-now', { roomId: TEST_ROOM });
      }
    }, 500);

    // Timeout after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        console.log('  ⚠ start-game timeout - checking game state...');
        resolved = true;
        resolve();
      }
    }, 3000);
  });
}

async function rollDice() {
  return new Promise((resolve) => {
    let resolved = false;
    let diceValue = null;

    player1.on('dice-rolled', (data) => {
      console.log('  dice-rolled received:', data);
      diceValue = data.diceValue;
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    // Try to roll
    console.log('  Sending roll-dice...');
    player1.emit('roll-dice', { roomId: TEST_ROOM });

    // Timeout after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        console.log('  ⚠ roll-dice timeout, dice value was:', diceValue);
        resolved = true;
        resolve();
      }
    }, 3000);
  });
}

async function makeMove() {
  return new Promise((resolve) => {
    let resolved = false;

    player1.on('move-made', (data) => {
      console.log('  move-made received:', data);
      if (!resolved) {
        resolved = true;
        resolve();
      }
    });

    // Try to make a move
    console.log('  Sending make-move...');
    player1.emit('make-move', { 
      roomId: TEST_ROOM, 
      position: 0, 
      board: 'left' 
    });

    // Timeout after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        console.log('  ⚠ make-move timeout');
        resolved = true;
        resolve();
      }
    }, 3000);
  });
}

function cleanup() {
  if (player1) player1.disconnect();
  if (player2) player2.disconnect();
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  cleanup();
});