'use client'

import { useCallback, useRef } from 'react'

// Simple beep sounds using Web Audio API
const useSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null)

  const getAudioContext = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }

  const playTone = useCallback((frequency: number, duration: number, type: OscillatorType = 'sine') => {
    try {
      const ctx = getAudioContext()
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.frequency.value = frequency
      oscillator.type = type

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration)

      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + duration)
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Dice roll sound - rapid ticking
  const playDiceRoll = useCallback(() => {
    try {
      const ctx = getAudioContext()
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)
          
          oscillator.frequency.value = 400 + Math.random() * 200
          oscillator.type = 'square'
          
          gainNode.gain.setValueAtTime(0.1, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05)
          
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.05)
        }, i * 60)
      }
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Place mark sound - pleasant ping
  const playPlaceMark = useCallback(() => {
    playTone(800, 0.15, 'sine')
    setTimeout(() => playTone(1200, 0.1, 'sine'), 50)
  }, [playTone])

  // Win sound - victory fanfare
  const playWin = useCallback(() => {
    try {
      const ctx = getAudioContext()
      const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)
          
          oscillator.frequency.value = freq
          oscillator.type = 'triangle'
          
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
          
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.4)
        }, index * 150)
      })
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Column full sound - low buzz
  const playColumnFull = useCallback(() => {
    playTone(150, 0.3, 'sawtooth')
  }, [playTone])

  // Button click sound
  const playClick = useCallback(() => {
    playTone(600, 0.08, 'sine')
  }, [playTone])

  // Steal sound - dramatic power-up
  const playSteal = useCallback(() => {
    try {
      const ctx = getAudioContext()
      // Rising dramatic sound
      const notes = [300, 450, 600, 900]
      
      notes.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)
          
          oscillator.frequency.value = freq
          oscillator.type = 'sawtooth'
          
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
          
          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.3)
        }, index * 80)
      })
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Clear board sound - sweeping erase
  const playClear = useCallback(() => {
    try {
      const ctx = getAudioContext()
      // Sweeping sound
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      oscillator.frequency.setValueAtTime(800, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5)
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.5)
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  // Turn expired sound - alert when timer runs out
  const playTurnExpired = useCallback(() => {
    try {
      const ctx = getAudioContext()
      // Three beeps for alert
      const notes = [400, 300, 200]

      notes.forEach((freq, index) => {
        setTimeout(() => {
          const oscillator = ctx.createOscillator()
          const gainNode = ctx.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(ctx.destination)

          oscillator.frequency.value = freq
          oscillator.type = 'square'

          gainNode.gain.setValueAtTime(0.2, ctx.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2)

          oscillator.start(ctx.currentTime)
          oscillator.stop(ctx.currentTime + 0.2)
        }, index * 200)
      })
    } catch (e) {
      console.log('Audio not supported')
    }
  }, [])

  return {
    playDiceRoll,
    playPlaceMark,
    playWin,
    playColumnFull,
    playClick,
    playSteal,
    playClear,
    playTurnExpired
  }
}

export default useSound
