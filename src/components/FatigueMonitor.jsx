import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import useFatigueDetection from '../hooks/useFatigueDetection'
import AdaptiveUI from './AdaptiveUI'
import FatigueScore from './FatigueScore'
import Timeline from './Timeline'
import BreakSuggestion from './BreakSuggestion'

export default function FatigueMonitor() {
  const { fatigueScore, fatigueLevel, history, signals } = useFatigueDetection()
  const [sessionStart] = useState(Date.now())
  const [isBreakActive, setIsBreakActive] = useState(false)

  const handleBreakActive = useCallback((active) => {
    setIsBreakActive(active)
  }, [])

  return (
    <AdaptiveUI fatigueLevel={fatigueLevel}>
      {/* Main content — blurs when break is active */}
      <motion.div
        className="max-w-6xl mx-auto px-4 py-8"
        animate={{
          filter: isBreakActive ? 'blur(8px)' : 'blur(0px)',
          opacity: isBreakActive ? 0.4 : 1,
        }}
        transition={{ duration: 0.6 }}
        style={{ pointerEvents: isBreakActive ? 'none' : 'auto' }}
      >
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Cognitive Fatigue Monitor
          </h1>
          <p className="text-gray-400 mt-2 text-sm tracking-wide">
            Real-time mental energy tracking &amp; optimization
          </p>
        </motion.header>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Score + Signals - Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <FatigueScore
              score={fatigueScore}
              fatigueLevel={fatigueLevel}
              signals={signals}
            />
          </motion.div>

          {/* Timeline - Right (spans 2 cols) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="lg:col-span-2"
          >
            <Timeline data={history} sessionStart={sessionStart} />
          </motion.div>
        </div>
      </motion.div>

      {/* Break Suggestion — renders fixed-position popup + overlay independently */}
      <BreakSuggestion
        fatigueScore={fatigueScore}
        sessionStart={sessionStart}
        onBreakActive={handleBreakActive}
      />
    </AdaptiveUI>
  )
}
