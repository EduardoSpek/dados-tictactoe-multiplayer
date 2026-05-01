'use client'

import React, { useEffect, useState, useRef } from 'react'

interface DiceProps {
  value: number | null
  size?: 'sm' | 'md' | 'lg'
  isRolling?: boolean
  onClick?: () => void
  disabled?: boolean
}

// Dot positions for each dice face (1-6)
const diceDots: Record<number, number[]> = {
  1: [4], // center
  2: [0, 8], // top-left, bottom-right
  3: [0, 4, 8], // diagonal
  4: [0, 2, 6, 8], // corners
  5: [0, 2, 4, 6, 8], // corners + center
  6: [0, 2, 3, 5, 6, 8], // two columns of 3
}

const modeInfo: Record<number, { name: string; desc: string }> = {
  0: { name: 'ROUBAR', desc: 'Rouba uma marca!' },
  7: { name: 'LIMPAR', desc: 'Limpa uma coluna!' },
  8: { name: 'INVERSÃO', desc: 'Inverte todas as marcas!' },
}

const modeLetter: Record<number, string> = {
  0: 'R',
  7: 'L',
  8: 'I',
}

export default function Dice({ value, size = 'md', isRolling = false, onClick, disabled }: DiceProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(value)
  const animationRef = useRef<NodeJS.Timeout | null>(null)
  const valueRef = useRef<number | null>(value)

  // Keep value ref updated
  useEffect(() => {
    valueRef.current = value
  }, [value])

  // Handle rolling animation
  useEffect(() => {
    if (isRolling) {
      // Start animation - show random values
      animationRef.current = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1)
      }, 80)

      // Stop after 1.5s and show final value
      setTimeout(() => {
        if (animationRef.current) {
          clearInterval(animationRef.current)
          animationRef.current = null
        }
        setDisplayValue(valueRef.current)
      }, 1500)
    }

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current)
      }
    }
  }, [isRolling])

  // Update display when not rolling and value changes
  useEffect(() => {
    if (!isRolling && value !== displayValue) {
      setDisplayValue(value)
    }
  }, [value, isRolling, displayValue])

  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-24 h-24',
  }

  const dotSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-5 h-5',
  }

  const isSpecial = displayValue !== null && (displayValue === 0 || displayValue > 6)

  // Colors for dice
  const diceBg = 'bg-transparent'
  const dotColor = 'bg-red-600'
  const borderColor = 'border-white'

  return (
    <div className="flex items-center gap-3">
      {/* Dice Container */}
      <div
        onClick={() => !disabled && onClick?.()}
        className={`
          ${sizeClasses[size]} 
          ${diceBg}
          rounded-xl 
          shadow-lg 
          border-2 
          ${borderColor}
          flex 
          items-center 
          justify-center
          cursor-pointer
          transition-transform
          ${!disabled && !isRolling ? 'hover:scale-105 active:scale-95' : ''}
          ${disabled || isRolling ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {displayValue && displayValue >= 1 && displayValue <= 6 ? (
          <div className={`grid grid-cols-3 gap-0.5 ${sizeClasses[size]} p-1`}>
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((pos) => (
              <div
                key={pos}
                className={`
                  ${dotSizes[size]} 
                  rounded-full 
                  ${diceDots[displayValue]?.includes(pos) 
                    ? dotColor 
                    : 'bg-transparent'
                  }
                `}
              />
            ))}
          </div>
        ) : isSpecial ? (
          <span className="text-3xl font-bold text-red-600">{modeLetter[displayValue]}</span>
        ) : (
          <span className="text-2xl">🎲</span>
        )}
      </div>

      {/* Mode Info - Show for 0, 7, 8 */}
      {isSpecial && modeInfo[displayValue] && (
        <div className="flex flex-col">
          <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
            {modeInfo[displayValue].name}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {modeInfo[displayValue].desc}
          </span>
        </div>
      )}
    </div>
  )
}