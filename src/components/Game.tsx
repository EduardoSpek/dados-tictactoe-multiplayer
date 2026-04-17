'use client'

import { useState, useEffect, useCallback } from 'react'
import Board from './Board'
import Dice from './Dice'

interface Score {
  playerX: number
  playerO: number
}

export default function Game() {
  const [boardLeft, setBoardLeft] = useState<(string | null)[][]>(Array(3).fill(null).map(() => Array(3).fill(null)))
  const [boardRight, setBoardRight] = useState<(string | null)[][]>(Array(3).fill(null).map(() => Array(3).fill(null)))
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X')
  const [diceValue, setDiceValue] = useState<number>(1)
  const [isRolling, setIsRolling] = useState(false)
  const [allowedColumn, setAllowedColumn] = useState<number | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [score, setScore] = useState<Score>({ playerX: 0, playerO: 0 })
  const [gameStarted, setGameStarted] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const savedScore = localStorage.getItem('dadosTictactoeScore')
    if (savedScore) {
      setScore(JSON.parse(savedScore))
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('dadosTictactoeScore', JSON.stringify(score))
  }, [score])

  // Check if a column is full
  const isColumnFull = useCallback((colIndex: number, boardSide: 'left' | 'right'): boolean => {
    const board = boardSide === 'left' ? boardLeft : boardRight
    for (let row = 0; row < 3; row++) {
      if (board[row][colIndex] === null) {
        return false
      }
    }
    return true
  }, [boardLeft, boardRight])

  const checkWinner = useCallback((board: (string | null)[][], player: string): boolean => {
    for (let row = 0; row < 3; row++) {
      if (board[row][0] === player && board[row][1] === player && board[row][2] === player) {
        return true
      }
    }
    for (let col = 0; col < 3; col++) {
      if (board[0][col] === player && board[1][col] === player && board[2][col] === player) {
        return true
      }
    }
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) {
      return true
    }
    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) {
      return true
    }
    return false
  }, [])

  const rollDice = () => {
    if (isRolling || winner) return
    
    setIsRolling(true)
    setGameStarted(true)
    
    let rolls = 0
    const maxRolls = 15
    const interval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1)
      rolls++
      
      if (rolls >= maxRolls) {
        clearInterval(interval)
        const finalValue = Math.floor(Math.random() * 6) + 1
        setDiceValue(finalValue)
        
        const column = finalValue - 1 // 0-5
        const boardSide = column <= 2 ? 'left' : 'right'
        const colIndex = column <= 2 ? column : column - 3
        
        // Check if column is full
        if (isColumnFull(colIndex, boardSide)) {
          // Column is full - pass turn to next player
          setAllowedColumn(null)
          setCurrentPlayer(prev => prev === 'X' ? 'O' : 'X')
        } else {
          setAllowedColumn(column)
        }
        
        setIsRolling(false)
      }
    }, 80)
  }

  const handleCellClick = (boardSide: 'left' | 'right', row: number, col: number) => {
    if (!gameStarted || isRolling || winner || allowedColumn === null) return
    
    const actualCol = boardSide === 'left' ? col : col + 3
    if (actualCol !== allowedColumn) return

    const currentBoard = boardSide === 'left' ? boardLeft : boardRight
    if (currentBoard[row][col] !== null) return

    const newBoard = currentBoard.map(r => [...r])
    newBoard[row][col] = currentPlayer

    if (boardSide === 'left') {
      setBoardLeft(newBoard)
    } else {
      setBoardRight(newBoard)
    }

    if (checkWinner(newBoard, currentPlayer)) {
      setWinner(currentPlayer)
      setScore(prev => ({
        ...prev,
        [currentPlayer === 'X' ? 'playerX' : 'playerO']: prev[currentPlayer === 'X' ? 'playerX' : 'playerO'] + 1
      }))
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      setAllowedColumn(null)
    }
  }

  const resetGame = () => {
    setBoardLeft(Array(3).fill(null).map(() => Array(3).fill(null)))
    setBoardRight(Array(3).fill(null).map(() => Array(3).fill(null)))
    setCurrentPlayer('X')
    setDiceValue(1)
    setAllowedColumn(null)
    setWinner(null)
    setGameStarted(false)
  }

  const resetScore = () => {
    setScore({ playerX: 0, playerO: 0 })
    localStorage.removeItem('dadosTictactoeScore')
  }

  const leftBoardActive = currentPlayer === 'X' && gameStarted && !winner && (allowedColumn === null || allowedColumn <= 2)
  const rightBoardActive = currentPlayer === 'X' && gameStarted && !winner && (allowedColumn === null || allowedColumn >= 3)
  const leftBoardActiveO = currentPlayer === 'O' && gameStarted && !winner && (allowedColumn === null || allowedColumn <= 2)
  const rightBoardActiveO = currentPlayer === 'O' && gameStarted && !winner && (allowedColumn === null || allowedColumn >= 3)

  // Get message for dice area
  const getDiceMessage = () => {
    if (winner) return null
    if (!gameStarted) return 'Clique no dado para começar!'
    if (isRolling) return 'Sorteando...'
    if (allowedColumn !== null) {
      return allowedColumn <= 2 
        ? `Marque na coluna ${allowedColumn + 1} (Tabuleiro Esquerdo)`
        : `Marque na coluna ${allowedColumn - 2} (Tabuleiro Direito)`
    }
    return 'Coluna cheia! Vez do próximo jogador.'
  }

  return (
    <div className="min-h-screen p-2 md:p-6 lg:p-8">
      <div className="text-center mb-3">
        <h1 className="text-xl md:text-3xl font-bold mb-1 text-gray-900 dark:text-white">
          🎲 Jogo da Velha com Dados
        </h1>
        <p className="text-gray-700 dark:text-gray-300 text-xs md:text-sm">
          Role o dado e marque na coluna correspondente!
        </p>
      </div>

      <div className="flex justify-center gap-3 md:gap-6 mb-3">
        <div className="bg-blue-100 dark:bg-blue-900/30 px-3 md:px-6 py-2 rounded-xl border-2 border-blue-500 dark:border-blue-600">
          <div className="text-xs text-blue-700 dark:text-blue-400 font-semibold">Jogador X</div>
          <div className="text-xl md:text-3xl font-bold text-blue-800 dark:text-blue-300">{mounted ? score.playerX : 0}</div>
        </div>
        <div className="bg-green-100 dark:bg-green-900/30 px-3 md:px-6 py-2 rounded-xl border-2 border-green-500 dark:border-green-600">
          <div className="text-xs text-green-700 dark:text-green-400 font-semibold">Jogador O</div>
          <div className="text-xl md:text-3xl font-bold text-green-800 dark:text-green-300">{mounted ? score.playerO : 0}</div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">
        <div className="flex flex-row gap-2 md:gap-4 items-start justify-center">
          <div className="flex-1">
            <Board
              board={boardLeft}
              currentPlayer={currentPlayer}
              allowedColumn={allowedColumn}
              onCellClick={(row, col) => handleCellClick('left', row, col)}
              playerName="1-3"
              isActive={currentPlayer === 'X' ? leftBoardActive : leftBoardActiveO}
              diceStart={1}
            />
          </div>

          <div className="flex-1">
            <Board
              board={boardRight}
              currentPlayer={currentPlayer}
              allowedColumn={allowedColumn}
              onCellClick={(row, col) => handleCellClick('right', row, col)}
              playerName="4-6"
              isActive={currentPlayer === 'X' ? rightBoardActive : rightBoardActiveO}
              diceStart={4}
            />
          </div>
        </div>

        {/* Dice Area - Below boards */}
        {!winner ? (
          <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-700 flex flex-col items-center">
            <div className="text-center mb-2">
              <p className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                Vez do <span className={currentPlayer === 'X' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}>Jogador {currentPlayer}</span>
              </p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mt-1">{getDiceMessage()}</p>
            </div>

            <div className="flex items-center gap-4">
              <Dice
                value={diceValue}
                size="lg"
                isRolling={isRolling}
                onClick={rollDice}
                disabled={isRolling || (gameStarted && allowedColumn !== null)}
              />
              <div className="text-center">
                <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{diceValue}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl border-2 border-yellow-400 dark:border-yellow-600 text-center">
            <div className="text-4xl md:text-5xl mb-2">🏆</div>
            <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
              Jogador {winner} Venceu!
            </h2>
            <button
              type="button"
              onClick={resetGame}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Jogar Novamente
            </button>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-3 mt-4">
        <button
          type="button"
          onClick={resetGame}
          className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          🔄 Reiniciar
        </button>
        <button
          type="button"
          onClick={resetScore}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          🗑️ Zerar Placar
        </button>
      </div>

      <div className="max-w-xl mx-auto mt-3 p-3 bg-gray-200 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700">
        <h3 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">Como Jogar:</h3>
        <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-0.5">
          <li>1. Clique no dado para sortear (1-6)</li>
          <li>2. Números 1, 2, 3 → tabuleiro esquerdo | 4, 5, 6 → tabuleiro direito</li>
          <li>3. Se a coluna estiver cheia, a vez passa automaticamente</li>
          <li>4. Faça 3 em linha para vencer!</li>
        </ul>
      </div>

      {/* Credits */}
      <div className="text-center mt-6 pb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Desenvolvido com ❤️ por <span className="font-semibold text-gray-800 dark:text-gray-200">Eduardo Spek</span>
        </p>
        <a 
          href="https://www.instagram.com/eduardospek" 
          target="_blank" 
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors mt-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
            <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
            <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
          </svg>
          @eduardospek
        </a>
      </div>
    </div>
  )
}
