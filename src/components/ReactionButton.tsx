'use client'

import { useState, useEffect, useCallback } from 'react'

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
  onReaction: (emoji: string) => void
  disabled?: boolean
}

interface FloatingReaction {
  id: number
  emoji: string
  playerName: string
  playerSymbol: 'X' | 'O'
}

export default function ReactionButton({ onReaction, disabled = false }: ReactionButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([])

  const handleReaction = useCallback((emoji: string) => {
    onReaction(emoji)
    setIsOpen(false)
  }, [onReaction])

  // Add floating reaction when received
  const addFloatingReaction = useCallback((emoji: string, playerName: string, playerSymbol: 'X' | 'O') => {
    const id = Date.now() + Math.random()
    setFloatingReactions(prev => [...prev, { id, emoji, playerName, playerSymbol }])
    
    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id))
    }, 3000)
  }, [])

  return (
    <div className="relative">
      {/* Floating Reactions */}
      <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
        {floatingReactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 animate-float-up"
            style={{
              animation: 'floatUp 3s ease-out forwards',
            }}
          >
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full shadow-lg ${
              reaction.playerSymbol === 'X' 
                ? 'bg-blue-500 text-white' 
                : 'bg-green-500 text-white'
            }`}>
              <span className="text-2xl">{reaction.emoji}</span>
              <span className="text-sm font-bold">{reaction.playerName}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Reaction Button */}
      <div className="relative">
        <button
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

        {/* Emoji Picker Popup */}
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Popup */}
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-50">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border-2 border-gray-200 dark:border-gray-600 p-2 flex gap-1">
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
        .animate-float-up {
          animation: floatUp 3s ease-out forwards;
        }
      `}</style>
    </div>
  )
}

// Export helper to add floating reactions
export { REACTIONS }
export type { FloatingReaction }
