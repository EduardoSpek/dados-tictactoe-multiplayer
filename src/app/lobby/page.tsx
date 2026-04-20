'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSocket } from '@/hooks/useSocket'

export default function Lobby() {
  const router = useRouter()
  const { createRoom, joinRoom, isConnected } = useSocket()
  const [playerName, setPlayerName] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setError('Digite seu nome')
      return
    }
    if (!isConnected) {
      setError('Conectando ao servidor...')
      return
    }
    
    localStorage.setItem('playerName', playerName.trim())
    
    setIsCreating(true)
    setError(null)
    
    createRoom(playerName, (roomId) => {
      setIsCreating(false)
      // Go directly to game page
      router.push(`/game?room=${roomId}`)
    })
  }

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setError('Digite seu nome')
      return
    }
    if (!roomCode.trim()) {
      setError('Digite o código da sala')
      return
    }
    if (!isConnected) {
      setError('Conectando ao servidor...')
      return
    }
    
    localStorage.setItem('playerName', playerName.trim())
    
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md">
        <h1 className="text-2xl md:text-3xl font-bold text-center mb-6 text-gray-900 dark:text-white">
          🎲 Jogo da Velha com Dados
        </h1>
        
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Seu Nome
          </label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Digite seu nome"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            maxLength={20}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={handleCreateRoom}
            disabled={isCreating}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? 'Criando...' : '🎮 Criar Nova Sala'}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">ou</span>
            </div>
          </div>

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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">ou</span>
            </div>
          </div>

          <button
            onClick={handlePlayOffline}
            className="w-full py-3 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-bold rounded-lg transition-all duration-200"
          >
            👤 Jogar Offline (2 Jogadores)
          </button>
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
