'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'
import useSound from '@/hooks/useSound'
import Board from '@/components/Board'
import Dice from '@/components/Dice'
import ReactionButton, { ReactionButtonRef } from '@/components/ReactionButton'
import confetti from 'canvas-confetti'

export default function GamePage() {
  const searchParams = useSearchParams()
  const roomId = searchParams.get('room')
  const {
    playerSymbol,
    players,
    gameState,
    error,
    rollDice,
    cellClick,
    clearBoard,
    restoreBoard,
    resetGame,
    sendReaction,
    buyMode,
    cancelMode,
    isConnected,
    joinRoom,
    joinAsCreator,
    rejoinRoom,
    startTurnTimer,
    socketRef,
    setPlayerSymbol,
  } = useSocket()

  const { playDiceRoll, playWin, playSteal, playClear, playColumnFull, playTurnExpired } = useSound()

  const [mounted, setMounted] = useState(false)
  const [joined, setJoined] = useState(false)
  const [playerName, setPlayerName] = useState('')
  const [floatingReactions, setFloatingReactions] = useState<{id: number, emoji: string, playerName: string, playerSymbol: 'X' | 'O', startX: number, startY: number}[]>([])
  const reactionButtonRef = useRef<ReactionButtonRef>(null)

  // Handle reactions from other players
  useEffect(() => {
    const handleReaction = (event: CustomEvent) => {
      const { emoji, playerName, playerSymbol } = event.detail
      const id = Date.now() + Math.random()
      
      // Get button position for animation start
      const buttonRect = reactionButtonRef.current?.getButtonRect()
      const startX = buttonRect ? buttonRect.left + buttonRect.width / 2 : window.innerWidth / 2
      const startY = buttonRect ? buttonRect.top : window.innerHeight - 100
      
      setFloatingReactions(prev => [...prev, { id, emoji, playerName, playerSymbol, startX, startY }])
      
      // Remove after animation
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(r => r.id !== id))
      }, 3000)
    }

    window.addEventListener('game-reaction', handleReaction as EventListener)
    return () => window.removeEventListener('game-reaction', handleReaction as EventListener)
  }, [])

  const handleSendReaction = useCallback((emoji: string) => {
    sendReaction(emoji)
    // Also show own reaction locally
    const id = Date.now() + Math.random()
    const buttonRect = reactionButtonRef.current?.getButtonRect()
    const startX = buttonRect ? buttonRect.left + buttonRect.width / 2 : window.innerWidth / 2
    const startY = buttonRect ? buttonRect.top : window.innerHeight - 100
    
    setFloatingReactions(prev => [...prev, { 
      id, 
      emoji, 
      playerName: playerName || 'Você', 
      playerSymbol: playerSymbol || 'X',
      startX,
      startY
    }])
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }, [sendReaction, playerName, playerSymbol])

  useEffect(() => {
    setMounted(true)
    // Get player name from URL first (for quick match to avoid localStorage conflicts)
    const params = new URLSearchParams(window.location.search)
    const urlName = params.get('name')
    if (urlName) {
      setPlayerName(decodeURIComponent(urlName))
      // Don't save URL name to storage - it's just for this session
    } else {
      // Fallback to sessionStorage (each tab has its own name)
      const storedName = sessionStorage.getItem('playerName')
      if (storedName) {
        setPlayerName(storedName)
      }
    }
    // Clear inRoom flag when entering game page (for fresh start next time)
    localStorage.removeItem('inRoom')
  }, [])

  // Listen for start-game event (for quick match)
  useEffect(() => {
    if (!socketRef.current) return

    // Get name from URL directly to avoid stale state
    const urlParams = new URLSearchParams(window.location.search)
    const urlName = urlParams.get('name')
    const myName = urlName ? decodeURIComponent(urlName) : playerName

    const handleStartGame = (data: { roomId: string; players: { name: string; symbol: string }[]; currentPlayer: string }) => {
      console.log('[Game] Start game event received:', data)
      console.log('[Game] My playerName (from URL):', myName)
      // Find my symbol from the players list (with trim to handle extra spaces)
      const myPlayer = data.players.find(p => p.name.trim() === myName.trim())
      if (myPlayer) {
        console.log('[Game] My symbol from start-game:', myPlayer.symbol)
        sessionStorage.setItem('playerSymbol', myPlayer.symbol)
        setPlayerSymbol(myPlayer.symbol as 'X' | 'O')
      } else {
        console.log('[Game] Could not find my player in list!')
      }
      setJoined(true)
      // currentPlayer is already set in useSocket via setGameState
    }

    socketRef.current.on('start-game', handleStartGame)

    return () => {
      socketRef.current?.off('start-game', handleStartGame)
    }
  }, [socketRef, playerName, setPlayerSymbol])

  // Also sync playerSymbol from useSocket when it changes
  useEffect(() => {
    if (playerSymbol) {
      console.log('[Game] playerSymbol changed to:', playerSymbol)
      localStorage.setItem('playerSymbol', playerSymbol)
    }
  }, [playerSymbol])

  // Join room when entering game page
  useEffect(() => {
    // Get symbol from URL first (from matchmaking)
    const urlParams = new URLSearchParams(window.location.search)
    const urlSymbol = urlParams.get('symbol')

    // If no symbol in URL, clear localStorage to avoid stale data
    // This handles the case where a new player joins without URL symbol
    if (!urlSymbol) {
      localStorage.removeItem('playerSymbol')
    }

    const savedSymbol = localStorage.getItem('playerSymbol')
    const finalSymbol = urlSymbol || savedSymbol

    console.log('[Game] Symbol from URL:', urlSymbol, 'from localStorage:', savedSymbol, 'final:', finalSymbol)

    // If we have a symbol, try to join
    if (finalSymbol && roomId) {
      // Both X and O join normally - the server will assign the correct symbol
      // based on existing players in the room
      if (isConnected && !joined) {
        console.log('[Game] Joining room as', finalSymbol, '...')
        joinRoom(roomId, playerName, (success) => {
          if (success) {
            setJoined(true)
          }
        })
        return
      }
    }

    // No saved symbol - try to join as second player automatically
    // This handles the case where both players open the same link
    if (roomId && isConnected && !joined && playerName) {
      joinRoom(roomId, playerName, (success) => {
        if (success) {
          setJoined(true)
        }
      })
    }
  }, [roomId, isConnected, joined, playerName, joinRoom, joinAsCreator, rejoinRoom])

  // Remove the separate creator rejoin effect - now handled above

  // Sound effects
  useEffect(() => {
    if (!mounted) return
    
    // Play dice roll sound when rolling starts
    if (gameState.isRolling) {
      playDiceRoll()
    }
  }, [gameState.isRolling, mounted, playDiceRoll])

  useEffect(() => {
    if (!mounted || !gameState.winner) return
    
    // Play win sound when someone wins
    playWin()
    
    // Trigger confetti animation
    const duration = 3000
    const end = Date.now() + duration

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
      })
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff']
      })

      if (Date.now() < end) {
        requestAnimationFrame(frame)
      }
    }
    frame()
  }, [gameState.winner, mounted, playWin])

  // Play steal sound when steal mode activates (dice = 0)
  useEffect(() => {
    if (!mounted) return
    
    if (gameState.stealMode && gameState.diceValue === 0) {
      playSteal()
    }
  }, [gameState.stealMode, gameState.diceValue, mounted, playSteal])

  // Play clear sound when clear mode activates (dice = 7)
  useEffect(() => {
    if (!mounted) return

    if (gameState.clearMode && gameState.diceValue === 7) {
      playClear()
    }
  }, [gameState.clearMode, gameState.diceValue, mounted, playClear])

  // Play inversion sound when inversion mode activates (dice = 8)
  useEffect(() => {
    if (!mounted) return

    if (gameState.inversionMode && gameState.diceValue === 8) {
      playSteal() // Reuse steal sound for inversion
    }
  }, [gameState.inversionMode, gameState.diceValue, mounted, playSteal])

  // Play column full sound when column is full
  useEffect(() => {
    if (!mounted) return

    if (gameState.columnFull) {
      playColumnFull()
    }
  }, [gameState.columnFull, mounted, playColumnFull])

  // Turn timer effect
  useEffect(() => {
    if (!mounted || !roomId) return

    // Start timer when game starts
    if (gameState.gameStarted && players.length === 2) {
      startTurnTimer()
    }

    // Restart timer when turn changes
    if (gameState.gameStarted && players.length === 2) {
      startTurnTimer()
    }
  }, [gameState.gameStarted, gameState.currentPlayer, players.length, mounted, roomId, startTurnTimer])

  // Play sound when timer expires
  useEffect(() => {
    if (!mounted) return
    if (gameState.turnTimeLeft === 0) {
      playTurnExpired()
    }
  }, [gameState.turnTimeLeft, mounted, playTurnExpired])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    )
  }

  if (!roomId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Sala não encontrada</h1>
          <a
            href="/lobby"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Voltar ao Lobby
          </a>
        </div>
      </div>
    )
  }

  const isMyTurn = playerSymbol === gameState.currentPlayer
  const canRoll = gameState.gameStarted && isMyTurn && !gameState.isRolling && !gameState.winner && !gameState.stealMode && !gameState.clearMode && !gameState.restoreMode
  console.log('[Game] ★ canRoll:', canRoll, 'gameStarted:', gameState.gameStarted, 'isMyTurn:', isMyTurn, 'isRolling:', gameState.isRolling, 'winner:', gameState.winner, 'playerSymbol:', playerSymbol, 'currentPlayer:', gameState.currentPlayer, 'stealMode:', gameState.stealMode, 'clearMode:', gameState.clearMode)

  // Debug: Log when dice is clicked
  const handleDiceClickDebug = () => {
    console.log('[Dice] Clicked! canRoll:', canRoll, 'playerSymbol:', playerSymbol, 'currentPlayer:', gameState.currentPlayer)
    if (canRoll) {
      rollDice()
    }
  }
  const leftBoardActive = gameState.allowedColumn !== null && gameState.allowedColumn <= 2
  const rightBoardActive = gameState.allowedColumn !== null && gameState.allowedColumn >= 3

  return (
    <div className="min-h-screen p-2 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900 relative">
      {/* Floating Reactions - Starting from button position */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute"
            style={{
              left: reaction.startX,
              top: reaction.startY,
              animation: 'floatUpFromButton 3s ease-out forwards',
            }}
          >
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
              reaction.playerSymbol === 'X'
                ? 'bg-blue-500 text-white'
                : 'bg-green-500 text-white'
            }`}
            >
              <span className="text-2xl">{reaction.emoji}</span>
              <span className="text-sm font-bold">{reaction.playerName}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl md:text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            🎲 Jogo da Velha Online
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-mono">
              Sala: {roomId}
            </span>
            <span className={`px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'}`}>
              {isConnected ? '🟢 Online' : '🟡 Conectando...'}
            </span>
            {playerSymbol && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                Você é: {playerSymbol}
              </span>
            )}
          </div>
        </div>

        {/* Players and Score */}
        <div className="flex flex-col items-center gap-4 mb-4">
          <div className="flex justify-center gap-4">
            {players.map((player, index) => (
              <div
                key={index}
                className={`px-4 py-2 rounded-lg ${
                  gameState.currentPlayer === player.symbol
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-400'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                <span className="font-bold">{player.name}</span>
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                  ({player.symbol})
                </span>
              </div>
            ))}
          </div>
          
          {/* Score Board */}
          <div className="flex items-center gap-6 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl text-white shadow-lg">
            <div className="text-center">
              <div className="text-xs opacity-80">Jogador X</div>
              <div className="text-2xl font-bold">{gameState.score.playerX}</div>
            </div>
            <div className="text-xl font-bold opacity-60">VS</div>
            <div className="text-center">
              <div className="text-xs opacity-80">Jogador O</div>
              <div className="text-2xl font-bold">{gameState.score.playerO}</div>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-700 dark:text-red-300 text-center">
            {error}
          </div>
        )}

        {/* Waiting for players */}
        {!gameState.gameStarted && players.length < 2 && (
          <div className="mb-4 p-4 bg-blue-100 dark:bg-blue-900/30 border border-blue-400 dark:border-blue-600 rounded-lg text-center">
            <p className="text-blue-700 dark:text-blue-300">
              Aguardando jogador 2...
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Compartilhe o código <strong>{roomId}</strong> com seu amigo!
            </p>
          </div>
        )}

        {/* Room ready - waiting for start (room code mode) */}
        {!gameState.gameStarted && players.length === 2 && (
          <div className="mb-4 p-4 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 rounded-lg text-center">
            <p className="text-green-700 dark:text-green-300 font-semibold">
              Ambos jogadores conectados! Preparados?
            </p>
            <button
              onClick={() => {
                console.log('[Game] ★★★ Clicked Iniciar Partida ★★★')
                console.log('[Game] socketRef:', socketRef?.current ? 'exists' : 'null')
                console.log('[Game] roomId from URL:', roomId)
                console.log('[Game] isConnected:', isConnected)

                if (!socketRef.current) {
                  console.error('[Game] Socket not available!')
                  alert('Socket não conectado')
                  return
                }
                if (!roomId) {
                  console.error('[Game] Room ID missing!')
                  alert('Sala não encontrada')
                  return
                }

                console.log('[Game] Emitting start-game-now with roomId:', roomId)
                console.log('[Game] Socket ID:', socketRef.current.id)
                console.log('[Game] Socket connected:', socketRef.current.connected)

                socketRef.current.emit('start-game-now', { roomId }, (response: any) => {
                  console.log('[Game] start-game-now response:', response)
                  if (!response) {
                    alert('Erro ao iniciar partida')
                  }
                })
              }}
              className="mt-3 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors"
            >
              Iniciar Partida
            </button>
          </div>
        )}

        {/* Game Area */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 md:p-6">
          {/* Boards - Sempre lado a lado */}
          <div className="flex flex-row gap-2 md:gap-6 mb-4">
            <div className="flex-1 min-w-0">
              <Board
                board={gameState.boardLeft}
                currentPlayer={gameState.currentPlayer}
                allowedColumn={gameState.allowedColumn}
                onCellClick={(row, col) => {
                  if (gameState.restoreMode) {
                    restoreBoard()
                  } else if (gameState.inversionMode) {
                    socketRef.current?.emit('invert-marks', { roomId })
                  } else if (gameState.clearMode) {
                    clearBoard('left')
                  } else {
                    cellClick('left', row, col)
                  }
                }}
                playerName="1-3"
                isActive={isMyTurn && (leftBoardActive || gameState.stealMode || gameState.clearMode || gameState.inversionMode || gameState.restoreMode)}
                diceStart={1}
                stealMode={gameState.stealMode}
                clearMode={gameState.clearMode}
                inversionMode={gameState.inversionMode}
                restoreMode={gameState.restoreMode}
              />
            </div>

            <div className="flex-1 min-w-0">
              <Board
                board={gameState.boardRight}
                currentPlayer={gameState.currentPlayer}
                allowedColumn={gameState.allowedColumn}
                onCellClick={(row, col) => {
                  if (gameState.restoreMode) {
                    restoreBoard()
                  } else if (gameState.inversionMode) {
                    socketRef.current?.emit('invert-marks', { roomId })
                  } else if (gameState.clearMode) {
                    clearBoard('right')
                  } else {
                    cellClick('right', row, col)
                  }
                }}
                playerName="4-6"
                isActive={isMyTurn && (rightBoardActive || gameState.stealMode || gameState.clearMode || gameState.inversionMode || gameState.restoreMode)}
                diceStart={4}
                stealMode={gameState.stealMode}
                clearMode={gameState.clearMode}
                inversionMode={gameState.inversionMode}
                restoreMode={gameState.restoreMode}
              />
            </div>
          </div>

          {/* Dice and Reaction Area - Side by Side */}
          {!gameState.winner ? (
            <div className="flex items-stretch justify-center gap-3 mt-4">
              {/* Dice Area - 80% with turn indicator border */}
              <div className={`flex-[0.8] p-3 rounded-xl flex flex-col items-center transition-all duration-300 ${
                isMyTurn && !gameState.isRolling && !gameState.stealMode && !gameState.clearMode && !gameState.restoreMode && gameState.allowedColumn === null
                  ? 'bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-100 dark:from-yellow-900/40 dark:via-yellow-800/40 dark:to-yellow-900/40 border-4 border-yellow-500 dark:border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-pulse'
                  : gameState.stealMode && isMyTurn
                  ? 'bg-gradient-to-r from-purple-100 via-purple-200 to-purple-100 dark:from-purple-900/40 dark:via-purple-800/40 dark:to-purple-900/40 border-4 border-purple-500 dark:border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                  : gameState.clearMode && isMyTurn
                  ? 'bg-gradient-to-r from-red-100 via-red-200 to-red-100 dark:from-red-900/40 dark:via-red-800/40 dark:to-red-900/40 border-4 border-red-500 dark:border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
                  : gameState.restoreMode && isMyTurn
                  ? 'bg-gradient-to-r from-green-100 via-green-200 to-green-100 dark:from-green-900/40 dark:via-green-800/40 dark:to-green-900/40 border-4 border-green-500 dark:border-green-400 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                  : 'bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-700'
              }`}>
                <div className="text-center mb-2">
                  <p className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                    {gameState.stealMode ? (
                      <span className="text-purple-600 dark:text-purple-400">
                        🔥 MODO ROUBO! Clique em uma casa do adversário!
                      </span>
                    ) : gameState.clearMode ? (
                      <span className="text-red-600 dark:text-red-400">
                        🧹 MODO LIMPAR! Escolha qual tabuleiro limpar!
                      </span>
                    ) : gameState.restoreMode ? (
                      <span className="text-green-600 dark:text-green-400">
                        ♻️ MODO RESTAURAR! Clique em qualquer tabuleiro para restaurar!
                      </span>
                    ) : (
                      <>
                        Vez do{' '}
                        <span
                          className={
                            gameState.currentPlayer === 'X'
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-green-600 dark:text-green-400'
                          }
                        >
                          Jogador {gameState.currentPlayer}
                        </span>
                        {isMyTurn && ' (Você) ✅'}
                      </>
                    )}
                  </p>
                  {!gameState.stealMode && !gameState.clearMode && !gameState.restoreMode && (
                    <p className={`text-xs md:text-sm mt-1 font-bold ${
                      isMyTurn && !gameState.isRolling && gameState.allowedColumn === null
                        ? 'text-yellow-700 dark:text-yellow-300 animate-bounce'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {gameState.isRolling
                        ? 'Sorteando...'
                        : gameState.allowedColumn !== null
                        ? `Marque na coluna ${(gameState.allowedColumn % 3) + 1}`
                        : canRoll
                        ? '🎲 SUA VEZ! Clique no dado para sortear!'
                        : 'Aguardando...'}
                    </p>
                  )}
                </div>

                {/* Dice */}
                <div className="flex flex-row items-center justify-center gap-4">
                  <Dice
                    value={gameState.diceValue}
                    size="lg"
                    isRolling={gameState.isRolling}
                    onClick={canRoll ? rollDice : (gameState.stealMode || gameState.clearMode || gameState.inversionMode || gameState.restoreMode) ? cancelMode : undefined}
                    disabled={!canRoll && !(gameState.stealMode || gameState.clearMode || gameState.inversionMode || gameState.restoreMode)}
                  />
                  {/* Dice Value Display - Ao lado direito */}
                  <div className="text-center">
                    <p className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
                      {gameState.diceValue}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Reaction Button Area - 20% */}
              {gameState.gameStarted && players.length === 2 && (
                <div className="flex-[0.2] flex flex-col items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-700 p-2">
                  {/* Turn Timer */}
                  {gameState.currentPlayer === playerSymbol && (
                    <div className={`text-3xl font-bold ${gameState.turnTimeLeft <= 3 ? 'text-red-600 animate-pulse' : 'text-white'}`}>
                      {gameState.turnTimeLeft}
                    </div>
                  )}
                  <ReactionButton
                    ref={reactionButtonRef}
                    onReaction={handleSendReaction}
                    disabled={!isConnected}
                  />
                  {/* Coins Display - Always Visible */}
                  <div className="relative">
                    <button
                      onClick={() => document.getElementById('buy-menu')?.classList.toggle('hidden')}
                      className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white font-bold rounded-lg transition-colors"
                    >
                      🪙 {(playerSymbol === 'X' ? gameState.coins.playerX : gameState.coins.playerO)}
                    </button>
                    {/* Floating Menu */}
                    <div id="buy-menu" className="hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-300 dark:border-gray-600 p-2 z-50 min-w-[140px]">
                      <button
                        onClick={() => { buyMode('steal'); document.getElementById('buy-menu')?.classList.add('hidden'); }}
                        disabled={gameState.isRolling}
                        className="w-full px-3 py-2 mb-1 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        🔥 Roubar
                      </button>
                      <button
                        onClick={() => { buyMode('clear'); document.getElementById('buy-menu')?.classList.add('hidden'); }}
                        disabled={gameState.isRolling}
                        className="w-full px-3 py-2 mb-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        🧹 Limpar
                      </button>
                      <button
                        onClick={() => { buyMode('invert'); document.getElementById('buy-menu')?.classList.add('hidden'); }}
                        disabled={gameState.isRolling}
                        className="w-full px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        🎭 Inverter
                      </button>
                      <button
                        onClick={() => { buyMode('time'); document.getElementById('buy-menu')?.classList.add('hidden'); }}
                        disabled={gameState.isRolling || (playerSymbol === 'X' ? gameState.coins.playerX : gameState.coins.playerO) < 1}
                        className="w-full px-3 py-2 mb-1 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        ⏱️ Tempo (1🪙)
                      </button>
                      <button
                        onClick={() => { buyMode('restore'); document.getElementById('buy-menu')?.classList.add('hidden'); }}
                        disabled={gameState.isRolling || (playerSymbol === 'X' ? gameState.coins.playerX : gameState.coins.playerO) < 2}
                        className="w-full px-3 py-2 mt-1 bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white text-sm font-bold rounded-lg transition-colors"
                      >
                        ♻️ Restaurar (2🪙)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl border-2 border-yellow-400 dark:border-yellow-600 text-center">
              <div className="text-4xl md:text-5xl mb-2">🏆</div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                Jogador {gameState.winner} Venceu!
              </h2>
              {playerSymbol === gameState.winner && (
                <p className="text-green-600 dark:text-green-400 font-semibold mt-1">
                  Parabéns! 🎉
                </p>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mt-4">
          {gameState.winner && (
            <button
              type="button"
              onClick={resetGame}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              🔄 Jogar Novamente
            </button>
          )}
          <a
            href="/lobby"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            🚪 Sair da Sala
          </a>
        </div>

        {/* Instructions */}
        <div className="max-w-xl mx-auto mt-4 p-3 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
          <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">
            Como Jogar:
          </h3>
          <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
            <li>1. Clique no dado para sortear (0-6)</li>
            <li>2. Números 1, 2, 3 → tabuleiro esquerdo | 4, 5, 6 → tabuleiro direito</li>
            <li>
              3.{' '}
              <span className="text-purple-600 dark:text-purple-400 font-semibold">
                ZERO (0) = MODO ROUBO!
              </span>{' '}
              Roube uma casa do adversário!
            </li>
            <li>4. Se a coluna estiver cheia, a vez passa automaticamente</li>
            <li>5. Faça 3 em linha para vencer!</li>
          </ul>
        </div>

        {/* Credits */}
        <div className="text-center mt-6 pb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Desenvolvido com ❤️ por{' '}
            <span className="font-semibold text-gray-800 dark:text-gray-200">
              Eduardo Spek
            </span>
          </p>
          <a
            href="https://www.instagram.com/eduardospek"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors mt-1"
          >
            @eduardospek
          </a>
        </div>
      </div>

      {/* Floating Animation Styles */}
      <style jsx>{`
        @keyframes floatUp {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(0) scale(0.5);
          }
          10% {
            opacity: 1;
            transform: translateX(-50%) translateY(-20px) scale(1);
          }
          90% {
            opacity: 1;
            transform: translateX(-50%) translateY(-100px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-120px) scale(0.8);
          }
        }
        @keyframes floatUpFromButton {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(0) scale(0.5);
          }
          10% {
            opacity: 1;
            transform: translateX(-50%) translateY(-20px) scale(1);
          }
          90% {
            opacity: 1;
            transform: translateX(-50%) translateY(-150px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-180px) scale(0.8);
          }
        }
      `}</style>
    </div>
  )
}
