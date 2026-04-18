import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Constants ───────────────────────────────────────────────────────────────

const SCORE_THRESHOLD  = 70        // Score above which we start tracking
const SUSTAIN_SECONDS  = 30        // Must stay above threshold for this long
const BREAK_DURATION   = 5 * 60    // 5 minute break in seconds
const COOLDOWN_MS      = 10 * 60 * 1000  // 10 minutes after dismissing

// ─── Breathing phases ────────────────────────────────────────────────────────

const BREATHING_CYCLE = [
  { label: 'Breathe in…',  duration: 4000, scale: 1.35 },
  { label: 'Hold…',        duration: 4000, scale: 1.35 },
  { label: 'Breathe out…', duration: 6000, scale: 1.0  },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatMinutes(ms) {
  return Math.floor(ms / 1000 / 60)
}

// ─── Breathing exercise sub-component ────────────────────────────────────────

function BreathingExercise() {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phase = BREATHING_CYCLE[phaseIndex]

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhaseIndex((i) => (i + 1) % BREATHING_CYCLE.length)
    }, phase.duration)
    return () => clearTimeout(timer)
  }, [phaseIndex, phase.duration])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated breathing circle */}
      <motion.div
        className="w-28 h-28 rounded-full border-2 border-cyan-400/30 flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(6,182,212,0.12) 0%, transparent 70%)',
          boxShadow: '0 0 40px rgba(6,182,212,0.08)',
        }}
        animate={{ scale: phase.scale }}
        transition={{ duration: phase.duration / 1000, ease: 'easeInOut' }}
      >
        <motion.div
          className="w-16 h-16 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, rgba(6,182,212,0.05) 70%)',
          }}
          animate={{ scale: phase.scale }}
          transition={{ duration: phase.duration / 1000, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Phase label */}
      <motion.p
        key={phase.label}
        className="text-lg font-medium text-cyan-300 tracking-wide"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {phase.label}
      </motion.p>
    </div>
  )
}

// ─── Main BreakSuggestion component ──────────────────────────────────────────

export default function BreakSuggestion({ fatigueScore, sessionStart, onBreakActive }) {
  // ── Internal state ──
  const [isVisible, setIsVisible]     = useState(false)   // popup shown
  const [isOnBreak, setIsOnBreak]     = useState(false)    // break mode active
  const [countdown, setCountdown]     = useState(BREAK_DURATION)
  const [isDismissed, setIsDismissed] = useState(false)    // user clicked Continue

  // ── Refs for tracking ──
  const sustainStart = useRef(null)   // when score first crossed threshold
  const dismissedAt  = useRef(null)   // timestamp of last dismiss

  // ── Track sustained high fatigue → show popup ──
  useEffect(() => {
    if (isOnBreak || isDismissed) return

    if (fatigueScore > SCORE_THRESHOLD) {
      if (!sustainStart.current) {
        sustainStart.current = Date.now()
      }
      const elapsed = Date.now() - sustainStart.current
      if (elapsed >= SUSTAIN_SECONDS * 1000) {
        setIsVisible(true)
      }
    } else {
      // Score dropped below threshold — reset
      sustainStart.current = null
      setIsVisible(false)
    }
  }, [fatigueScore, isOnBreak, isDismissed])

  // ── Cooldown timer after dismiss ──
  useEffect(() => {
    if (!isDismissed) return
    const timer = setTimeout(() => {
      setIsDismissed(false)
      dismissedAt.current = null
      sustainStart.current = null
    }, COOLDOWN_MS)
    return () => clearTimeout(timer)
  }, [isDismissed])

  // ── Break countdown timer ──
  useEffect(() => {
    if (!isOnBreak) return
    if (countdown <= 0) {
      // Break finished
      setIsOnBreak(false)
      setIsVisible(false)
      setCountdown(BREAK_DURATION)
      sustainStart.current = null
      onBreakActive?.(false)
      return
    }
    const id = setInterval(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearInterval(id)
  }, [isOnBreak, countdown, onBreakActive])

  // ── Handlers ──
  const handleTakeBreak = useCallback(() => {
    setIsOnBreak(true)
    setCountdown(BREAK_DURATION)
    onBreakActive?.(true)
  }, [onBreakActive])

  const handleContinue = useCallback(() => {
    setIsVisible(false)
    setIsDismissed(true)
    dismissedAt.current = Date.now()
    sustainStart.current = null
  }, [])

  const handleEndBreakEarly = useCallback(() => {
    setIsOnBreak(false)
    setIsVisible(false)
    setCountdown(BREAK_DURATION)
    sustainStart.current = null
    onBreakActive?.(false)
  }, [onBreakActive])

  const focusMinutes = formatMinutes(Date.now() - sessionStart)

  return (
    <>
      {/* ── Fullscreen blur overlay + breathing exercise (break mode) ── */}
      <AnimatePresence>
        {isOnBreak && (
          <motion.div
            key="break-overlay"
            className="fixed inset-0 z-[60] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Blurred backdrop */}
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                background: 'rgba(8,8,16,0.75)',
              }}
            />

            {/* Break content */}
            <motion.div
              className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 rounded-3xl border border-white/[0.06] max-w-sm w-full mx-4"
              style={{ background: 'rgba(15,15,28,0.85)' }}
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ duration: 0.5 }}
            >
              {/* Timer */}
              <div className="text-center">
                <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Break Time</p>
                <motion.span
                  className="text-5xl font-bold text-white tabular-nums tracking-wider"
                  key={countdown}
                  initial={{ opacity: 0.7 }}
                  animate={{ opacity: 1 }}
                >
                  {formatTime(countdown)}
                </motion.span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                  style={{ width: `${((BREAK_DURATION - countdown) / BREAK_DURATION) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              {/* Breathing exercise */}
              <BreathingExercise />

              {/* Tip */}
              <p className="text-xs text-gray-600 text-center max-w-xs">
                Relax your eyes. Unclench your jaw. Drop your shoulders.
              </p>

              {/* End early button */}
              <button
                onClick={handleEndBreakEarly}
                className="px-5 py-2 rounded-xl text-xs text-gray-500 border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-colors cursor-pointer"
              >
                End Break Early
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom-right popup ── */}
      <AnimatePresence>
        {isVisible && !isOnBreak && (
          <motion.div
            key="break-popup"
            className="fixed bottom-6 right-6 z-50 max-w-sm w-full"
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div
              className="rounded-2xl border border-red-500/15 p-5 shadow-2xl"
              style={{
                background: 'rgba(12,12,22,0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                boxShadow: '0 0 60px -15px rgba(239,68,68,0.12), 0 25px 50px -12px rgba(0,0,0,0.5)',
              }}
            >
              {/* Brain + message */}
              <div className="flex items-start gap-3 mb-4">
                <span className="text-3xl mt-0.5">🧠</span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    You've been focused for {focusMinutes} minute{focusMinutes !== 1 ? 's' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    Your interaction patterns suggest mental fatigue.
                    A short break will help you stay sharp.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5">
                <button
                  onClick={handleTakeBreak}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer hover:brightness-110 transition-all"
                  style={{
                    background: 'linear-gradient(135deg, rgba(6,182,212,0.7), rgba(124,58,237,0.6))',
                  }}
                >
                  🧘 Take a 5-min Break
                </button>
                <button
                  onClick={handleContinue}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 border border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06] transition-colors cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
