import React, { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'

// ─── Zone colors ─────────────────────────────────────────────────────────────

const GREEN  = '#22c55e'
const YELLOW = '#eab308'
const RED    = '#ef4444'

// ─── Custom tooltip ──────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  const score = payload[0].value
  const color = score <= 30 ? GREEN : score <= 65 ? YELLOW : RED

  return (
    <div
      className="rounded-xl border border-white/10 px-4 py-3 backdrop-blur-xl shadow-2xl"
      style={{ background: 'rgba(10,10,18,0.92)' }}
    >
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] text-gray-600">/ 100</span>
      </div>
      <p className="text-[10px] mt-1" style={{ color }}>
        {score <= 30 ? 'Fresh' : score <= 65 ? 'Mild fatigue' : 'High fatigue'}
      </p>
    </div>
  )
}

// ─── Custom dot — colored by score zone ──────────────────────────────────────

function CustomActiveDot({ cx, cy, payload }) {
  if (!cx || !cy) return null
  const color = payload.score <= 30 ? GREEN : payload.score <= 65 ? YELLOW : RED
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={color} fillOpacity={0.2} />
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#0a0a0f" strokeWidth={2} />
    </g>
  )
}

// ─── Session duration formatter ──────────────────────────────────────────────

function formatDuration(ms) {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function Timeline({ data, sessionStart }) {
  // Live-updating session duration
  const [duration, setDuration] = useState('0m 00s')

  useEffect(() => {
    const tick = () => setDuration(formatDuration(Date.now() - sessionStart))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [sessionStart])

  // Latest score for dynamic line stroke
  const latestScore = data.length > 0 ? data[data.length - 1].score : 0
  const lineColor = latestScore <= 30 ? GREEN : latestScore <= 65 ? YELLOW : RED

  return (
    <div
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col"
      style={{ height: '140px' }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Fatigue Timeline
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-gray-600">
            {data.length} pts
          </span>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/5">
            <span className="text-[10px] text-gray-500">Session</span>
            <span className="text-xs font-mono font-semibold text-gray-300 tabular-nums">
              {duration}
            </span>
          </div>
        </div>
      </div>


      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
            <defs>
              {/* Vertical gradient for the line — green bottom → yellow mid → red top */}
              <linearGradient id="lineGradient" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%"   stopColor={GREEN}  stopOpacity={1} />
                <stop offset="30%"  stopColor={GREEN}  stopOpacity={1} />
                <stop offset="50%"  stopColor={YELLOW} stopOpacity={1} />
                <stop offset="65%"  stopColor={YELLOW} stopOpacity={1} />
                <stop offset="80%"  stopColor={RED}    stopOpacity={1} />
                <stop offset="100%" stopColor={RED}    stopOpacity={1} />
              </linearGradient>

              {/* Glow filter for the line */}
              <filter id="lineGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Zone background bands */}
            <ReferenceArea y1={0}  y2={30}  fill={GREEN}  fillOpacity={0.03} />
            <ReferenceArea y1={30} y2={65}  fill={YELLOW} fillOpacity={0.02} />
            <ReferenceArea y1={65} y2={100} fill={RED}    fillOpacity={0.02} />

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.03)"
              vertical={false}
            />

            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#4b5563' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
              interval="preserveStartEnd"
            />

            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fontSize: 10, fill: '#4b5563' }}
              tickLine={false}
              axisLine={{ stroke: 'rgba(255,255,255,0.04)' }}
            />

            {/* Reference lines at zone boundaries */}
            <ReferenceLine
              y={30}
              stroke={GREEN}
              strokeOpacity={0.25}
              strokeDasharray="6 3"
              label={{
                value: '30',
                position: 'right',
                fill: GREEN,
                fontSize: 9,
                fillOpacity: 0.5,
              }}
            />
            <ReferenceLine
              y={65}
              stroke={RED}
              strokeOpacity={0.25}
              strokeDasharray="6 3"
              label={{
                value: '65',
                position: 'right',
                fill: RED,
                fontSize: 9,
                fillOpacity: 0.5,
              }}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{ stroke: 'rgba(255,255,255,0.06)', strokeWidth: 1 }}
            />

            <Line
              type="monotone"
              dataKey="score"
              stroke="url(#lineGradient)"
              strokeWidth={2.5}
              dot={false}
              activeDot={<CustomActiveDot />}
              isAnimationActive={true}
              animationDuration={400}
              animationEasing="ease-out"
              filter="url(#lineGlow)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
