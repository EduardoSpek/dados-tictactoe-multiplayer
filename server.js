const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3001

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Store for active games
const games = new Map()

// Queue for quick match (players waiting for an opponent)
const matchmakingQueue = []

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    // Connection stability settings for mobile/WiFi
    pingTimeout: 60000,        // Wait 60s before considering disconnected
    pingInterval: 25000,       // Ping every 25s to keep connection alive
    transports: ['websocket', 'polling'],  // Fallback to polling if websocket fails
    connectTimeout: 45000,     // Connection timeout
    allowUpgrades: true,       // Allow transport upgrades
    upgradeTimeout: 10000,     // Upgrade timeout
  })

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id)

    // Create new game room
    socket.on('create-room', (playerName, callback) => {
      console.log(`[CREATE] Player ${playerName} creating room`)
      
      const roomId = Math.random().toString(36).substring(2, 6).toUpperCase()
      
      const game = {
        id: roomId,
        players: new Map(),
        boardLeft: Array(3).fill(null).map(() => Array(3).fill(null)),
        boardRight: Array(3).fill(null).map(() => Array(3).fill(null)),
        currentPlayer: 'X',
        diceValue: 1,
        isRolling: false,
        allowedColumn: null,
        winner: null,
        stealMode: false,
        clearMode: false,
        inversionMode: false,
        inversionModeBought: false,
        restoreMode: false,
        lastClearBy: null,
        boardBeforeClear: null,
        timeAttackMode: false,
        gameStarted: false,
        isQuickMatch: false,  // true = auto-start when 2 players, false = wait for 2nd player
        score: { playerX: 0, playerO: 0 },
        coins: { playerX: 0, playerO: 0 },
        winStreak: { playerX: 0, playerO: 0 },
        turnTimeLeft: 15,
        turnTimer: null,
      }
      
      // Add creator as first player (X)
      const player = {
        id: uuidv4(),
        socketId: socket.id,
        symbol: 'X',
        name: playerName,
      }
      game.players.set(player.id, player)
      
      games.set(roomId, game)
      socket.join(roomId)
      
      callback(roomId)
      console.log(`[CREATE] Room ${roomId} created by ${playerName} (Player X, socket: ${socket.id}, playerId: ${player.id})`)
      console.log(`[CREATE] Total players in room: ${game.players.size}`)
    })

    // Find match - quick match with random opponent
    socket.on('find-match', (playerName, callback) => {
      console.log(`[MATCH] Player ${playerName} (${socket.id}) looking for match`)

      // Check if this socket is already in queue
      const existingInQueue = matchmakingQueue.find(p => p.socketId === socket.id)
      if (existingInQueue) {
        console.log(`[MATCH] Player ${playerName} already in queue`)
        callback({ status: 'waiting' })
        return
      }

      // Check if this socket is already in a game
      for (const [roomId, game] of games) {
        const playerInGame = Array.from(game.players.values()).find(p => p.socketId === socket.id)
        if (playerInGame) {
          console.log(`[MATCH] Player ${playerName} already in game ${roomId}`)
          callback({ status: 'already-in-game', roomId })
          return
        }
      }

      // Add player to queue
      matchmakingQueue.push({
        socketId: socket.id,
        name: playerName,
        joinedAt: Date.now(),
      })

      console.log(`[MATCH] Added to queue. Queue size: ${matchmakingQueue.length}`)

      // Notify player they're waiting
      callback({ status: 'waiting' })

      // Try to match with another player
      if (matchmakingQueue.length >= 2) {
        // Get the first two players from queue
        const player1 = matchmakingQueue.shift()
        const player2 = matchmakingQueue.shift()

        // Make sure we have two different sockets
        if (player1.socketId === player2.socketId) {
          // Put player2 back in queue if same socket
          matchmakingQueue.unshift(player2)
          return
        }

        // Create a new game room for them
        const roomId = Math.random().toString(36).substring(2, 6).toUpperCase()

        const game = {
          id: roomId,
          players: new Map(),
          boardLeft: Array(3).fill(null).map(() => Array(3).fill(null)),
          boardRight: Array(3).fill(null).map(() => Array(3).fill(null)),
          currentPlayer: 'X',
          diceValue: 1,
          isRolling: false,
          allowedColumn: null,
          winner: null,
          stealMode: false,
          clearMode: false,
          inversionMode: false,
          inversionModeBought: false,
          restoreMode: false,
          lastClearBy: null,
          boardBeforeClear: null,
          timeAttackMode: false,
          gameStarted: false,
          isQuickMatch: true,  // Quick match auto-starts when 2 players
          score: { playerX: 0, playerO: 0 },
          coins: { playerX: 0, playerO: 0 },
          winStreak: { playerX: 0, playerO: 0 },
          turnTimeLeft: 15,
          turnTimer: null,
        }

        // Add player 1 as X
        const p1 = {
          id: uuidv4(),
          socketId: player1.socketId,
          symbol: 'X',
          name: player1.name,
        }
        game.players.set(p1.id, p1)

        // Add player 2 as O
        const p2 = {
          id: uuidv4(),
          socketId: player2.socketId,
          symbol: 'O',
          name: player2.name,
        }
        game.players.set(p2.id, p2)

        games.set(roomId, game)

        // Get socket instances
        const socket1 = io.sockets.sockets.get(player1.socketId)
        const socket2 = io.sockets.sockets.get(player2.socketId)

        if (socket1) socket1.join(roomId)
        if (socket2) socket2.join(roomId)

        console.log(`[MATCH] Match found! Room ${roomId}: ${player1.name}(X) vs ${player2.name}(O)`)

        // Notify both players
        if (socket1) {
          socket1.emit('match-found', {
            roomId,
            symbol: 'X',
            opponent: player2.name,
            players: [{ name: player1.name, symbol: 'X' }, { name: player2.name, symbol: 'O' }],
          })
        }
        if (socket2) {
          socket2.emit('match-found', {
            roomId,
            symbol: 'O',
            opponent: player1.name,
            players: [{ name: player1.name, symbol: 'X' }, { name: player2.name, symbol: 'O' }],
          })
        }

        // Start the game
        game.gameStarted = true
        const roomKey = roomId.toUpperCase()
        console.log(`[START-GAME] Emitting start-game to room ${roomKey}, gameStarted=${game.gameStarted}`)
        io.to(roomKey).emit('start-game', {
          roomId: roomKey,
          players: [{ name: player1.name, symbol: 'X' }, { name: player2.name, symbol: 'O' }],
          currentPlayer: 'X',
        })

        console.log(`[MATCH] Game started in room ${roomId}`)
      }
    })

    // Cancel matchmaking
    socket.on('cancel-match', () => {
      console.log(`[MATCH] Player ${socket.id} canceling matchmaking`)
      const index = matchmakingQueue.findIndex(p => p.socketId === socket.id)
      if (index !== -1) {
        matchmakingQueue.splice(index, 1)
        console.log(`[MATCH] Removed from queue. Queue size: ${matchmakingQueue.length}`)
      }
    })

    // Join existing room
    socket.on('join-room', (data, callback) => {
      console.log(`[JOIN] Request: room=${data.roomId}, player=${data.playerName}, socket=${socket.id}`)
      console.log(`[JOIN] Available rooms:`, Array.from(games.keys()))
      
      const game = games.get(data.roomId.toUpperCase())
      
      if (!game) {
        console.log(`[JOIN] Room ${data.roomId} NOT FOUND`)
        callback(false, 'Sala não encontrada')
        return
      }
      
      console.log(`[JOIN] Room found. Current players: ${game.players.size}`)
      console.log(`[JOIN] Players in room:`, Array.from(game.players.values()).map(p => `${p.name}(${p.symbol})`))
      
      // Check if this exact socket is already in the room (reconnecting)
      const existingPlayer = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (existingPlayer) {
        console.log(`[JOIN] Player ${data.playerName} already connected as ${existingPlayer.symbol}`)
        callback(true, `Reconectado como Jogador ${existingPlayer.symbol}`)
        return
      }

      // Check if player is trying to join as second player but room has disconnected creator
      const disconnectedPlayer = Array.from(game.players.values()).find(p => p.disconnectedAt)

      // Count only connected players
      let connectedPlayers = Array.from(game.players.values()).filter(p => !p.disconnectedAt)

      // If no connected players, clean up disconnected ones and start fresh
      // BUT only if the game hasn't started yet (created via quick match)
      // For rooms created via create-room, we want to preserve the creator
      if (connectedPlayers.length === 0 && !game.gameStarted) {
        console.log(`[JOIN] No connected players, cleaning up room ${data.roomId}`)
        game.players.clear()
        connectedPlayers = []
      }

      if (connectedPlayers.length >= 2) {
        console.log(`[JOIN] Room ${data.roomId} is FULL (2 connected players)`)
        callback(false, 'Sala cheia')
        return
      }

      // Determine symbol based on connected players only
      // If there's already a connected X, new player gets O
      // If there's already a connected O, new player gets X
      // If no connected players, new player gets X
      let symbol
      const hasX = connectedPlayers.some(p => p.symbol === 'X')
      const hasO = connectedPlayers.some(p => p.symbol === 'O')

      if (!hasX) {
        symbol = 'X'
      } else if (!hasO) {
        symbol = 'O'
      } else {
        // Both symbols exist - room is full
        console.log(`[JOIN] Room ${data.roomId} is FULL (both symbols taken)`)
        callback(false, 'Sala cheia')
        return
      }
      console.log(`[JOIN] Assigning symbol ${symbol} to ${data.playerName} (connectedPlayers: ${connectedPlayers.length})`)
      const player = {
        id: uuidv4(),
        socketId: socket.id,
        symbol,
        name: data.playerName,
      }

      game.players.set(player.id, player)
      socket.join(data.roomId.toUpperCase())
      
      // Send current players list to new player (only connected ones)
      const playersList = Array.from(game.players.values())
        .filter(p => !p.disconnectedAt)
        .map(p => ({ name: p.name, symbol: p.symbol }))
      socket.emit('players-list', playersList)
      console.log(`[JOIN] Sent players-list to ${data.playerName}:`, playersList)
      
      callback(true, `Entrou como Jogador ${symbol}`)
      
      // Send current game state to the new player
      socket.emit('sync-game-state', {
        boardLeft: game.boardLeft,
        boardRight: game.boardRight,
        currentPlayer: game.currentPlayer,
        diceValue: game.diceValue,
        allowedColumn: game.allowedColumn,
        winner: game.winner,
        stealMode: game.stealMode,
        clearMode: game.clearMode || false,
        inversionMode: game.inversionMode || false,
        restoreMode: game.restoreMode || false,
        timeAttackMode: game.timeAttackMode || false,
      })
      console.log(`[JOIN] Sent sync-game-state to ${data.playerName}`)

      // Get connected players after new player joined
      const connectedNow = Array.from(game.players.values()).filter(p => !p.disconnectedAt)

      // Notify room about new player
      io.to(data.roomId.toUpperCase()).emit('player-joined', {
        playerId: socket.id,
        symbol,
        name: data.playerName,
        playerCount: connectedNow.length,
      })
      console.log(`[JOIN] Broadcast player-joined to room ${data.roomId}`)

      // Start game if 2 players (and both are connected)
      if (connectedNow.length === 2 && !game.gameStarted) {
        // Auto-start for both quick match AND room code mode
        game.gameStarted = true
        const playersList = connectedNow.map(p => ({ name: p.name, symbol: p.symbol }))
        const roomKey = data.roomId.toUpperCase()
        console.log(`[START-GAME] Emitting start-game to room ${roomKey}, gameStarted=${game.gameStarted}`)

        io.to(roomKey).emit('start-game', {
          roomId: data.roomId.toUpperCase(),
          players: playersList,
          currentPlayer: game.currentPlayer,
        })

        console.log(`[JOIN] Game AUTO-STARTED in room ${data.roomId}! Players:`, playersList)
      }
      
      console.log(`[JOIN] Player ${data.playerName} joined room ${data.roomId} as ${symbol}`)
    })

    // Start game manually (for room code mode)
    socket.on('start-game-now', (data, callback) => {
      console.log(`[START-GAME-NOW] ★★★ Received from: ${socket.id}, room=${data.roomId} ★★★`)
      console.log(`[START-GAME-NOW] Socket rooms:`, [...socket.rooms])
      console.log(`[START-GAME-NOW] All games:`, Array.from(games.keys()))

      const game = games.get(data.roomId.toUpperCase())

      if (!game) {
        console.log(`[START-GAME-NOW] Room ${data.roomId} NOT FOUND`)
        if (callback) callback(false, 'Sala não encontrada')
        return
      }

      // Only start if 2 players and game hasn't started yet
      const connectedPlayers = Array.from(game.players.values()).filter(p => !p.disconnectedAt)
      if (connectedPlayers.length !== 2) {
        console.log(`[START-GAME-NOW] Not enough players: ${connectedPlayers.length}`)
        if (callback) callback(false, 'Aguardando jogador 2')
        return
      }

      if (game.gameStarted) {
        console.log(`[START-GAME-NOW] Game already started`)
        if (callback) callback(false, 'Jogo já iniciou')
        return
      }

      // Start the game
      game.gameStarted = true
      const playersList = connectedPlayers.map(p => ({ name: p.name, symbol: p.symbol }))

      io.to(data.roomId.toUpperCase()).emit('start-game', {
        roomId: data.roomId.toUpperCase(),
        players: playersList,
        currentPlayer: game.currentPlayer,
      })
      console.log(`[START-GAME-NOW] Emitted 'start-game' to room ${data.roomId.toUpperCase()}`)

      console.log(`[START-GAME-NOW] Game STARTED in room ${data.roomId}! Players:`, playersList)

      if (callback) callback(true)
    })

    // Creator rejoins room when entering game page
    socket.on('join-as-creator', (roomId, callback) => {
      console.log(`[CREATOR] Rejoin request: room=${roomId}, socket=${socket.id}`)
      
      const game = games.get(roomId.toUpperCase())
      
      if (!game) {
        console.log(`[CREATOR] Room ${roomId} NOT FOUND`)
        callback(false)
        return
      }
      
      console.log(`[CREATOR] Room found. Players: ${game.players.size}`)
      console.log(`[CREATOR] Players:`, Array.from(game.players.values()).map(p => `${p.name}(${p.symbol}) disconnected=${!!p.disconnectedAt}`))
      
      // Find creator player (X) - either connected or disconnected
      const creatorPlayer = Array.from(game.players.values()).find(p => p.symbol === 'X')
      
      if (!creatorPlayer) {
        console.log(`[CREATOR] ERROR: No creator player found in room!`)
        callback(false)
        return
      }
      
      // Check if this is a reconnection (player was disconnected)
      if (creatorPlayer.disconnectedAt) {
        console.log(`[CREATOR] Reconnecting ${creatorPlayer.name} after disconnect`)
        delete creatorPlayer.disconnectedAt
        delete creatorPlayer.oldSocketId
      }
      
      // Update socket ID
      creatorPlayer.socketId = socket.id
      console.log(`[CREATOR] Updated socketId for ${creatorPlayer.name}: ${socket.id}`)
      
      socket.join(roomId.toUpperCase())
      console.log(`[CREATOR] Socket ${socket.id} joined room ${roomId}`)
      
      const players = Array.from(game.players.values())
        .filter(p => !p.disconnectedAt) // Only include connected players
        .map(p => ({ name: p.name, symbol: p.symbol }))
      
      callback(true, players)
      console.log(`[CREATOR] Callback sent with players:`, players)
      
      // Notify other player that creator reconnected
      socket.to(roomId.toUpperCase()).emit('player-rejoined')

      // If game already started with 2 connected players, notify creator with full game state
      const connectedNow = Array.from(game.players.values()).filter(p => !p.disconnectedAt)
      if (connectedNow.length === 2 && game.gameStarted) {
        console.log(`[CREATOR] Game already started, sending game-started event`)
        socket.emit('game-started', {
          currentPlayer: game.currentPlayer,
          players: players,
        })
        // Also send current game state
        socket.emit('sync-game-state', {
          boardLeft: game.boardLeft,
          boardRight: game.boardRight,
          currentPlayer: game.currentPlayer,
          diceValue: game.diceValue,
          allowedColumn: game.allowedColumn,
          winner: game.winner,
          stealMode: game.stealMode,
          clearMode: game.clearMode || false,
          inversionMode: game.inversionMode || false,
          restoreMode: game.restoreMode || false,
          timeAttackMode: game.timeAttackMode || false,
        })
      }

      console.log(`[CREATOR] Rejoined room ${roomId}, players: ${players.length}`)
    })

    // Player 2 rejoins room when reconnecting
    socket.on('rejoin-room', (roomId, callback) => {
      console.log(`[REJOIN] Request: room=${roomId}, socket=${socket.id}`)
      
      const game = games.get(roomId.toUpperCase())
      
      if (!game) {
        console.log(`[REJOIN] Room ${roomId} NOT FOUND`)
        callback(false)
        return
      }
      
      // Find player by old socket or check if already connected
      const existingPlayer = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (existingPlayer) {
        console.log(`[REJOIN] Player ${existingPlayer.name} already connected`)
        const players = Array.from(game.players.values())
          .filter(p => !p.disconnectedAt)
          .map(p => ({ name: p.name, symbol: p.symbol }))
        callback(true, players)
        return
      }
      
      // Find any disconnected player (X or O)
      const disconnectedPlayer = Array.from(game.players.values()).find(p => p.disconnectedAt)
      
      if (!disconnectedPlayer) {
        console.log(`[REJOIN] No disconnected player O found`)
        callback(false)
        return
      }
      
      console.log(`[REJOIN] Reconnecting ${disconnectedPlayer.name} after disconnect`)
      delete disconnectedPlayer.disconnectedAt
      delete disconnectedPlayer.oldSocketId
      disconnectedPlayer.socketId = socket.id
      
      socket.join(roomId.toUpperCase())
      console.log(`[REJOIN] Socket ${socket.id} joined room ${roomId}`)
      
      const players = Array.from(game.players.values())
        .filter(p => !p.disconnectedAt)
        .map(p => ({ name: p.name, symbol: p.symbol }))
      
      callback(true, players)
      console.log(`[REJOIN] Callback sent with players:`, players)
      
      // Notify other player that this player reconnected
      socket.to(roomId.toUpperCase()).emit('player-rejoined')
      
      // Send current game state
      if (game.gameStarted) {
        console.log(`[REJOIN] Sending game state to ${disconnectedPlayer.name}`)
        socket.emit('game-started', {
          currentPlayer: game.currentPlayer,
          players: players,
        })
        socket.emit('sync-game-state', {
          boardLeft: game.boardLeft,
          boardRight: game.boardRight,
          currentPlayer: game.currentPlayer,
          diceValue: game.diceValue,
          allowedColumn: game.allowedColumn,
          winner: game.winner,
          stealMode: game.stealMode,
          clearMode: game.clearMode || false,
          inversionMode: game.inversionMode || false,
          restoreMode: game.restoreMode || false,
          timeAttackMode: game.timeAttackMode || false,
        })
      }

      console.log(`[REJOIN] Player ${disconnectedPlayer.name} rejoined room ${roomId}`)
    })

    // Handle dice roll
    socket.on('roll-dice', (roomId) => {
      console.log(`[DICE] Roll request: room=${roomId}, socket=${socket.id}`)
      
      const game = games.get(roomId.toUpperCase())
      if (!game) {
        console.log(`[DICE] Room ${roomId} not found`)
        return
      }
      if (game.isRolling) {
        console.log(`[DICE] Already rolling`)
        return
      }
      if (game.winner) {
        console.log(`[DICE] Game already has winner: ${game.winner}`)
        return
      }
      
      // Check if the player is the current player
      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      console.log(`[DICE] Player lookup:`, player ? `${player.name}(${player.symbol})` : 'NOT FOUND')
      console.log(`[DICE] Current player: ${game.currentPlayer}, Game started: ${game.gameStarted}`)
      
      if (!player) {
        console.log(`[DICE] Player not found in room`)
        return
      }
      if (player.symbol !== game.currentPlayer) {
        console.log(`[DICE] Not player's turn. Player=${player.symbol}, Current=${game.currentPlayer}`)
        return
      }
      if (!game.gameStarted) {
        console.log(`[DICE] Game not started yet`)
        return
      }
      
      game.isRolling = true
      game.stealMode = false
      
      // Simulate dice rolling
      let rolls = 0
      const maxRolls = 15
      const interval = setInterval(() => {
        game.diceValue = Math.floor(Math.random() * 6) + 1 // 1-6 for animation
        rolls++

        io.to(roomId.toUpperCase()).emit('dice-rolling', game.diceValue)

        if (rolls >= maxRolls) {
          clearInterval(interval)

          // Check if there are opponent cells to steal
          const opponent = game.currentPlayer === 'X' ? 'O' : 'X'
          let hasOpponentCells = false
          for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
              if (game.boardLeft[row][col] === opponent || game.boardRight[row][col] === opponent) {
                hasOpponentCells = true
                break
              }
            }
            if (hasOpponentCells) break
          }

          // Only allow 0 if there are opponent cells to steal
          // Allow 7 (clear mode) if at least one board has cells
          const hasAnyCells = game.boardLeft.some(row => row.some(cell => cell !== null)) ||
                              game.boardRight.some(row => row.some(cell => cell !== null))

          // DEBUG: Forçando 8 para aparecer com mais frequência para teste
          let finalValue
          let attempts = 0
          const maxAttempts = 20

          do {
            if (hasOpponentCells && hasAnyCells) {
              finalValue = Math.floor(Math.random() * 9) // 0-8 (all modes available)
            } else if (hasOpponentCells) {
              finalValue = Math.floor(Math.random() * 8) // 0-7 (no clear if boards empty)
            } else if (hasAnyCells) {
              finalValue = Math.floor(Math.random() * 8) + 1 // 1-8 (no steal if no opponent cells)
            } else {
              finalValue = Math.floor(Math.random() * 6) + 1 // 1-6 only
            }

            // If 8 but no X and O, reroll silently
            if (finalValue === 8) {
              const hasX = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'X')
              const hasO = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'O')
              if (!hasX || !hasO) {
                attempts++
                continue // keep rolling
              }
            }

            // If 0 but no cells, reroll silently
            if (finalValue === 0) {
              if (!hasAnyCells) {
                attempts++
                continue
              }
            }

            // If 7 but no opponent cells, reroll silently
            if (finalValue === 7) {
              if (!hasOpponentCells) {
                attempts++
                continue
              }
            }

            break
          } while (attempts < maxAttempts)

          // Fallback to 1-6 if too many attempts
          if (attempts >= maxAttempts) {
            finalValue = Math.floor(Math.random() * 6) + 1
          }

          game.diceValue = finalValue
          game.isRolling = false

          let isColumnFull = false

          // EIGHT = Inversion mode! (only if there's at least one X and one O)
          if (finalValue === 8) {
            const hasX = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'X')
            const hasO = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'O')

            if (!hasX || !hasO) {
              // This shouldn't happen now, but just in case
              finalValue = Math.floor(Math.random() * 6) + 1
              game.diceValue = finalValue
            }

            game.inversionMode = true
            game.stealMode = false
            game.clearMode = false
            game.allowedColumn = null
            io.to(roomId.toUpperCase()).emit('dice-rolled', {
              value: finalValue,
              currentPlayer: game.currentPlayer,
              allowedColumn: null,
              stealMode: false,
              clearMode: false,
              inversionMode: true,
            })
            return
          } else if (finalValue === 0) {
            // Steal mode
            game.stealMode = true
            game.clearMode = false
            game.inversionMode = false
            game.allowedColumn = null
          } else if (finalValue === 7) {
            // Clear mode - choose board to clear
            game.stealMode = false
            game.clearMode = true
            game.inversionMode = false
            game.allowedColumn = null
          } else {
            // Normal mode
            game.stealMode = false
            game.clearMode = false
            const column = finalValue - 1
            const boardSide = column <= 2 ? 'left' : 'right'
            const colIndex = column <= 2 ? column : column - 3
            
            // Check if column is full
            const board = boardSide === 'left' ? game.boardLeft : game.boardRight
            isColumnFull = true
            for (let row = 0; row < 3; row++) {
              if (board[row][colIndex] === null) {
                isColumnFull = false
                break
              }
            }
            
            if (isColumnFull) {
              game.allowedColumn = null
              game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
            } else {
              game.allowedColumn = column
            }
          }
          
          io.to(roomId.toUpperCase()).emit('dice-rolled', {
            value: game.diceValue,
            currentPlayer: game.currentPlayer,
            allowedColumn: game.allowedColumn,
            stealMode: game.stealMode,
            clearMode: game.clearMode || false,
            columnFull: isColumnFull,
          })
        }
      }, 80)
    })

    // Buy mode with coins
    socket.on('buy-mode', (data) => {
      const { roomId, mode } = data
      console.log(`[BUY] Request: room=${roomId}, mode=${mode}, socket=${socket.id}`)

      const game = games.get(roomId.toUpperCase())
      if (!game) {
        console.log(`[BUY] Room ${roomId} not found`)
        return
      }
      if (game.isRolling) {
        console.log(`[BUY] Already rolling`)
        return
      }
      if (game.winner) {
        console.log(`[BUY] Game already has winner: ${game.winner}`)
        return
      }
      if (!game.gameStarted) {
        console.log(`[BUY] Game not started yet`)
        return
      }

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player) {
        console.log(`[BUY] Player not found in room`)
        return
      }
      if (player.symbol !== game.currentPlayer) {
        console.log(`[BUY] Not player's turn. Player=${player.symbol}, Current=${game.currentPlayer}`)
        return
      }

      // Check if player has enough coins
      const playerCoins = player.symbol === 'X' ? game.coins.playerX : game.coins.playerO
      if (playerCoins < 1) {
        console.log(`[BUY] Not enough coins. Have=${playerCoins}, Need=1`)
        socket.emit('buy-failed', { reason: 'moedas' })
        return
      }

      // Check if mode is valid
      const opponent = player.symbol === 'X' ? 'O' : 'X'
      let hasOpponentCells = false
      let hasAnyCells = false

      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 3; col++) {
          const cellLeft = game.boardLeft[row][col]
          const cellRight = game.boardRight[row][col]

          if (cellLeft === opponent || cellRight === opponent) {
            hasOpponentCells = true
          }
          if (cellLeft !== null || cellRight !== null) {
            hasAnyCells = true
          }
        }
      }

      if (mode === 'steal' && !hasOpponentCells) {
        console.log(`[BUY] Cannot buy steal mode - no opponent cells`)
        socket.emit('buy-failed', { reason: 'sem-oponente' })
        return
      }
      if (mode === 'clear' && !hasOpponentCells) {
        console.log(`[BUY] Cannot buy clear mode - no opponent cells`)
        socket.emit('buy-failed', { reason: 'sem-oponente' })
        return
      }
      if (mode === 'invert') {
        const hasX = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'X')
        const hasO = [...game.boardLeft, ...game.boardRight].flat().some(c => c === 'O')
        if (!hasX || !hasO) {
          console.log(`[BUY] Cannot buy invert mode - need both X and O`)
          socket.emit('buy-failed', { reason: 'sem-marca' })
          return
        }
      }

      // Restore mode - only after opponent used clear, costs 2 coins
      if (mode === 'restore') {
        if (playerCoins < 2) {
          console.log(`[BUY] Not enough coins for restore mode. Have=${playerCoins}, Need=2`)
          socket.emit('buy-failed', { reason: 'moedas' })
          return
        }
        if (!game.lastClearBy || game.lastClearBy === player.symbol) {
          console.log(`[BUY] Cannot buy restore mode - opponent hasn't used clear`)
          socket.emit('buy-failed', { reason: 'sem-limpar' })
          return
        }
      }

      // Deduct coin(s)
      const cost = mode === 'restore' ? 2 : 1
      if (player.symbol === 'X') {
        game.coins.playerX -= cost
      } else {
        game.coins.playerO -= cost
      }

      // Apply mode
      game.stealMode = false
      game.clearMode = false
      game.inversionMode = false

      if (mode === 'steal') {
        game.stealMode = true
      } else if (mode === 'clear') {
        game.clearMode = true
        game.lastClearBy = player.symbol
      } else if (mode === 'invert') {
        game.inversionMode = true
        game.inversionModeBought = true
      } else if (mode === 'restore') {
        game.restoreMode = true
      } else if (mode === 'time') {
        game.timeAttackMode = true
        // Time attack passes turn to opponent immediately
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
        game.allowedColumn = null
        console.log(`[BUY] Time attack activated - turn passed to ${game.currentPlayer}`)
      }

      console.log(`[BUY] Mode activated: ${mode}, remaining coins: X=${game.coins.playerX} O=${game.coins.playerO}`)

      io.to(roomId.toUpperCase()).emit('mode-bought', {
        mode: mode,
        currentPlayer: game.currentPlayer,
        coins: game.coins,
        stealMode: game.stealMode,
        clearMode: game.clearMode,
        inversionMode: game.inversionMode,
        restoreMode: game.restoreMode,
        timeAttackMode: game.timeAttackMode,
      })
    })

    // Cancel mode (when player doesn't want to use steal/clear/invert)
    socket.on('cancel-mode', (roomId) => {
      console.log(`[CANCEL] Request: room=${roomId}, socket=${socket.id}`)

      const game = games.get(roomId.toUpperCase())
      if (!game) {
        console.log(`[CANCEL] Room ${roomId} not found`)
        return
      }
      if (!game.gameStarted || game.isRolling || game.winner) {
        console.log(`[CANCEL] Game not in valid state`)
        return
      }

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) {
        console.log(`[CANCEL] Not player's turn`)
        return
      }

      // Only allow cancel if a special mode is active
      if (!game.stealMode && !game.clearMode && !game.inversionMode) {
        console.log(`[CANCEL] No active mode to cancel`)
        return
      }

      console.log(`[CANCEL] Player ${game.currentPlayer} cancelled ${game.stealMode ? 'steal' : game.clearMode ? 'clear' : 'inversion'} mode`)

      // Refund coin if mode was bought (not from dice)
      // Note: We need to track if mode was bought. For now, let's not refund.
      // The player just loses the turn.

      // Reset modes
      game.stealMode = false
      game.clearMode = false
      game.inversionMode = false

      // Switch turn
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
      game.allowedColumn = null

      io.to(roomId.toUpperCase()).emit('mode-cancelled', {
        currentPlayer: game.currentPlayer,
        stealMode: false,
        clearMode: false,
        inversionMode: false,
      })
    })

    // Handle cell click
    socket.on('cell-click', (data) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return
      
      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) return
      
      const board = data.boardSide === 'left' ? game.boardLeft : game.boardRight
      const cellValue = board[data.row][data.col]
      
      // Steal mode
      if (game.stealMode) {
        const opponent = game.currentPlayer === 'X' ? 'O' : 'X'
        if (cellValue !== opponent) return
        
        board[data.row][data.col] = game.currentPlayer
        
        // Check winner
        const checkWinner = (board, player) => {
          for (let row = 0; row < 3; row++) {
            if (board[row][0] === player && board[row][1] === player && board[row][2] === player) return true
          }
          for (let col = 0; col < 3; col++) {
            if (board[0][col] === player && board[1][col] === player && board[2][col] === player) return true
          }
          if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true
          if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true
          return false
        }
        
        if (checkWinner(board, game.currentPlayer)) {
          game.winner = game.currentPlayer
          // Update score
          if (game.currentPlayer === 'X') {
            game.score.playerX++
          } else {
            game.score.playerO++
          }

          // Award coin every 2 consecutive wins
          const winnerKey = game.currentPlayer === 'X' ? 'playerX' : 'playerO'
          const opponentKey = game.currentPlayer === 'X' ? 'playerO' : 'playerX'
          game.winStreak[winnerKey]++
          game.winStreak[opponentKey] = 0 // Reset opponent streak

          if (game.winStreak[winnerKey] === 2) {
            game.coins[winnerKey]++
            game.winStreak[winnerKey] = 0 // Reset streak after awarding coin
            console.log(`[COIN] Player ${game.currentPlayer} earned a coin! Total: ${game.coins[winnerKey]}`)
          }

          console.log(`[WIN] Player ${game.currentPlayer} won! Score: X=${game.score.playerX} O=${game.score.playerO}, Coins: X=${game.coins.playerX} O=${game.coins.playerO}, Streak: X=${game.winStreak.playerX} O=${game.winStreak.playerO}`)
        } else {
          game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
          game.stealMode = false
        }
        
        io.to(data.roomId.toUpperCase()).emit('cell-stolen', {
          boardSide: data.boardSide,
          row: data.row,
          col: data.col,
          player: game.currentPlayer,
          currentPlayer: game.currentPlayer,
          winner: game.winner,
          boardLeft: game.boardLeft,
          boardRight: game.boardRight,
          score: game.score,
          coins: game.coins,
          playSound: true, // Flag to play sound for all players
        })
        return
      }
      
      // Normal mode
      if (game.allowedColumn === null) return
      
      const actualCol = data.boardSide === 'left' ? data.col : data.col + 3
      if (actualCol !== game.allowedColumn) return
      if (cellValue !== null) return
      
      board[data.row][data.col] = game.currentPlayer
      
      // Check winner
      const checkWinner = (board, player) => {
        for (let row = 0; row < 3; row++) {
          if (board[row][0] === player && board[row][1] === player && board[row][2] === player) return true
        }
        for (let col = 0; col < 3; col++) {
          if (board[0][col] === player && board[1][col] === player && board[2][col] === player) return true
        }
        if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true
        if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true
        return false
      }
      
      if (checkWinner(board, game.currentPlayer)) {
        game.winner = game.currentPlayer
        // Update score
        if (game.currentPlayer === 'X') {
          game.score.playerX++
        } else {
          game.score.playerO++
        }

        // Award coin every 2 consecutive wins
        const winnerKey = game.currentPlayer === 'X' ? 'playerX' : 'playerO'
        const opponentKey = game.currentPlayer === 'X' ? 'playerO' : 'playerX'
        game.winStreak[winnerKey]++
        game.winStreak[opponentKey] = 0 // Reset opponent streak

        if (game.winStreak[winnerKey] === 2) {
          game.coins[winnerKey]++
          game.winStreak[winnerKey] = 0 // Reset streak after awarding coin
          console.log(`[COIN] Player ${game.currentPlayer} earned a coin! Total: ${game.coins[winnerKey]}`)
        }

        console.log(`[WIN] Player ${game.currentPlayer} won! Score: X=${game.score.playerX} O=${game.score.playerO}, Coins: X=${game.coins.playerX} O=${game.coins.playerO}, Streak: X=${game.winStreak.playerX} O=${game.winStreak.playerO}`)
      } else {
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
        game.allowedColumn = null
      }
      
      io.to(data.roomId.toUpperCase()).emit('cell-marked', {
        boardSide: data.boardSide,
        row: data.row,
        col: data.col,
        player: player.symbol,
        currentPlayer: game.currentPlayer,
        winner: game.winner,
        boardLeft: game.boardLeft,
        boardRight: game.boardRight,
        score: game.score,
        coins: game.coins,
        playSound: true, // Flag to play sound for all players
      })
    })

    // Handle invert marks (when dice = 8)
    socket.on('invert-marks', (data) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) return

      // Only allow inversion when dice is 8 OR when mode was bought with coin
      if (!game.inversionMode) return
      if (game.diceValue !== 8 && !game.inversionModeBought) return

      // Invert all marks on both boards
      const invertBoard = (board) =>
        board.map(row => row.map(cell => {
          if (cell === 'X') return 'O'
          if (cell === 'O') return 'X'
          return null
        }))

      game.boardLeft = invertBoard(game.boardLeft)
      game.boardRight = invertBoard(game.boardRight)

      console.log(`[INVERT] Player ${game.currentPlayer} inverted all marks`)

      // Switch turn
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
      game.inversionMode = false
      game.inversionModeBought = false
      game.allowedColumn = null

      io.to(data.roomId.toUpperCase()).emit('marks-inverted', {
        currentPlayer: game.currentPlayer,
        boardLeft: game.boardLeft,
        boardRight: game.boardRight,
        playSound: true,
      })
    })

    // Handle clear board (when dice = 7)
    socket.on('clear-board', (data) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) return

      // Only allow clear mode when clearMode is active (dice=7 OR bought with coin)
      if (!game.clearMode) return

      // Save board state before clearing for restore mode
      game.boardBeforeClear = {
        boardLeft: game.boardLeft.map(row => [...row]),
        boardRight: game.boardRight.map(row => [...row]),
      }
      game.lastClearBy = player.symbol

      // Clear the chosen board
      if (data.boardSide === 'left') {
        game.boardLeft = Array(3).fill(null).map(() => Array(3).fill(null))
      } else {
        game.boardRight = Array(3).fill(null).map(() => Array(3).fill(null))
      }
      
      console.log(`[CLEAR] Player ${game.currentPlayer} cleared ${data.boardSide} board`)
      
      // Switch turn
      game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
      game.clearMode = false
      game.allowedColumn = null
      
      io.to(data.roomId.toUpperCase()).emit('board-cleared', {
        boardSide: data.boardSide,
        currentPlayer: game.currentPlayer,
        boardLeft: game.boardLeft,
        boardRight: game.boardRight,
        playSound: true,
      })
    })

    // Restore board (restore mode)
    socket.on('restore-board', (data) => {
      const { roomId } = data
      const game = games.get(roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) return

      // Only allow restore mode when restoreMode is active
      if (!game.restoreMode) return

      // Restore board to state before clear
      if (game.boardBeforeClear) {
        game.boardLeft = game.boardBeforeClear.boardLeft.map(row => [...row])
        game.boardRight = game.boardBeforeClear.boardRight.map(row => [...row])

        console.log(`[RESTORE] Player ${game.currentPlayer} restored board`)

        // Switch turn
        game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X'
        game.restoreMode = false
        game.allowedColumn = null

        io.to(roomId.toUpperCase()).emit('board-restored', {
          currentPlayer: game.currentPlayer,
          boardLeft: game.boardLeft,
          boardRight: game.boardRight,
          playSound: true,
        })
      }
    })

    // Reset game
    socket.on('reset-game', (roomId) => {
      const game = games.get(roomId.toUpperCase())
      if (!game) return
      
      // Determine who starts next game - the loser starts
      // If X won, O starts. If O won, X starts. If tie/no winner, X starts (default)
      let nextStarter = 'X'
      if (game.winner === 'X') {
        nextStarter = 'O'
        console.log(`[RESET] X won, so O starts next game`)
      } else if (game.winner === 'O') {
        nextStarter = 'X'
        console.log(`[RESET] O won, so X starts next game`)
      } else {
        console.log(`[RESET] No winner, X starts next game`)
      }
      
      game.boardLeft = Array(3).fill(null).map(() => Array(3).fill(null))
      game.boardRight = Array(3).fill(null).map(() => Array(3).fill(null))
      game.currentPlayer = nextStarter
      game.diceValue = 1
      game.allowedColumn = null
      game.winner = null
      game.stealMode = false
      game.isRolling = false

      io.to(roomId.toUpperCase()).emit('game-reset', {
        boardLeft: game.boardLeft,
        boardRight: game.boardRight,
        currentPlayer: game.currentPlayer,
        coins: game.coins,
      })
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[DISCONNECT] Socket ${socket.id} disconnected`)

      // Remove from matchmaking queue if present
      const queueIndex = matchmakingQueue.findIndex(p => p.socketId === socket.id)
      if (queueIndex !== -1) {
        matchmakingQueue.splice(queueIndex, 1)
        console.log(`[DISCONNECT] Removed from matchmaking queue. Queue size: ${matchmakingQueue.length}`)
      }

      // Find and clean up games
      games.forEach((game, roomId) => {
        const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
        if (player) {
          console.log(`[DISCONNECT] Player ${player.name}(${player.symbol}) disconnected from room ${roomId}`)
          
          // Mark player as disconnected but keep them in the game temporarily
          player.disconnectedAt = Date.now()
          player.oldSocketId = socket.id
          
          // Don't emit player-left immediately - give player time to reconnect
          // Instead, emit a temporary disconnection event
          io.to(roomId).emit('player-temporarily-disconnected', { playerId: player.id })

          // Set timeout to actually remove player if they don't reconnect
          setTimeout(() => {
            const currentGame = games.get(roomId)
            if (!currentGame) return

            const stillDisconnected = Array.from(currentGame.players.values()).find(p => p.id === player.id && p.disconnectedAt)
            if (stillDisconnected) {
              console.log(`[DISCONNECT] Removing ${player.name} after grace period`)
              currentGame.players.delete(player.id)

              // NOW emit player-left since player didn't reconnect
              io.to(roomId).emit('player-left', { playerId: player.id })

              // Only delete room if no players left
              if (currentGame.players.size === 0) {
                if (!currentGame.gameStarted) {
                  games.delete(roomId)
                  console.log(`[DISCONNECT] Room ${roomId} deleted (never started)`)
                } else {
                  games.delete(roomId)
                  console.log(`[DISCONNECT] Room ${roomId} deleted (game ended)`)
                }
              } else {
                console.log(`[DISCONNECT] Room ${roomId} still has ${currentGame.players.size} player(s)`)
              }
            }
          }, 30000) // 30 second grace period for reconnection

          console.log(`[DISCONNECT] ${player.name} has 30s to reconnect`)
        }
      })
    })

    // Handle emoji reactions
    socket.on('send-reaction', (data) => {
      const { roomId, emoji } = data
      const game = games.get(roomId.toUpperCase())
      if (!game) return

      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player) return

      console.log(`[REACTION] ${player.name} sent ${emoji} in room ${roomId}`)

      // Broadcast reaction to all players in room
      io.to(roomId.toUpperCase()).emit('reaction-received', {
        emoji,
        playerName: player.name,
        playerSymbol: player.symbol,
        timestamp: Date.now(),
      })
    })

    // Start turn timer
    socket.on('start-turn-timer', (roomId) => {
      const game = games.get(roomId.toUpperCase())
      if (!game) return

      // Clear any existing timer
      if (game.turnTimer) {
        clearInterval(game.turnTimer)
      }

      // Time attack mode reduces timer to 5 seconds
      game.turnTimeLeft = game.timeAttackMode ? 5 : 15

      // Send initial timer state
      io.to(roomId.toUpperCase()).emit('turn-timer', {
        timeLeft: game.turnTimeLeft,
        currentPlayer: game.currentPlayer,
      })

      // Start countdown
      game.turnTimer = setInterval(() => {
        game.turnTimeLeft--

        io.to(roomId.toUpperCase()).emit('turn-timer', {
          timeLeft: game.turnTimeLeft,
          currentPlayer: game.currentPlayer,
        })

        if (game.turnTimeLeft <= 0) {
          // Time's up! Switch turn automatically
          clearInterval(game.turnTimer)
          game.turnTimer = null

          console.log(`[TIMER] Time's up for ${game.currentPlayer}, switching turn`)

          // Identify the player who ran out of time (current player before switch)
          const previousPlayer = game.currentPlayer
          const newPlayer = previousPlayer === 'X' ? 'O' : 'X'

          // Penalty: transfer 1 coin from player who ran out of time to opponent
          if (previousPlayer === 'X' && game.coins.playerX > 0) {
            game.coins.playerX--
            game.coins.playerO++
            console.log(`[PENALTY] Player X lost 1 coin to Player O (timeout)`)
          } else if (previousPlayer === 'O' && game.coins.playerO > 0) {
            game.coins.playerO--
            game.coins.playerX++
            console.log(`[PENALTY] Player O lost 1 coin to Player X (timeout)`)
          }

          // Switch turn
          game.currentPlayer = newPlayer
          game.allowedColumn = null
          game.stealMode = false
          game.clearMode = false
          game.inversionMode = false
          game.timeAttackMode = false // Reset time attack after turn switches

          // Notify players
          io.to(roomId.toUpperCase()).emit('turn-expired', {
            previousPlayer: previousPlayer,
            newCurrentPlayer: newPlayer,
            coins: game.coins,
          })

          // Start new timer for next player
          if (game.players.size >= 2) {
            setTimeout(() => {
              io.to(roomId.toUpperCase()).emit('start-turn-timer', roomId)
            }, 1000)
          }
        }
      }, 1000)
    })

    // Stop turn timer
    socket.on('stop-turn-timer', (roomId) => {
      const game = games.get(roomId.toUpperCase())
      if (!game) return

      if (game.turnTimer) {
        clearInterval(game.turnTimer)
        game.turnTimer = null
      }
    })
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, '0.0.0.0', () => {  // Escuta em todas as interfaces
      console.log(`> Ready on http://localhost:${port}`)
      console.log(`> LAN Access: http://192.168.100.39:${port}`)
    })
})
