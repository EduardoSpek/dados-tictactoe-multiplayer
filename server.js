const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const { v4: uuidv4 } = require('uuid')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Store for active games
const games = new Map()

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
        gameStarted: false,
        score: { playerX: 0, playerO: 0 }, // Add score tracking
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
      if (disconnectedPlayer) {
        console.log(`[JOIN] Found disconnected player ${disconnectedPlayer.name}, waiting for reconnection`)
      }
      
      if (game.players.size >= 2) {
        // Check if all players are actually connected
        const connectedPlayers = Array.from(game.players.values()).filter(p => !p.disconnectedAt)
        if (connectedPlayers.length >= 2) {
          console.log(`[JOIN] Room ${data.roomId} is FULL (2 connected players)`)
          callback(false, 'Sala cheia')
          return
        }
      }
      
      const symbol = 'O' // Second player is always O
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
      })
      console.log(`[JOIN] Sent sync-game-state to ${data.playerName}`)
      
      // Notify room about new player
      io.to(data.roomId.toUpperCase()).emit('player-joined', {
        playerId: socket.id,
        symbol,
        name: data.playerName,
        playerCount: game.players.size,
      })
      console.log(`[JOIN] Broadcast player-joined to room ${data.roomId}`)
      
      // Start game if 2 players (and both are connected)
      const connectedPlayers = Array.from(game.players.values()).filter(p => !p.disconnectedAt)
      if (connectedPlayers.length === 2 && !game.gameStarted) {
        game.gameStarted = true
        const playersList = connectedPlayers.map(p => ({ name: p.name, symbol: p.symbol }))
        
        // Notify both players to start game
        io.to(data.roomId.toUpperCase()).emit('start-game', {
          roomId: data.roomId.toUpperCase(),
          players: playersList,
          currentPlayer: game.currentPlayer,
        })
        
        console.log(`[JOIN] Game STARTED in room ${data.roomId}! Players:`, playersList)
      }
      
      console.log(`[JOIN] Player ${data.playerName} joined room ${data.roomId} as ${symbol}`)
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
      
      // If game already started with 2 players, notify creator with full game state
      if (game.players.size === 2 && game.gameStarted) {
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
      
      // Find disconnected player (not X, so must be O)
      const disconnectedPlayer = Array.from(game.players.values()).find(p => p.disconnectedAt && p.symbol === 'O')
      
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
        game.diceValue = Math.floor(Math.random() * 6) + 1
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
          
          let finalValue
          if (hasOpponentCells && hasAnyCells) {
            finalValue = Math.floor(Math.random() * 8) // 0-7
          } else if (hasOpponentCells) {
            finalValue = Math.floor(Math.random() * 7) // 0-6 (no clear if boards empty)
          } else if (hasAnyCells) {
            finalValue = Math.floor(Math.random() * 7) + 1 // 1-7 (no steal if no opponent cells)
          } else {
            finalValue = Math.floor(Math.random() * 6) + 1 // 1-6 only
          }
          
          game.diceValue = finalValue
          game.isRolling = false
          
          let isColumnFull = false
          
          if (finalValue === 0) {
            // Steal mode
            game.stealMode = true
            game.clearMode = false
            game.allowedColumn = null
          } else if (finalValue === 7) {
            // Clear mode - choose board to clear
            game.stealMode = false
            game.clearMode = true
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
          console.log(`[WIN] Player ${game.currentPlayer} won! Score: X=${game.score.playerX} O=${game.score.playerO}`)
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
          score: game.score, // Include score
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
        console.log(`[WIN] Player ${game.currentPlayer} won! Score: X=${game.score.playerX} O=${game.score.playerO}`)
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
        score: game.score, // Include score
        playSound: true, // Flag to play sound for all players
      })
    })

    // Handle clear board (when dice = 7)
    socket.on('clear-board', (data) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return
      
      const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (!player || player.symbol !== game.currentPlayer) return
      
      // Only allow clear mode when dice is 7
      if (!game.clearMode || game.diceValue !== 7) return
      
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
      })
    })

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`[DISCONNECT] Socket ${socket.id} disconnected`)
      
      // Find and clean up games
      games.forEach((game, roomId) => {
        const player = Array.from(game.players.values()).find(p => p.socketId === socket.id)
        if (player) {
          console.log(`[DISCONNECT] Player ${player.name}(${player.symbol}) disconnected from room ${roomId}`)
          
          // Mark player as disconnected but keep them in the game temporarily
          player.disconnectedAt = Date.now()
          player.oldSocketId = socket.id
          
          // Notify others that player disconnected
          io.to(roomId).emit('player-left', { playerId: player.id })
          
          // Set timeout to actually remove player if they don't reconnect
          setTimeout(() => {
            const currentGame = games.get(roomId)
            if (!currentGame) return
            
            const stillDisconnected = Array.from(currentGame.players.values()).find(p => p.id === player.id && p.disconnectedAt)
            if (stillDisconnected) {
              console.log(`[DISCONNECT] Removing ${player.name} after grace period`)
              currentGame.players.delete(player.id)
              
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
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
    })
})
