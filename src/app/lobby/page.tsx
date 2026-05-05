'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function Lobby() {
  const router = useRouter()
  const { createRoom, joinRoom, findMatch, isConnected, socketRef } = useSocket()
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [isFindingMatch, setIsFindingMatch] = useState(false)
  const [nameSubmitted, setNameSubmitted] = useState(false)

  // Check for saved name on mount (only if no other tab is using it)
  useEffect(() => {
    // Don't auto-fill name - each tab should have its own player
    // This prevents the second player from inheriting the first player's name
  }, [])

  const handleSubmitName = () => {
    if (!playerName.trim()) {
      setError('Digite seu nome')
      return
    }
    // Use sessionStorage instead of localStorage - each tab should have its own player name
    sessionStorage.setItem('playerName', playerName.trim())
    setNameSubmitted(true)
    setError(null)
  }

  // Use ref to store playerName for event listeners (avoids stale closure)
  const playerNameRef = useRef('')
  useEffect(() => {
    playerNameRef.current = playerName
  }, [playerName])

  const handleCreateRoom = () => {
    if (!isConnected) {
      setError('Conectando ao servidor...')
      return
    }

    setIsCreating(true)
    setError(null)

    createRoom(playerName, (roomId) => {
      setIsCreating(false)
      navigator.clipboard.writeText(roomId)
      router.push(`/game?room=${roomId}`)
    })
  }

  const handleJoinRoom = () => {
    if (!roomCode.trim()) {
      setError('Digite o código da sala')
      return
    }
    if (!isConnected) {
      setError('Conectando ao servidor...')
      return
    }
    
    setIsJoining(true)
    setError(null)
    
    joinRoom(roomCode, playerName, (success, message) => {
      setIsJoining(false)
      if (success) {
        router.push(`/game?room=${roomCode.toUpperCase()}`)
      } else {
        setError(message || 'Erro ao entrar na sala')
      }
    })
  }

  const handlePlayOffline = () => {
    router.push('/offline')
  }

  const handleFindMatch = () => {
    if (!isConnected) {
      setError('Conectando ao servidor...')
      return
    }

    setIsFindingMatch(true)
    setError(null)

    findMatch(playerName, (result) => {
      if (result.status === 'waiting') {
        // Will be redirected when match is found
      } else if (result.status === 'already-in-game' && result.roomId) {
        setIsFindingMatch(false)
        router.push(`/game?room=${result.roomId}`)
      }
    })
  }

  // Listen for match-found to redirect
  const [matchFound, setMatchFound] = useState(false)
  const [matchedRoom, setMatchedRoom] = useState('')

  useEffect(() => {
    const interval = setInterval(() => {
      if (socketRef.current?.connected) {
        clearInterval(interval)

        const handleMatchFound = (data: { roomId: string; symbol: string }) => {
          console.log('[Lobby] Match found - received symbol:', data.symbol, 'room:', data.roomId, 'playerName:', playerNameRef.current, 'socketId:', socketRef.current?.id)
          // Pass symbol via URL to avoid localStorage conflicts between tabs
          setMatchFound(true)
          setMatchedRoom(data.roomId)
          // Store symbol in URL instead of localStorage
          router.push(`/game?room=${data.roomId}&name=${encodeURIComponent(playerNameRef.current)}&symbol=${data.symbol}`)
        }

        socketRef.current.on('match-found', handleMatchFound)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [])

  // Navigation is now handled in handleMatchFound

  // Name modal
  if (!nameSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-sm">
          <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
            🎲 Jogo da Velha com Dados
          </h1>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Qual é o seu nome?
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Digite seu nome"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-lg"
              maxLength={20}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitName()}
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmitName}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200"
          >
            Continuar →
          </button>

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isConnected ? '🟢 Conectado' : '🟡 Conectando...'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Main lobby after name submission
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">
          🎲 Jogo da Velha com Dados
        </h1>
        
        <p className="text-center text-gray-600 dark:text-gray-400 mb-6">
          Olá, <span className="font-bold text-blue-600 dark:text-blue-400">{playerName}</span>!
        </p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Área 1: Partida Rápida e Offline */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Partida Rápida
          </h2>
          <div className="space-y-3">
            <button
              onClick={handleFindMatch}
              disabled={isFindingMatch}
              className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isFindingMatch ? '🔍 Procurando oponente...' : '⚡ Encontrar Partida Rápida'}
            </button>

            <button
              onClick={handlePlayOffline}
              className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-lg transition-all duration-200"
            >
              👤 Jogar Offline (2 Jogadores)
            </button>
          </div>
        </div>

        {/* Área 2: Criar Sala */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Criar Sala
          </h2>
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Criando...' : '🎮 Criar Sala'}
          </button>
        </div>

        {/* Área 3: Entrar com código */}
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
            Entrar em Sala
          </h2>
          <div className="space-y-3">
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="Código da sala"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center uppercase tracking-widest font-mono"
              maxLength={4}
            />
            <button
              onClick={handleJoinRoom}
              disabled={isJoining}
              className="w-full py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isJoining ? 'Entrando...' : '🔗 Entrar na Sala'}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isConnected ? '🟢 Conectado' : '🟡 Conectando...'}
          </p>
        </div>
      </div>
    </div>
  )
}