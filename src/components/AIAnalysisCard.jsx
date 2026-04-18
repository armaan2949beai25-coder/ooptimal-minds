import React from 'react'
import { motion } from 'framer-motion'

function dotColor(level) {
  if (level === 'FATIGUED') return '#ef4444'
  if (level === 'MILD') return '#eab308'
  return '#22c55e'
}

export default function AIAnalysisCard({ insight, loading }) {
  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 relative overflow-hidden flex-1 flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
            🤖
          </div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
            AI Analysis
          </h2>
        </div>
        {insight && !loading && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-bold tracking-wider"
            style={{
              color: dotColor(insight.fatigue_level),
              background: `${dotColor(insight.fatigue_level)}15`,
              border: `1px solid ${dotColor(insight.fatigue_level)}30`,
            }}
          >
            Score: {insight.score}
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {loading || !insight ? (
          <div className="animate-pulse space-y-3 mt-2">
            <div className="h-3 bg-white/10 rounded w-3/4"></div>
            <div className="h-3 bg-white/10 rounded w-1/2"></div>
            <div className="h-3 bg-white/10 rounded w-5/6"></div>
            <div className="h-3 bg-white/10 rounded w-2/3"></div>
          </div>
        ) : (
          <motion.div
            key={insight.recommendation}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Dominant Signal</p>
              <p className="text-sm text-gray-200">{insight.dominant_signal}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-medium mb-1">Recommendation</p>
              <p className="text-sm text-gray-200">{insight.recommendation}</p>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-2 mt-2">
              <p className="text-[10px] text-cyan-500/80 uppercase font-bold mb-1">UI Adjustment</p>
              <p className="text-sm text-cyan-400">{insight.interface_adjustment}</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
