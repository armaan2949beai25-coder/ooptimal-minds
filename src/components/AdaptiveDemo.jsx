import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LEVEL_CONFIG, T_DURATION } from './AdaptiveUI'

export default function AdaptiveDemo({ fatigueLevel }) {
  const config = LEVEL_CONFIG[fatigueLevel] || LEVEL_CONFIG.FRESH

  return (
    <motion.div
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 relative overflow-hidden"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-purple-500 to-cyan-500" />
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Adaptive Interface Demo
        </h2>
        <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 ml-auto">
          ↑ Watch this content adapt in real time
        </span>
      </div>

      <motion.div
        animate={{
          fontSize: config.fontSize,
          lineHeight: config.lineHeight,
          letterSpacing: config.letterSpacing,
        }}
        transition={{ duration: T_DURATION, ease: 'easeInOut' }}
      >
        <motion.h3
          className="font-bold text-white mb-3"
          animate={{ fontSize: `calc(${config.fontSize} * 1.5)` }}
          transition={{ duration: T_DURATION }}
        >
          The Future of Human-Computer Interaction
        </motion.h3>

        <p className="text-gray-300 mb-4 opacity-90">
          Cognitive interfaces adapt dynamically to user fatigue. When a user is fresh, the interface can display dense information and complex controls. As cognitive load increases, the system simplifies.
        </p>
        <p className="text-gray-300 mb-4 opacity-90">
          This demo shows how typography, spacing, and element visibility adjust based on real-time biometric analysis.
        </p>

        <p className="text-gray-300 mb-5 opacity-90">
          Notice how secondary elements fade away when fatigue is high, focusing your attention on what truly matters.
        </p>

        <AnimatePresence>
          {!config.hideSecondary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-400">Subscribe for Updates</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    placeholder="name@example.com"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50"
                  />
                  <button className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-medium transition">
                    Subscribe
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}
