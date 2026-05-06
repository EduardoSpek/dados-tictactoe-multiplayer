'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

// Sound functions using Web Audio API
const playPlaceMarkSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    const ctx = new AudioContext()
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.frequency.value = 800
    oscillator.type = 'sine'

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)

    oscillator.start(ctx.currentTime)
    oscillator.stop(ctx.currentTime + 0.15)
    
    // Second tone
    setTimeout(() => {
      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.frequency.value = 1200
      osc2.type = 'sine'
      gain2.gain.setValueAtTime(0.3, ctx.currentTime)
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1)
      osc2.start(ctx.currentTime)
      osc2.stop(ctx.currentTime + 0.1)
    }, 50)
  } catch (e) {
    console.log('Audio not supported')
  }
}

interface GameState {
  boardLeft: (string | null)[][]
  boardRight: (string | null)[][]
  currentPlayer: 'X' | 'O'
  diceValue: number
  isRolling: boolean
  allowedColumn: number | null
  winner: string | null
  stealMode: boolean
  clearMode: boolean
  inversionMode: boolean
  restoreMode: boolean
  timeAttackMode: boolean
  gameStarted: boolean
  score: { playerX: number; playerO: number }
  coins: { playerX: number; playerO: number }
  columnFull: boolean
  turnTimeLeft: number
}

interface Player {
  symbol: 'X' | 'O'
  name: string
}

export function useSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [playerSymbol, setPlayerSymbol] = useState<'X' | 'O' | null>(() => {
    // Try to get from URL first (for quick match), then localStorage
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const urlSymbol = urlParams.get('symbol')
      if (urlSymbol === 'X' || urlSymbol === 'O') {
        return urlSymbol
      }
      const saved = localStorage.getItem('playerSymbol')
      return saved as 'X' | 'O' | null
    }
    return null
  })
  const [players, setPlayers] = useState<Player[]>([])
  const [gameState, setGameState] = useState<GameState>({
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
    restoreMode: false,
    timeAttackMode: false,
    gameStarted: false,
    score: { playerX: 0, playerO: 0 },
    coins: { playerX: 0, playerO: 0 },
    columnFull: false,
    turnTimeLeft: 10,
  })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Initialize socket connection
    let serverUrl: string
    
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      
      // Se for localhost ou IP local, usa porta 3001
      if (hostname === 'localhost' || /^192\.168\./.test(hostname) || /^10\./.test(hostname)) {
        serverUrl = `http://${hostname}:3001`
      } else {
        // Cloudflare tunnel ou outro domínio: usa a URL atual (sem porta)
        serverUrl = window.location.origin
      }
    } else {
      serverUrl = 'http://localhost:3001'
    }
    
    console.log('Connecting to:', serverUrl)
    
    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('Connected to server')
      setIsConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('Disconnected from server')
      setIsConnected(false)
    })

    socket.on('player-joined', (data: { playerId: string; symbol: 'X' | 'O'; name: string; playerCount: number }) => {
      console.log('Player joined:', data)
      // Add new player to the list if not already present
      setPlayers(prev => {
        if (prev.find(p => p.symbol === data.symbol)) return prev
        return [...prev, { symbol: data.symbol, name: data.name }]
      })
    })

    socket.on('players-list', (data: Player[]) => {
      console.log('Players list:', data)
      setPlayers(data)
    })

    // Room ready event - for room code mode, when both players have joined
    socket.on('room-ready', (data: { roomId: string; players: Player[] }) => {
      console.log('[CLIENT] ★★★ room-ready received ★★★:', data)
      console.log('[CLIENT] Players count:', data.players?.length)
      console.log('[CLIENT] Players data:', JSON.stringify(data.players))
      setPlayers(data.players)
      // Also set gameStarted to true so players can roll the dice
      setGameState(prev => ({ ...prev, gameStarted: true, isRolling: false }))
      console.log('[CLIENT] gameStarted set to true!')
    })

    // Game started event (emitted by Next.js route.ts)
    socket.on('game-started', (data: { currentPlayer: 'X' | 'O'; players: Player[] }) => {
      console.log('[CLIENT] Game started (game-started):', data)
      setGameState(prev => ({ ...prev, gameStarted: true, currentPlayer: data.currentPlayer }))
      setPlayers(data.players)
    })

    socket.on('start-game', (data: { roomId: string; players: Player[]; currentPlayer: 'X' | 'O' }) => {
      console.log('[CLIENT] ★★★ Start game received ★★★:', data)
      // Update game state for ALL players (both creator and player 2)
      setPlayers(data.players)
      setGameState(prev => ({ ...prev, gameStarted: true, currentPlayer: data.currentPlayer, isRolling: false }))

      // Only set symbol and redirect if we don't have one yet AND not already on game page
      const existingSymbol = sessionStorage.getItem('playerSymbol')
      if (!existingSymbol && !window.location.pathname.includes('/game')) {
        // Find my symbol from players list and save to sessionStorage BEFORE redirect
        const myName = sessionStorage.getItem('playerName')
        const me = data.players.find((p: Player) => p.name === myName)
        if (me) {
          setPlayerSymbol(me.symbol)
          sessionStorage.setItem('playerSymbol', me.symbol)
        }
        // Redirect to game page (only for creator)
        window.location.href = `/game?room=${data.roomId}`
      }
    })


    socket.on('sync-game-state', (data: {
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      currentPlayer: 'X' | 'O'
      diceValue: number
      allowedColumn: number | null
      winner: string | null
      stealMode: boolean
      clearMode?: boolean
      inversionMode?: boolean
      restoreMode?: boolean
      timeAttackMode?: boolean
    }) => {
      console.log('Sync game state:', data)
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        diceValue: data.diceValue,
        allowedColumn: data.allowedColumn,
        winner: data.winner,
        stealMode: data.stealMode,
        clearMode: data.clearMode || false,
        inversionMode: data.inversionMode || false,
        restoreMode: data.restoreMode || false,
        timeAttackMode: data.timeAttackMode || false,
        gameStarted: true,
      }))
    })

    socket.on('dice-rolling', (value: number) => {
      setGameState(prev => ({ ...prev, diceValue: value, isRolling: true }))
    })

    socket.on('dice-rolled', (data: {
      value: number
      currentPlayer: 'X' | 'O'
      allowedColumn: number | null
      stealMode: boolean
      clearMode?: boolean
      inversionMode?: boolean
      restoreMode?: boolean
      timeAttackMode?: boolean
      columnFull?: boolean
    }) => {
      setGameState(prev => ({
        ...prev,
        diceValue: data.value,
        currentPlayer: data.currentPlayer,
        allowedColumn: data.allowedColumn,
        stealMode: data.stealMode,
        clearMode: data.clearMode || false,
        inversionMode: data.inversionMode || false,
        restoreMode: data.restoreMode || false,
        timeAttackMode: data.timeAttackMode || false,
        isRolling: false,
        columnFull: data.columnFull || false,
      }))
    })

    socket.on('cell-marked', (data: {
      boardSide: 'left' | 'right'
      row: number
      col: number
      player: 'X' | 'O'
      currentPlayer: 'X' | 'O'
      winner: string | null
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      score?: { playerX: number; playerO: number }
      coins?: { playerX: number; playerO: number }
      playSound?: boolean
    }) => {
      console.log('[cell-marked] Received:', data)
      // Play sound if server sent playSound flag
      if (data.playSound) {
        playPlaceMarkSound()
      }
      setGameState(prev => {
        console.log('[cell-marked] Updating currentPlayer from', prev.currentPlayer, 'to', data.currentPlayer)
        return {
          ...prev,
          boardLeft: data.boardLeft,
          boardRight: data.boardRight,
          currentPlayer: data.currentPlayer,
          winner: data.winner,
          allowedColumn: null,
          stealMode: false,
          clearMode: false,
          inversionMode: false,
          restoreMode: false,
          score: data.score || prev.score,
          coins: data.coins || prev.coins,
        }
      })
    })

    socket.on('cell-stolen', (data: {
      boardSide: 'left' | 'right'
      row: number
      col: number
      player: 'X' | 'O'
      currentPlayer: 'X' | 'O'
      winner: string | null
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      score?: { playerX: number; playerO: number }
      coins?: { playerX: number; playerO: number }
      playSound?: boolean
    }) => {
      // Play sound if server sent playSound flag
      if (data.playSound) {
        playPlaceMarkSound()
      }
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        winner: data.winner,
        stealMode: false,
        clearMode: false,
        score: data.score || prev.score,
        coins: data.coins || prev.coins,
      }))
    })

    socket.on('board-cleared', (data: {
      boardSide: 'left' | 'right'
      currentPlayer: 'X' | 'O'
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      playSound?: boolean
    }) => {
      // Play sound if server sent playSound flag
      if (data.playSound) {
        playPlaceMarkSound()
      }
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        stealMode: false,
        clearMode: false,
        restoreMode: false,
        allowedColumn: null,
      }))
    })

    socket.on('board-restored', (data: {
      currentPlayer: 'X' | 'O'
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      playSound?: boolean
    }) => {
      if (data.playSound) {
        playPlaceMarkSound()
      }
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        restoreMode: false,
        allowedColumn: null,
      }))
    })

    socket.on('marks-inverted', (data: {
      currentPlayer: 'X' | 'O'
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      playSound?: boolean
    }) => {
      // Play sound if server sent playSound flag
      if (data.playSound) {
        playPlaceMarkSound()
      }
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        stealMode: false,
        clearMode: false,
        inversionMode: false,
        restoreMode: false,
        allowedColumn: null,
      }))
    })

    socket.on('game-reset', (data: {
      boardLeft: (string | null)[][]
      boardRight: (string | null)[][]
      currentPlayer: 'X' | 'O'
      coins: { playerX: number; playerO: number }
    }) => {
      setGameState(prev => ({
        ...prev,
        boardLeft: data.boardLeft,
        boardRight: data.boardRight,
        currentPlayer: data.currentPlayer,
        winner: null,
        stealMode: false,
        clearMode: false,
        allowedColumn: null,
        isRolling: false,
        diceValue: 1,
        coins: data.coins,
      }))
    })

    socket.on('player-temporarily-disconnected', () => {
      // Show temporary message - don't end game yet, give player time to reconnect
      setError('Oponente temporariamente desconectado...')
    })

    socket.on('player-left', () => {
      setError('Oponente desconectou')
    })

    socket.on('player-rejoined', () => {
      setError(null) // Clear error when opponent reconnects
    })

    // Turn timer events
    socket.on('turn-timer', (data: { timeLeft: number; currentPlayer: 'X' | 'O' }) => {
      setGameState(prev => ({
        ...prev,
        turnTimeLeft: data.timeLeft,
      }))
    })

    socket.on('turn-expired', (data: { previousPlayer: 'X' | 'O'; newCurrentPlayer: 'X' | 'O'; coins: { playerX: number; playerO: number } }) => {
      console.log('Turn expired:', data)
      setGameState(prev => ({
        ...prev,
        currentPlayer: data.newCurrentPlayer,
        turnTimeLeft: 15,
        allowedColumn: null,
        diceValue: prev.diceValue,
        stealMode: false,
        clearMode: false,
        inversionMode: false,
        timeAttackMode: false,
        coins: data.coins,
      }))
    })

    // Listen for mode bought
    socket.on('mode-bought', (data: {
      mode: string
      currentPlayer: 'X' | 'O'
      coins: { playerX: number; playerO: number }
      stealMode: boolean
      clearMode: boolean
      inversionMode: boolean
      restoreMode: boolean
      timeAttackMode: boolean
    }) => {
      console.log('Mode bought:', data)
      setGameState(prev => ({
        ...prev,
        currentPlayer: data.currentPlayer,
        coins: data.coins,
        stealMode: data.stealMode,
        clearMode: data.clearMode,
        inversionMode: data.inversionMode,
        restoreMode: data.restoreMode,
        timeAttackMode: data.timeAttackMode,
      }))
    })

    // Listen for buy failed
    socket.on('buy-failed', (data: { reason: string }) => {
      console.log('Buy failed:', data.reason)
      if (data.reason === 'moedas') {
        setError('Moedas insuficientes!')
      } else if (data.reason === 'sem-oponente') {
        setError('Não há marcas do oponente!')
      } else if (data.reason === 'sem-marca') {
        setError('Precisa de marcas X e O no tabuleiro!')
      } else if (data.reason === 'sem-limpar') {
        setError('O adversário não limpou nenhum tabuleiro ainda!')
      }
    })

    // Listen for mode cancelled
    socket.on('mode-cancelled', (data: {
      currentPlayer: 'X' | 'O'
      stealMode: boolean
      clearMode: boolean
      inversionMode: boolean
    }) => {
      console.log('Mode cancelled:', data)
      setGameState(prev => ({
        ...prev,
        currentPlayer: data.currentPlayer,
        stealMode: data.stealMode,
        clearMode: data.clearMode,
        inversionMode: data.inversionMode,
      }))
    })

    // Listen for reactions
    socket.on('reaction-received', (data: {
      emoji: string
      playerName: string
      playerSymbol: 'X' | 'O'
      timestamp: number
    }) => {
      // Dispatch custom event for ReactionButton component
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('game-reaction', { detail: data }))
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const createRoom = useCallback((playerName: string, callback: (roomId: string) => void) => {
    if (!socketRef.current) return
    socketRef.current.emit('create-room', playerName, (newRoomId: string) => {
      setRoomId(newRoomId)
      setPlayerSymbol('X')
      sessionStorage.setItem('playerSymbol', 'X')
      sessionStorage.setItem('inRoom', newRoomId)
      callback(newRoomId)
    })
  }, [])

  const joinRoom = useCallback((roomId: string, playerName: string, callback: (success: boolean, message?: string, symbol?: 'X' | 'O') => void) => {
    if (!socketRef.current) return
    console.log('[joinRoom] Joining room:', roomId, 'as', playerName)
    socketRef.current.emit('join-room', { roomId, playerName }, (success: boolean, message?: string) => {
      console.log('[joinRoom] Result:', success, 'message:', message)
      if (success) {
        setRoomId(roomId.toUpperCase())
        // Determine symbol from message - check for "Jogador X" or "Jogador O"
        const symbol = message?.includes('Jogador X') ? 'X' : 'O'
        console.log('[joinRoom] Setting playerSymbol to:', symbol)
        setPlayerSymbol(symbol)
        localStorage.setItem('playerSymbol', symbol)
        localStorage.setItem('inRoom', roomId.toUpperCase())
      }
      callback(success, message)
    })
  }, [])

  const rollDice = useCallback(() => {
    console.log('[rollDice] Called - socket:', !!socketRef.current, 'roomId:', roomId)
    if (!socketRef.current || !roomId) {
      console.log('[rollDice] Early return - no socket or roomId')
      return
    }
    console.log('[rollDice] Emitting roll-dice event for room:', roomId)
    socketRef.current.emit('roll-dice', roomId)
  }, [roomId])

  const buyMode = useCallback((mode: 'steal' | 'clear' | 'invert' | 'restore') => {
    console.log('[buyMode] Called with mode:', mode, 'roomId:', roomId, 'socket:', !!socketRef.current)
    if (!socketRef.current || !roomId) {
      console.log('[buyMode] Early return - no socket or roomId')
      return
    }
    socketRef.current.emit('buy-mode', { roomId, mode })
    console.log('[buyMode] Emitted buy-mode event')
  }, [roomId])

  const cancelMode = useCallback(() => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('cancel-mode', roomId)
  }, [roomId])

  const cellClick = useCallback((boardSide: 'left' | 'right', row: number, col: number) => {
    if (!socketRef.current || !roomId) return
    // Stop turn timer when player makes a move
    socketRef.current.emit('stop-turn-timer', roomId)
    socketRef.current.emit('cell-click', { roomId, boardSide, row, col })
  }, [roomId])

  const clearBoard = useCallback((boardSide: 'left' | 'right') => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('clear-board', { roomId, boardSide })
  }, [roomId])

  const restoreBoard = useCallback(() => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('restore-board', { roomId })
  }, [roomId])

  const resetGame = useCallback(() => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('reset-game', roomId)
  }, [roomId])

  const joinAsCreator = useCallback((roomId: string, callback: (success: boolean, players?: Player[]) => void) => {
    if (!socketRef.current) return
    socketRef.current.emit('join-as-creator', roomId, (success: boolean, players?: Player[]) => {
      if (success) {
        setRoomId(roomId.toUpperCase())
      }
      callback(success, players)
    })
  }, [])

  const rejoinRoom = useCallback((roomId: string, callback: (success: boolean, players?: Player[]) => void) => {
    if (!socketRef.current) return
    socketRef.current.emit('rejoin-room', roomId, (success: boolean, players?: Player[]) => {
      if (success) {
        setRoomId(roomId.toUpperCase())
      }
      callback(success, players)
    })
  }, [])

  const sendReaction = useCallback((emoji: string) => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('send-reaction', { roomId, emoji })
  }, [roomId])

  const startTurnTimer = useCallback(() => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('start-turn-timer', roomId)
  }, [roomId])

  const stopTurnTimer = useCallback(() => {
    if (!socketRef.current || !roomId) return
    socketRef.current.emit('stop-turn-timer', roomId)
  }, [roomId])

  const findMatch = useCallback((playerName: string, callback: (result: { status: string; roomId?: string }) => void) => {
    if (!socketRef.current) return
    socketRef.current.emit('find-match', playerName, (result: { status: string; roomId?: string }) => {
      if (result.status === 'waiting') {
        // Waiting for opponent - listen for match-found event
      } else if (result.status === 'already-in-game' && result.roomId) {
        setRoomId(result.roomId.toUpperCase())
      }
      callback(result)
    })
  }, [])

  const cancelMatch = useCallback(() => {
    if (!socketRef.current) return
    socketRef.current.emit('cancel-match')
  }, [])

  // Listen for match-found events
  useEffect(() => {
    if (!socketRef.current) return

    const handleMatchFound = (data: { roomId: string; symbol: 'X' | 'O'; opponent: string; players: { name: string; symbol: string }[] }) => {
      console.log('[useSocket] Match found - received symbol:', data.symbol, 'room:', data.roomId)
      setRoomId(data.roomId.toUpperCase())
      // Symbol is now read from URL in useState init, just store in localStorage for reconnection
      console.log('[useSocket] Symbol will be read from URL')
      localStorage.setItem('playerSymbol', data.symbol)
      localStorage.setItem('inRoom', data.roomId.toUpperCase())
    }

    socketRef.current.on('match-found', handleMatchFound)

    return () => {
      socketRef.current?.off('match-found', handleMatchFound)
    }
  }, [])

  return {
    isConnected,
    roomId,
    playerSymbol,
    players,
    gameState,
    error,
    createRoom,
    joinRoom,
    joinAsCreator,
    rejoinRoom,
    rollDice,
    buyMode,
    cancelMode,
    cellClick,
    clearBoard,
    restoreBoard,
    resetGame,
    sendReaction,
    startTurnTimer,
    setPlayerSymbol,
    stopTurnTimer,
    findMatch,
    cancelMatch,
    socketRef,
  }
}
