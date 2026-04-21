'use client'

import Dice from './Dice'

interface BoardProps {
  board: (string | null)[][]
  currentPlayer: string
  allowedColumn: number | null
  onCellClick: (row: number, col: number) => void
  playerName: string
  isActive: boolean
  diceStart: number
  stealMode?: boolean
  clearMode?: boolean
}

export default function Board({ board, currentPlayer, allowedColumn, onCellClick, playerName, isActive, diceStart, stealMode = false, clearMode = false }: BoardProps) {
  const getCellClasses = (row: number, col: number, value: string | null) => {
    const actualCol = diceStart === 4 ? col + 3 : col
    const opponent = currentPlayer === 'X' ? 'O' : 'X'
    const isOpponentCell = value === opponent
    const isAllowed = allowedColumn === actualCol && value === null
    const isStealable = stealMode && isOpponentCell
    const isDisabled = !stealMode && allowedColumn !== null && allowedColumn !== actualCol
    
    let baseClasses = `
      w-full aspect-square
      flex items-center justify-center
      text-xl sm:text-2xl md:text-4xl font-bold
      rounded-lg
      transition-all duration-200
      border-2
    `
    
    if (clearMode && isActive) {
      // Clear mode styling - entire board is clickable
      baseClasses += ' bg-red-300 dark:bg-red-800 border-red-500 dark:border-red-400 text-red-800 dark:text-red-200 shadow-inner cursor-pointer hover:bg-red-400 dark:hover:bg-red-700 animate-pulse'
    } else if (value === 'X') {
      if (isStealable) {
        baseClasses += ' bg-red-300 dark:bg-red-800 border-red-600 dark:border-red-400 text-red-800 dark:text-red-200 shadow-inner cursor-pointer hover:bg-red-400 dark:hover:bg-red-700 animate-pulse'
      } else {
        baseClasses += ' bg-blue-300 dark:bg-blue-800 border-blue-600 dark:border-blue-400 text-blue-800 dark:text-blue-200 shadow-inner'
      }
    } else if (value === 'O') {
      if (isStealable) {
        baseClasses += ' bg-red-300 dark:bg-red-800 border-red-600 dark:border-red-400 text-red-800 dark:text-red-200 shadow-inner cursor-pointer hover:bg-red-400 dark:hover:bg-red-700 animate-pulse'
      } else {
        baseClasses += ' bg-green-300 dark:bg-green-800 border-green-600 dark:border-green-400 text-green-800 dark:text-green-200 shadow-inner'
      }
    } else if (isAllowed && isActive) {
      baseClasses += ' bg-yellow-300 dark:bg-yellow-700 border-yellow-500 dark:border-yellow-400 cursor-pointer hover:bg-yellow-400 dark:hover:bg-yellow-600 shadow-lg animate-pulse'
    } else if (isDisabled || !isActive) {
      baseClasses += ' bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-600 cursor-not-allowed opacity-60'
    } else {
      baseClasses += ' bg-white dark:bg-gray-800 border-gray-400 dark:border-gray-500 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 hover:shadow-md'
    }
    
    return baseClasses
  }

  const diceNumbers = diceStart === 1 ? [1, 2, 3] : [4, 5, 6]

  return (
    <div className={`p-2 sm:p-3 md:p-4 rounded-xl border-2 ${isActive ? 'border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-lg' : 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50'}`}>
      <div className="text-center mb-2">
        <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 dark:text-white">{playerName}</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {currentPlayer === 'X' ? 'X' : 'O'}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-2 mb-2">
        {board.map((row, rowIndex) => (
          row.map((cell, colIndex) => (
            <button
              key={`${rowIndex}-${colIndex}`}
              type="button"
              onClick={() => onCellClick(rowIndex, colIndex)}
              disabled={!stealMode && !clearMode && (!isActive || cell !== null)}
              className={getCellClasses(rowIndex, colIndex, cell)}
            >
              {cell}
            </button>
          ))
        ))}
      </div>

      <div className="grid grid-cols-3 gap-1 sm:gap-2">
        {diceNumbers.map((num) => (
          <div key={num} className="flex flex-col items-center">
            <Dice 
              value={num} 
              size="sm"
              disabled={true}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
