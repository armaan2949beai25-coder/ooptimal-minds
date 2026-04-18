import React, { useRef, useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getColor(score) {
  if (score <= 30) return '#22c55e'
  if (score <= 65) return '#eab308'
  return '#ef4444'
}

function getEmoji(score) {
  if (score <= 30) return '🚀'
  if (score <= 65) return '⚡'
  return '⚠️'
}

function getLevelText(score) {
  if (score <= 30) return 'FRESH'
  if (score <= 65) return 'MILD FATIGUE'
  return 'HIGH FATIGUE'
}

function getStatusLabel(normalized) {
  if (normalized >= 60) return { text: 'High', color: '#ef4444' }
  if (normalized >= 30) return { text: 'Elevated', color: '#eab308' }
  return { text: 'Normal', color: '#22c55e' }
}

const BASE_CARDS = [
  { key: 'typing', label: 'Typing Rhythm', icon: '⌨️', unit: 'ms σ', color: '#3b82f6' },
  { key: 'mouse',  label: 'Mouse Jitter', icon: '🖱️', unit: '× ratio', color: '#8b5cf6' },
  { key: 'scroll', label: 'Scroll Reversals', icon: '↕️', unit: '/30s', color: '#10b981' },
  { key: 'click',  label: 'Click Accuracy', icon: '🎯', unit: 'px', color: '#f59e0b' },
]

// ─── Animated number ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, className, style }) {
  const motionVal = useMotionValue(0)
  const rounded = useTransform(motionVal, (v) => Math.round(v))
  const ref = useRef(null)

  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 0.8, ease: 'easeOut' })
    return controls.stop
  }, [value, motionVal])

  useEffect(() => {
    const unsub = rounded.on('change', (v) => {
      if (ref.current) ref.current.textContent = v
    })
    return unsub
  }, [rounded])

  return (
    <motion.span ref={ref} className={className} style={style}>
      {Math.round(value)}
    </motion.span>
  )
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FatigueScore({ score, signals }) {
  const color = getColor(score)
  const emoji = getEmoji(score)
  const levelText = getLevelText(score)

  const radius = 62
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col gap-6">
      {/* ══════ Score Gauge Card ══════ */}
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center">
        <div className="flex justify-between w-full mb-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Cognitive Score</span>
          <span className="text-xs bg-white/5 px-2 py-0.5 rounded-full border border-white/10 text-gray-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
            LIVE
          </span>
        </div>

        <div className="relative w-48 h-48 py-2">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
            {/* Outer track */}
            <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            {/* Progress */}
            <motion.circle
              cx="70" cy="70" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ filter: `drop-shadow(0 0 10px ${color}80)` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedNumber
              value={score}
              className="text-5xl font-extrabold tabular-nums"
              style={{ color }}
            />
          </div>
        </div>

        <div className="text-center mt-2">
          <p className="text-lg font-bold tracking-wide" style={{ color }}>{levelText}</p>
          <p className="text-sm text-gray-400 mt-1">{emoji} Real-time evaluation</p>
        </div>
      </div>

      {/* ══════ Signal Grid (2x2) ══════ */}
      <div className="grid grid-cols-2 gap-4">
        {BASE_CARDS.map(({ key, label, icon, unit, color }) => {
          const sig = signals[key] || { raw: 0, normalized: 0 }
          const status = getStatusLabel(sig.normalized)

          return (
            <motion.div
              key={key}
              className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col justify-between group relative overflow-hidden"
              whileHover={{ borderColor: 'rgba(255,255,255,0.2)' }}
            >
              {/* Top row: Icon and Status */}
              <div className="flex justify-between items-start mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${color}20`, border: `1px solid ${color}40` }}>
                  {icon}
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ color: status.color, backgroundColor: `${status.color}15`, border: `1px solid ${status.color}30` }}>
                  {status.text}
                </span>
              </div>

              {/* Middle row: Name and Value */}
              <div className="my-2">
                <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
                <div className="flex items-baseline gap-1">
                  <motion.span
                    className="text-2xl font-bold tabular-nums text-white"
                    key={`${key}-${sig.raw}`}
                    initial={{ scale: 1.1, opacity: 0.8 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {sig.raw}
                  </motion.span>
                  <span className="text-xs text-gray-500">{unit}</span>
                </div>
              </div>

              {/* Bottom row: Mini bar */}
              <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: color }}
                  animate={{ width: `${Math.min(sig.normalized, 100)}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
