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
    resetGame,
    sendReaction,
    isConnected,
    joinRoom,
    joinAsCreator,
    rejoinRoom,
  } = useSocket()

  const { playDiceRoll, playWin, playSteal, playClear, playColumnFull } = useSound()

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
    // Get player name from localStorage
    const storedName = localStorage.getItem('playerName')
    if (storedName) {
      setPlayerName(storedName)
    }
    // Clear inRoom flag when entering game page (for fresh start next time)
    localStorage.removeItem('inRoom')
  }, [])

  // Join room when entering game page
  useEffect(() => {
    const savedSymbol = localStorage.getItem('playerSymbol')
    
    // If we have a saved symbol for this room
    if (savedSymbol && roomId) {
      // Creator (X) needs to rejoin via socket
      if (savedSymbol === 'X' && isConnected && !joined) {
        joinAsCreator(roomId, (success) => {
          if (success) {
            setJoined(true)
          }
        })
        return
      }
      
      // Player 2 (O) needs to rejoin via socket too
      if (savedSymbol === 'O' && isConnected && !joined) {
        rejoinRoom(roomId, (success) => {
          if (success) {
            setJoined(true)
          }
        })
        return
      }
    }
    
    // Otherwise try to join (this is the second player without saved symbol)
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

  // Play column full sound when column is full
  useEffect(() => {
    if (!mounted) return
    
    if (gameState.columnFull) {
      playColumnFull()
    }
  }, [gameState.columnFull, mounted, playColumnFull])

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
  const canRoll = isMyTurn && !gameState.isRolling && !gameState.winner && !gameState.allowedColumn && !gameState.stealMode && !gameState.clearMode
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
                  if (gameState.clearMode) {
                    clearBoard('left')
                  } else {
                    cellClick('left', row, col)
                  }
                }}
                playerName="1-3"
                isActive={isMyTurn && (leftBoardActive || gameState.stealMode || gameState.clearMode)}
                diceStart={1}
                stealMode={gameState.stealMode}
                clearMode={gameState.clearMode}
              />
            </div>

            <div className="flex-1 min-w-0">
              <Board
                board={gameState.boardRight}
                currentPlayer={gameState.currentPlayer}
                allowedColumn={gameState.allowedColumn}
                onCellClick={(row, col) => {
                  if (gameState.clearMode) {
                    clearBoard('right')
                  } else {
                    cellClick('right', row, col)
                  }
                }}
                playerName="4-6"
                isActive={isMyTurn && (rightBoardActive || gameState.stealMode || gameState.clearMode)}
                diceStart={4}
                stealMode={gameState.stealMode}
                clearMode={gameState.clearMode}
              />
            </div>
          </div>

          {/* Dice and Reaction Area - Side by Side */}
          {!gameState.winner ? (
            <div className="flex items-stretch justify-center gap-3 mt-4">
              {/* Dice Area - 80% with turn indicator border */}
              <div className={`flex-[0.8] p-3 rounded-xl flex flex-col items-center transition-all duration-300 ${
                isMyTurn && !gameState.isRolling && !gameState.stealMode && !gameState.clearMode && gameState.allowedColumn === null
                  ? 'bg-gradient-to-r from-yellow-100 via-yellow-200 to-yellow-100 dark:from-yellow-900/40 dark:via-yellow-800/40 dark:to-yellow-900/40 border-4 border-yellow-500 dark:border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.6)] animate-pulse'
                  : gameState.stealMode && isMyTurn
                  ? 'bg-gradient-to-r from-purple-100 via-purple-200 to-purple-100 dark:from-purple-900/40 dark:via-purple-800/40 dark:to-purple-900/40 border-4 border-purple-500 dark:border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                  : gameState.clearMode && isMyTurn
                  ? 'bg-gradient-to-r from-red-100 via-red-200 to-red-100 dark:from-red-900/40 dark:via-red-800/40 dark:to-red-900/40 border-4 border-red-500 dark:border-red-400 shadow-[0_0_20px_rgba(239,68,68,0.6)]'
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
                  {!gameState.stealMode && !gameState.clearMode && (
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
                <div className="flex flex-col items-center justify-center">
                  <Dice
                    value={gameState.diceValue}
                    size="lg"
                    isRolling={gameState.isRolling}
                    onClick={canRoll ? rollDice : undefined}
                    disabled={!canRoll}
                  />
                  {/* Dice Value Display */}
                  <div className="text-center mt-2">
                    <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                      {gameState.diceValue}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Reaction Button Area - 20% */}
              {gameState.gameStarted && players.length === 2 && (
                <div className="flex-[0.2] flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-700 p-2">
                  <ReactionButton
                    ref={reactionButtonRef}
                    onReaction={handleSendReaction}
                    disabled={!isConnected}
                  />
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
