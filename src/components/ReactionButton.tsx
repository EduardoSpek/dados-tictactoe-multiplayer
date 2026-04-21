'use client'

import { useState, useRef, forwardRef, useImperativeHandle } from 'react'

interface Reaction {
  emoji: string
  name: string
}

const REACTIONS: Reaction[] = [
  { emoji: '😊', name: 'Feliz' },
  { emoji: '😢', name: 'Triste' },
  { emoji: '😡', name: 'Raiva' },
  { emoji: '😂', name: 'Risada' },
  { emoji: '😎', name: 'Descolado' },
]

interface ReactionButtonProps {
  onReaction: (emoji: string, rect: DOMRect) => void
  disabled?: boolean
}

export interface ReactionButtonRef {
  getButtonRect: () => DOMRect | null
}

const ReactionButton = forwardRef<ReactionButtonRef, ReactionButtonProps>(
  function ReactionButton({ onReaction, disabled = false }, ref) {
    const [isOpen, setIsOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    useImperativeHandle(ref, () => ({
      getButtonRect: () => buttonRef.current?.getBoundingClientRect() || null,
    }))

    const handleReaction = (emoji: string) => {
      const rect = buttonRef.current?.getBoundingClientRect()
      if (rect) {
        onReaction(emoji, rect)
      }
      setIsOpen(false)
    }

    return (
      <div className="relative flex justify-center">
        {/* Reaction Button */}
        <button
          ref={buttonRef}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            text-2xl transition-all duration-200
            ${disabled 
              ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed opacity-50' 
              : 'bg-yellow-400 dark:bg-yellow-600 hover:bg-yellow-500 dark:hover:bg-yellow-500 hover:scale-110 active:scale-95 shadow-lg cursor-pointer'
            }
          `}
          title="Enviar reação"
        >
          😀
        </button>

        {/* Emoji Picker Popup - Vertical */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Popup - Vertical Layout */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-600 p-2 flex flex-col gap-1">
                {REACTIONS.map((reaction) => (
                  <button
                    key={reaction.emoji}
                    onClick={() => handleReaction(reaction.emoji)}
                    className="w-10 h-10 flex items-center justify-center text-2xl rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                    title={reaction.name}
                  >
                    {reaction.emoji}
                  </button>
                ))}
              </div>
              {/* Arrow */}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white dark:border-t-gray-800" />
              </div>
            </div>
          </>
        )}
      </div>
    )
  }
)

export default ReactionButton
export { REACTIONS }
export type { Reaction }
