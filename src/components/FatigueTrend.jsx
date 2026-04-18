import React from 'react'

function Sparkline({ data, color }) {
  if (!data || data.length === 0) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  
  // Create points for a smooth SVG polyline
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100
    const y = 100 - ((d - min) / range) * 100
    return `${x},${y}`
  }).join(' ')

  return (
    <svg viewBox="0 -10 100 120" className="w-full h-10 overflow-visible" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export default function FatigueTrend({ history }) {
  // Get last 10 scores
  const last10 = history.slice(-10).map(h => h.score)
  
  let trend = "→ Stable"
  let color = "#10b981" // green
  
  if (last10.length >= 2) {
    const first = last10[0]
    const last = last10[last10.length - 1]
    const diff = last - first
    
    if (diff > 5) {
      trend = "↑ Rising"
      color = "#ef4444" // red
    } else if (diff < -5) {
      trend = "↓ Falling"
      color = "#22c55e" // green
    } else {
      trend = "→ Stable"
      color = "#eab308" // yellow
    }
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col justify-between">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Fatigue Trend</h2>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
          {trend}
        </span>
      </div>
      <div className="mt-2 w-full pt-2">
        <Sparkline data={last10.length > 0 ? last10 : [0, 0]} color={color} />
      </div>
    </div>
  )
}
