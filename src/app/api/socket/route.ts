import { Server as NetServer } from 'http'
import { NextRequest } from 'next/server'
import { Server as SocketIOServer } from 'socket.io'
import { v4 as uuidv4 } from 'uuid'

// Store for active games
const games: Map<string, GameRoom> = new Map()

interface GameRoom {
  id: string
  players: Map<string, Player>
  boardLeft: (string | null)[][]
  boardRight: (string | null)[][]
  currentPlayer: 'X' | 'O'
  diceValue: number
  isRolling: boolean
  allowedColumn: number | null
  winner: string | null
  stealMode: boolean
  gameStarted: boolean
}

interface Player {
  id: string
  socketId: string
  symbol: 'X' | 'O'
  name: string
}

export async function GET(req: NextRequest) {
  if ((global as any).io) {
    return new Response('Socket.IO server already running', { status: 200 })
  }

  const res = await fetch('http://localhost:3001')
  const httpServer = (res as any).server || new NetServer()
  
  const io = new SocketIOServer(httpServer, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  })

  ;(global as any).io = io

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id)

    // Create new game room
    socket.on('create-room', (playerName: string, callback: (roomId: string) => void) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase()
      
      const game: GameRoom = {
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
      }
      
      games.set(roomId, game)
      socket.join(roomId)
      
      callback(roomId)
      console.log(`Room created: ${roomId} by ${playerName}`)
    })

    // Join existing room
    socket.on('join-room', (data: { roomId: string; playerName: string }, callback: (success: boolean, message?: string) => void) => {
      const game = games.get(data.roomId.toUpperCase())
      
      if (!game) {
        callback(false, 'Sala não encontrada')
        return
      }
      
      if (game.players.size >= 2) {
        callback(false, 'Sala cheia')
        return
      }
      
      const symbol = game.players.size === 0 ? 'X' : 'O'
      const player: Player = {
        id: uuidv4(),
        socketId: socket.id,
        symbol,
        name: data.playerName,
      }

      // Check if this socket was previously in the room (reconnection)
      const existingPlayer = Array.from(game.players.values()).find(p => p.socketId === socket.id)
      if (existingPlayer) {
        // Reconnecting player - update socket ID but keep same player info
        game.players.delete(existingPlayer.id)
        player.id = existingPlayer.id
        player.symbol = existingPlayer.symbol
        player.name = existingPlayer.name
        player.disconnectedAt = undefined
      }

      game.players.set(socket.id, player)
      socket.join(data.roomId.toUpperCase())
      
      callback(true, `Entrou como Jogador ${symbol}`)
      
      // Notify room about new player
      io.to(data.roomId.toUpperCase()).emit('player-joined', {
        playerId: socket.id,
        symbol,
        name: data.playerName,
        playerCount: game.players.size,
      })

      // If this was a reconnection, notify everyone
      if (existingPlayer) {
        io.to(data.roomId.toUpperCase()).emit('player-rejoined', { playerId: socket.id })
      }

      // Auto-start when 2 players are connected
      if (game.players.size === 2) {
        game.gameStarted = true
        io.to(data.roomId.toUpperCase()).emit('game-started', {
          currentPlayer: 'X',
          players: Array.from(game.players.values()).map(p => ({ name: p.name, symbol: p.symbol })),
        })
      }

      console.log(`Player ${data.playerName} joined room ${data.roomId}`)
    })

    // Handle start-game-now (manual start)
    socket.on('start-game-now', (data: { roomId: string }) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || game.gameStarted || game.players.size < 2) return

      game.gameStarted = true
      io.to(data.roomId.toUpperCase()).emit('game-started', {
        currentPlayer: 'X',
        players: Array.from(game.players.values()).map(p => ({ name: p.name, symbol: p.symbol })),
      })
      console.log(`Game started in room ${data.roomId}`)
    })

    // Handle dice roll
    socket.on('roll-dice', (roomId: string) => {
      const game = games.get(roomId.toUpperCase())
      if (!game || game.isRolling || game.winner) return
      
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
          let finalValue: number
          if (hasOpponentCells) {
            finalValue = Math.floor(Math.random() * 7) // 0-6
          } else {
            finalValue = Math.floor(Math.random() * 6) + 1 // 1-6 only
          }
          
          game.diceValue = finalValue
          game.isRolling = false
          
          if (finalValue === 0) {
            game.stealMode = true
            game.allowedColumn = null
          } else {
            const column = finalValue - 1
            const boardSide = column <= 2 ? 'left' : 'right'
            const colIndex = column <= 2 ? column : column - 3
            
            // Check if column is full
            const board = boardSide === 'left' ? game.boardLeft : game.boardRight
            let isColumnFull = true
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
          })
        }
      }, 80)
    })

    // Handle cell click
    socket.on('cell-click', (data: { roomId: string; boardSide: 'left' | 'right'; row: number; col: number }) => {
      const game = games.get(data.roomId.toUpperCase())
      if (!game || !game.gameStarted || game.isRolling || game.winner) return
      
      const player = game.players.get(socket.id)
      if (!player || player.symbol !== game.currentPlayer) return
      
      const board = data.boardSide === 'left' ? game.boardLeft : game.boardRight
      const cellValue = board[data.row][data.col]
      
      // Steal mode
      if (game.stealMode) {
        const opponent = game.currentPlayer === 'X' ? 'O' : 'X'
        if (cellValue !== opponent) return
        
        board[data.row][data.col] = game.currentPlayer
        
        // Check winner
        const checkWinner = (board: (string | null)[][], player: string): boolean => {
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
      const checkWinner = (board: (string | null)[][], player: string): boolean => {
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
      })
    })

    // Reset game
    socket.on('reset-game', (roomId: string) => {
      const game = games.get(roomId.toUpperCase())
      if (!game) return
      
      game.boardLeft = Array(3).fill(null).map(() => Array(3).fill(null))
      game.boardRight = Array(3).fill(null).map(() => Array(3).fill(null))
      game.currentPlayer = 'X'
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

    // Disconnect - only emit player-left if player doesn't reconnect within 5 seconds
    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id)

      // Find the player's room first
      let playerRoom = null
      games.forEach((game, roomId) => {
        if (game.players.has(socket.id)) {
          playerRoom = { roomId, game }
        }
      })

      if (!playerRoom) return

      const { roomId, game } = playerRoom

      // Mark player as disconnected but don't remove immediately
      const player = game.players.get(socket.id)
      if (player) {
        player.disconnectedAt = Date.now()

        // Notify others that player is disconnected (temporarily)
        io.to(roomId).emit('player-temporarily-disconnected', { playerId: socket.id })

        // After 5 seconds, if player hasn't reconnected, remove them
        setTimeout(() => {
          const currentPlayer = game.players.get(socket.id)
          if (currentPlayer && currentPlayer.disconnectedAt) {
            // Player didn't reconnect - actually remove them
            game.players.delete(socket.id)
            io.to(roomId).emit('player-left', { playerId: socket.id })

            if (game.players.size === 0) {
              games.delete(roomId)
              console.log(`Room ${roomId} deleted`)
            }
          }
        }, 5000)
      }
    })
  })

  return new Response('Socket.IO server started', { status: 200 })
}
