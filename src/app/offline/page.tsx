'use client'

import { useState, useEffect, useCallback } from 'react'
import Board from '@/components/Board'
import Dice from '@/components/Dice'
import useSound from '@/hooks/useSound'

interface Score {
  playerX: number
  playerO: number
}

export default function OfflineGame() {
  const { playDiceRoll, playPlaceMark, playWin, playColumnFull, playClick, playSteal } = useSound()
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
  const [stealMode, setStealMode] = useState(false)
  const [clearMode, setClearMode] = useState(false)
  const [inversionMode, setInversionMode] = useState(false)
  const [restoreMode, setRestoreMode] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const checkWinner = useCallback((board: (string | null)[][], player: string): boolean => {
    for (let row = 0; row < 3; row++) {
      if (board[row][0] === player && board[row][1] === player && board[row][2] === player) return true
    }
    for (let col = 0; col < 3; col++) {
      if (board[0][col] === player && board[1][col] === player && board[2][col] === player) return true
    }
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true
    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true
    return false
  }, [])

  const rollDice = useCallback(() => {
    if (isRolling || winner || allowedColumn !== null) return

    // If in any mode (steal, clear), allow re-rolling to cancel
    if (stealMode) {
      setStealMode(false)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      return
    }

    // If in clear mode, allow re-rolling to skip
    if (clearMode) {
      setClearMode(false)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      return
    }

    // If in inversion mode, allow re-rolling to cancel
    if (inversionMode) {
      setInversionMode(false)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      return
    }

    // If in restore mode, allow re-rolling to cancel
    if (restoreMode) {
      setRestoreMode(false)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      return
    }

    setIsRolling(true)
          setStealMode(false)
          setClearMode(false)
          setInversionMode(false)
          setRestoreMode(false)
          playDiceRoll()

         let rolls = 0
    const maxRolls = 15
    const interval = setInterval(() => {
       setDiceValue(Math.floor(Math.random() * 7) + 1)
      rolls++

      if (rolls >= maxRolls) {
        clearInterval(interval)

         // Check if there are opponent cells to steal
        const opponent = currentPlayer === 'X' ? 'O' : 'X'
        let hasOpponentCells = false
        let hasAnyCells = false
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            if (boardLeft[row][col] === opponent || boardRight[row][col] === opponent) {
              hasOpponentCells = true
            }
            if (boardLeft[row][col] !== null || boardRight[row][col] !== null) {
              hasAnyCells = true
            }
          }
        }
          
          // Only allow 0 if there are opponent cells to steal
         // Allow 7 if there are any cells to clear (regardless of opponent cells)
        let finalValue: number
        const roll = Math.random()
        if (hasOpponentCells && roll < 0.6) { // 60% chance of 0-6 when opponent cells exist
          finalValue = Math.floor(Math.random() * 7) // 0-6
        } else if (roll < 0.75) { // 15% chance of 7 (clear)
          finalValue = 7
        } else if (roll < 0.9) { // 15% chance of 8 (invert)
          finalValue = 8
        } else {
          finalValue = Math.floor(Math.random() * 6) + 1 // 1-6
        }

        setDiceValue(finalValue)
        setIsRolling(false)

         if (finalValue === 0) {
           setStealMode(true)
           setAllowedColumn(null)
           playSteal()
          } else if (finalValue === 7) {
            if (hasAnyCells) {
              setClearMode(true)
              setAllowedColumn(null)
              playSteal()
            } else {
              // No cells to clear, just pass turn
              setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
            }
          } else if (finalValue === 8) {
            // Inversion mode - invert all marks
            setInversionMode(true)
            setAllowedColumn(null)
            playSteal()
          } else {
            const column = finalValue - 1
          const boardSide = column <= 2 ? 'left' : 'right'
          const colIndex = column <= 2 ? column : column - 3
          const board = boardSide === 'left' ? boardLeft : boardRight

          let isColumnFull = true
          for (let row = 0; row < 3; row++) {
            if (board[row][colIndex] === null) {
              isColumnFull = false
              break
            }
          }

          if (isColumnFull) {
            setAllowedColumn(null)
            playColumnFull()
            setTimeout(() => {
              setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
            }, 1500)
          } else {
            setAllowedColumn(column)
          }
        }
      }
    }, 80)
  }, [isRolling, winner, allowedColumn, stealMode, currentPlayer, boardLeft, boardRight, playDiceRoll, playSteal, playColumnFull])

  const handleCellClick = useCallback((boardSide: 'left' | 'right', row: number, col: number) => {
    if (winner || isRolling) return

    const board = boardSide === 'left' ? boardLeft : boardRight
    const setBoard = boardSide === 'left' ? setBoardLeft : setBoardRight
    const cellValue = board[row][col]

    // Clear mode
    if (clearMode) {
      const boardToClear = boardSide === 'left' ? 'left' : 'right'
      const newBoard = Array(3).fill(null).map(() => Array(3).fill(null))
      setBoard(newBoard)

      playSteal()
      setClearMode(false)
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      return
    }

    // Steal mode
    if (stealMode) {
       const opponent = currentPlayer === 'X' ? 'O' : 'X'
       if (cellValue !== opponent) return

       playSteal()
       const newBoard = board.map(r => [...r])
       newBoard[row][col] = currentPlayer
       setBoard(newBoard)

       if (checkWinner(newBoard, currentPlayer)) {
         setWinner(currentPlayer)
         playWin()
         setScore(prev => ({
           ...prev,
           [currentPlayer === 'X' ? 'playerX' : 'playerO']: prev[currentPlayer === 'X' ? 'playerX' : 'playerO'] + 1
         }))
       } else {
         setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
         setStealMode(false)
       }
       return
     }

      // Inversion mode - invert all marks on the clicked board
      if (inversionMode) {
        const newBoardLeft = boardLeft.map(row => row.map(cell => cell === 'X' ? 'O' : cell === 'O' ? 'X' : null))
        const newBoardRight = boardRight.map(row => row.map(cell => cell === 'X' ? 'O' : cell === 'O' ? 'X' : null))
        setBoardLeft(newBoardLeft)
        setBoardRight(newBoardRight)

        playSteal()
        setInversionMode(false)
        setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
        return
      }

      // Restore mode - restore cleared board (not implemented in offline yet)
      if (restoreMode) {
        // For offline, we don't have boardBeforeClear, so just cancel
        playSteal()
        setRestoreMode(false)
        setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
        return
      }

    // Normal mode
    if (allowedColumn === null) return

    const actualCol = boardSide === 'left' ? col : col + 3
    if (actualCol !== allowedColumn) return
    if (cellValue !== null) return

    playPlaceMark()
    const newBoard = board.map(r => [...r])
    newBoard[row][col] = currentPlayer
    setBoard(newBoard)

    if (checkWinner(newBoard, currentPlayer)) {
      setWinner(currentPlayer)
      playWin()
      setScore(prev => ({
        ...prev,
        [currentPlayer === 'X' ? 'playerX' : 'playerO']: prev[currentPlayer === 'X' ? 'playerX' : 'playerO'] + 1
      }))
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X')
      setAllowedColumn(null)
    }
  }, [winner, isRolling, stealMode, allowedColumn, currentPlayer, boardLeft, boardRight, checkWinner, playSteal, playPlaceMark, playWin])

  const resetGame = useCallback(() => {
    setBoardLeft(Array(3).fill(null).map(() => Array(3).fill(null)))
    setBoardRight(Array(3).fill(null).map(() => Array(3).fill(null)))
    setCurrentPlayer('X')
    setDiceValue(1)
    setAllowedColumn(null)
    setWinner(null)
    setStealMode(false)
    setIsRolling(false)
    playClick()
  }, [playClick])

  const resetScore = useCallback(() => {
    setScore({ playerX: 0, playerO: 0 })
    resetGame()
    playClick()
  }, [resetGame, playClick])

  const startGame = useCallback(() => {
    setGameStarted(true)
    playClick()
  }, [playClick])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Carregando...</div>
      </div>
    )
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md text-center">
          <h1 className="text-2xl md:text-3xl font-bold mb-4 text-gray-900 dark:text-white">
            🎲 Jogo da Velha com Dados
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Modo Offline - 2 Jogadores no mesmo dispositivo
          </p>
          <button
            onClick={startGame}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold rounded-lg transition-all duration-200"
          >
            🎮 Iniciar Jogo
          </button>
          <a
            href="/lobby"
            className="block mt-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Voltar ao Lobby
          </a>
        </div>
      </div>
    )
  }

  const leftBoardActive = allowedColumn !== null && allowedColumn <= 2
  const rightBoardActive = allowedColumn !== null && allowedColumn >= 3

  return (
    <div className="min-h-screen p-2 md:p-6 lg:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-xl md:text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            🎲 Jogo da Velha Offline
          </h1>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className={`px-3 py-1 rounded-lg ${currentPlayer === 'X' ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <span className="font-bold text-blue-600 dark:text-blue-400">Jogador X</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{score.playerX}</span>
            </div>
            <div className="text-gray-400">vs</div>
            <div className={`px-3 py-1 rounded-lg ${currentPlayer === 'O' ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-400' : 'bg-gray-100 dark:bg-gray-800'}`}>
              <span className="font-bold text-green-600 dark:text-green-400">Jogador O</span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">{score.playerO}</span>
            </div>
          </div>
        </div>

        {/* Game Area */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-3 md:p-6">
          {/* Boards - Sempre lado a lado */}
          <div className="flex flex-row gap-2 md:gap-6 mb-4">
            <div className="flex-1 min-w-0">
               <Board
                 board={boardLeft}
                 currentPlayer={currentPlayer}
                 allowedColumn={allowedColumn}
                 onCellClick={(row, col) => handleCellClick('left', row, col)}
                  playerName="1-3"
                  isActive={leftBoardActive || stealMode || clearMode || inversionMode || restoreMode}
                  diceStart={1}
                  stealMode={stealMode}
                  clearMode={clearMode}
                  inversionMode={inversionMode}
                  restoreMode={restoreMode}
                />
            </div>

            <div className="flex-1 min-w-0">
               <Board
                 board={boardRight}
                 currentPlayer={currentPlayer}
                 allowedColumn={allowedColumn}
                 onCellClick={(row, col) => handleCellClick('right', row, col)}
                  playerName="4-6"
                  isActive={rightBoardActive || stealMode || clearMode || inversionMode || restoreMode}
                  diceStart={4}
                  stealMode={stealMode}
                  clearMode={clearMode}
                  inversionMode={inversionMode}
                  restoreMode={restoreMode}
                />
            </div>
          </div>

          {/* Dice Area */}
          {!winner ? (
            <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-300 dark:border-gray-700 flex flex-col items-center">
              <div className="text-center mb-2">
                 <p className="text-sm md:text-base font-semibold text-gray-800 dark:text-gray-200">
                   {stealMode ? (
                     <span className="text-purple-600 dark:text-purple-400">
                       🔥 MODO ROUBO! Clique em uma casa do adversário!
                     </span>
                   ) : clearMode ? (
                     <span className="text-red-600 dark:text-red-400">
                       🧹 MODO LIMPAR! Escolha qual tabuleiro limpar!
                     </span>
                   ) : (
                     <>
                       Vez do{' '}
                       <span
                         className={
                           currentPlayer === 'X'
                             ? 'text-blue-600 dark:text-blue-400'
                             : 'text-green-600 dark:text-green-400'
                         }
                       >
                         Jogador {currentPlayer}
                       </span>
                     </>
                   )}
                 </p>
                  {stealMode ? (
                    <p className="text-xs md:text-sm text-purple-600 dark:text-purple-400 mt-1">
                      🔒 Modo Roubo: Clique em uma casa do oponente!
                    </p>
                  ) : clearMode ? (
                    <p className="text-xs md:text-sm text-red-600 dark:text-red-400 mt-1">
                      🧹 Modo Limpar: Clique em qualquer casa para limpar!
                    </p>
                  ) : inversionMode ? (
                    <p className="text-xs md:text-sm text-purple-600 dark:text-purple-400 mt-1">
                      🔄 Modo Inverter: Clique em um tabuleiro para inverter!
                    </p>
                  ) : restoreMode ? (
                    <p className="text-xs md:text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                      ♻️ Modo Restaurar: Clique em um tabuleiro para restaurar!
                    </p>
                  ) : (
               </div>

               <div className="flex items-center gap-4">
                 <Dice
                    value={diceValue}
                    size="lg"
                    isRolling={isRolling}
                    onClick={rollDice}
                    disabled={isRolling || allowedColumn !== null || stealMode || clearMode || inversionMode || restoreMode}
                  />
                <div className="text-center">
                  <p className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
                    {diceValue}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 p-4 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl border-2 border-yellow-400 dark:border-yellow-600 text-center">
              <div className="text-4xl md:text-5xl mb-2">🏆</div>
              <h2 className="text-lg md:text-2xl font-bold text-gray-900 dark:text-white">
                Jogador {winner} Venceu!
              </h2>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            type="button"
            onClick={resetGame}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            🔄 Nova Partida
          </button>
          <button
            type="button"
            onClick={resetScore}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            🗑️ Zerar Placar
          </button>
          <a
            href="/lobby"
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            🚪 Sair
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
            <li>3. <span className="text-purple-600 dark:text-purple-400 font-semibold">ZERO (0) = MODO ROUBO!</span> Roube uma casa do adversário!</li>
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
    </div>
  )
}
