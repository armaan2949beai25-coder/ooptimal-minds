import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Typography & layout config per fatigue level ────────────────────────────

const LEVEL_CONFIG = {
  FRESH: {
    fontSize: '16px',
    lineHeight: '1.5',
    letterSpacing: 'normal',
    overlay: 'transparent',
    accent: '#22c55e',
    hideSecondary: false,
    hideDecorative: false,
    disableAnimations: false,
  },
  MILD: {
    fontSize: '19px',
    lineHeight: '1.8',
    letterSpacing: '0.02em',
    overlay: 'transparent',
    accent: '#eab308',
    hideSecondary: false,
    hideDecorative: false,
    disableAnimations: false,
  },
  FATIGUED: {
    fontSize: '23px',
    lineHeight: '2.2',
    letterSpacing: '0.05em',
    overlay: 'rgba(255, 200, 100, 0.03)',
    accent: '#ef4444',
    hideSecondary: true,
    hideDecorative: true,
    disableAnimations: true,
  },
}

const T_DURATION = 0.8

// ─── Floating background orbs ────────────────────────────────────────────────

function DecorativeOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-0" aria-hidden="true">
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full opacity-[0.07] blur-[100px]"
        style={{ background: '#7c3aed', top: '-10%', right: '-5%' }}
        animate={{ y: [0, 30, 0], x: [0, -15, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
        style={{ background: '#06b6d4', bottom: '0%', left: '-5%' }}
        animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[80px]"
        style={{ background: '#7c3aed', top: '50%', left: '40%' }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

// ─── AdaptiveUI — pure wrapper for adaptive styling ─────────────────────────

export default function AdaptiveUI({ fatigueLevel, children }) {
  const config = LEVEL_CONFIG[fatigueLevel] || LEVEL_CONFIG.FRESH

  const cssVars = useMemo(
    () => ({
      '--adaptive-font-size': config.fontSize,
      '--adaptive-line-height': config.lineHeight,
      '--adaptive-letter-spacing': config.letterSpacing,
      '--adaptive-accent': config.accent,
    }),
    [config]
  )

  return (
    <motion.div
      className="relative min-h-screen"
      style={cssVars}
      animate={{
        fontSize: config.fontSize,
        lineHeight: config.lineHeight,
        letterSpacing: config.letterSpacing,
      }}
      transition={{ duration: T_DURATION, ease: 'easeInOut' }}
    >
      {/* Warm dim overlay (FATIGUED) */}
      <AnimatePresence>
        {config.overlay !== 'transparent' && (
          <motion.div
            key="warm-overlay"
            className="fixed inset-0 pointer-events-none z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: T_DURATION }}
            style={{ background: config.overlay }}
          />
        )}
      </AnimatePresence>

      {/* Background orbs (hidden in FATIGUED) */}
      <AnimatePresence>
        {!config.hideDecorative && (
          <motion.div
            key="orbs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: T_DURATION }}
          >
            <DecorativeOrbs />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Disable CSS animations in FATIGUED */}
      {config.disableAnimations && (
        <style>{`
          .adaptive-zone *,
          .adaptive-zone *::before,
          .adaptive-zone *::after {
            animation-duration: 0s !important;
            animation-delay: 0s !important;
            transition-duration: 0.01s !important;
          }
        `}</style>
      )}

      {/* Content */}
      <div className={`relative z-10 ${config.disableAnimations ? 'adaptive-zone' : ''}`}>
        {children}
      </div>
    </motion.div>
  )
}

// ─── Exported config for App.jsx to use ──────────────────────────────────────

export { LEVEL_CONFIG, T_DURATION }
