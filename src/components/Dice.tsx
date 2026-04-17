'use client'

interface DiceProps {
  value: number
  size?: 'sm' | 'md' | 'lg'
  isRolling?: boolean
  onClick?: () => void
  disabled?: boolean
}

export default function Dice({ value, size = 'md', isRolling = false, onClick, disabled = false }: DiceProps) {
  const sizeClasses = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-16 h-16 text-lg',
    lg: 'w-20 h-20 md:w-24 md:h-24 text-xl md:text-2xl',
  }

  const dotPositions: Record<number, string[]> = {
    1: ['center'],
    2: ['top-right', 'bottom-left'],
    3: ['top-right', 'center', 'bottom-left'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
  }

  const getPositionClasses = (position: string) => {
    const positions: Record<string, string> = {
      'top-left': 'top-1.5 left-1.5',
      'top-right': 'top-1.5 right-1.5',
      'middle-left': 'top-1/2 left-1.5 -translate-y-1/2',
      'middle-right': 'top-1/2 right-1.5 -translate-y-1/2',
      'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      'bottom-left': 'bottom-1.5 left-1.5',
      'bottom-right': 'bottom-1.5 right-1.5',
    }
    return positions[position] || ''
  }

  const currentValue = value >= 1 && value <= 6 ? value : 1

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        ${sizeClasses[size]}
        relative bg-white dark:bg-gray-800
        border-2 border-gray-400 dark:border-gray-600
        rounded-xl shadow-lg
        flex items-center justify-center
        transition-all duration-200
        ${isRolling ? 'animate-spin' : ''}
        ${onClick && !disabled ? 'cursor-pointer hover:shadow-xl hover:scale-105 active:scale-95' : 'cursor-default'}
        ${disabled ? 'opacity-50' : ''}
      `}
    >
      {dotPositions[currentValue]?.map((position, index) => (
        <div
          key={index}
          className={`
            absolute w-2.5 h-2.5
            bg-red-600 dark:bg-red-500
            rounded-full
            ${getPositionClasses(position)}
            ${size === 'sm' ? 'w-2 h-2' : ''}
          `}
        />
      ))}
    </div>
  )
}
