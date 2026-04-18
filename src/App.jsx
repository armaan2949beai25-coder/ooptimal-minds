import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import useFatigueDetection from './hooks/useFatigueDetection'
import AdaptiveUI from './components/AdaptiveUI'
import FatigueScore from './components/FatigueScore'
import Timeline from './components/Timeline'
import BreakSuggestion from './components/BreakSuggestion'
import FaceTracker from './components/FaceTracker'
import AlertSystem from './components/AlertSystem'
import Auth from './components/Auth'
import AdaptiveDemo from './components/AdaptiveDemo'
import FatigueTrend from './components/FatigueTrend'
import AIAnalysisCard from './components/AIAnalysisCard'
import { supabase } from './lib/supabase'

// ─── Backend config ──────────────────────────────────────────────────────────

const API_BASE = 'http://localhost:8000'
const POLL_MS = 30_000
const SESSION_SAVE_MS = 5 * 60 * 1000  // save every 5 minutes

// ─── Status dot color ────────────────────────────────────────────────────────

function dotColor(level) {
  if (level === 'FATIGUED') return '#ef4444'
  if (level === 'MILD')     return '#eab308'
  return '#22c55e'
}

// ═════════════════════════════════════════════════════════════════════════════
//  APP
// ═════════════════════════════════════════════════════════════════════════════

function App() {
  const { fatigueScore, fatigueLevel, history, signals, isMonitoring, toggleMonitoring, updateFaceData, hasFaceTracking } = useFatigueDetection()
  const [sessionStart] = useState(Date.now())
  const [isBreakActive, setIsBreakActive] = useState(false)
  const [aiInsight, setAiInsight] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const pollRef = useRef(null)

  // ── Auth state ──
  const [user, setUser] = useState(undefined) // undefined=loading, null=no user, obj=logged in
  const [authLoading, setAuthLoading] = useState(true)
  const peakScoreRef = useRef(0)

  // Track peak score
  useEffect(() => {
    if (fatigueScore > peakScoreRef.current) peakScoreRef.current = fatigueScore
  }, [fatigueScore])

  // ── Listen for auth changes ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Save session to Supabase ──
  const saveSession = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser || history.length === 0) return
    const scores = history.map((h) => h.score)
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    const durationMin = Math.round((Date.now() - sessionStart) / 60000)
    // Find dominant signal
    let dominant = 'typing'
    let maxNorm = 0
    for (const [key, val] of Object.entries(signals)) {
      if (val.normalized > maxNorm) { maxNorm = val.normalized; dominant = key }
    }
    try {
      await supabase.from('fatigue_sessions').insert({
        user_id: currentUser.id,
        avg_score: avgScore,
        peak_score: Math.round(peakScoreRef.current),
        duration_minutes: durationMin,
        dominant_signal: dominant,
        score_history: scores.slice(-60),
      })
    } catch (err) {
      console.warn('Session save failed:', err)
    }
  }, [history, signals, sessionStart])

  // ── Auto-save every 5 min ──
  useEffect(() => {
    if (!user) return
    const id = setInterval(saveSession, SESSION_SAVE_MS)
    return () => clearInterval(id)
  }, [user, saveSession])

  // ── Save on tab close ──
  useEffect(() => {
    if (!user) return
    const handleUnload = () => { saveSession() }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [user, saveSession])

  // ── Logout ──
  const handleLogout = async () => {
    await saveSession()
    await supabase.auth.signOut()
  }

  // ── Auth loading screen ──
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050508]">
        <motion.div
          className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    )
  }

  // ── Show Auth if not logged in ──
  if (!user) return <Auth />

  // ── Backend polling ──
  const fetchAI = useCallback(async () => {
    try {
      setAiLoading(true)
      const mins = (Date.now() - sessionStart) / 60000
      const payload = {
        typing_variance: signals.typing.raw,
        mouse_jitter: signals.mouse.raw,
        scroll_reversals: signals.scroll.raw,
        click_accuracy: signals.click.raw,
        session_duration_minutes: Math.round(mins * 10) / 10,
      }
      // Add face signals if available
      if (signals.blink) {
        payload.blink_rate = signals.blink.raw
        payload.eye_openness = signals.eye?.raw ?? 0
        payload.gaze_stability = signals.gaze?.raw ?? 0
      }
      const res = await fetch(`${API_BASE}/analyze-signals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (res.ok) setAiInsight(await res.json())
    } catch { /* backend offline */ } finally { setAiLoading(false) }
  }, [signals, sessionStart])

  useEffect(() => {
    const t = setTimeout(fetchAI, 5000)
    pollRef.current = setInterval(fetchAI, POLL_MS)
    return () => { clearTimeout(t); clearInterval(pollRef.current) }
  }, [fetchAI])

  const durationMin = Math.floor((Date.now() - sessionStart) / 60000)

  return (
    <AdaptiveUI fatigueLevel={fatigueLevel}>
      <motion.div
        className="flex flex-col h-screen overflow-hidden text-white bg-[#050508] font-sans"
        animate={{
          filter: isBreakActive ? 'blur(10px)' : 'blur(0px)',
          opacity: isBreakActive ? 0.25 : 1,
        }}
        transition={{ duration: 0.6 }}
        style={{ pointerEvents: isBreakActive ? 'none' : 'auto' }}
      >
        {/* HEADER */}
        <header className="flex-none h-16 border-b border-white/10 px-6 flex items-center justify-between z-10 bg-white/5 backdrop-blur-md">
          {/* Left */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10 bg-gradient-to-br from-purple-500/20 to-cyan-500/20">
              <span className="text-sm">🧠</span>
            </div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
              CogniFlow
            </h1>
          </div>

          {/* Center */}
          <div className="flex items-center gap-4">
            <button
              onClick={toggleMonitoring}
              className={`px-3 py-1 rounded-full border text-xs font-semibold flex items-center gap-2 cursor-pointer transition ${
                isMonitoring 
                  ? 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20' 
                  : 'bg-gray-500/10 border-gray-500/30 text-gray-400 hover:bg-gray-500/20'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`} />
              {isMonitoring ? 'MONITORING' : 'PAUSED'}
            </button>
            <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
              Session: {durationMin}m
            </div>
            <div 
              className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-wider uppercase" 
              style={{ color: dotColor(fatigueLevel) }}
            >
              {fatigueLevel}
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <button 
              onClick={handleLogout} 
              className="text-xs text-gray-400 hover:text-white transition font-medium"
            >
              Logout
            </button>
            <div className="w-8 h-8 rounded-full border border-purple-500/30 bg-purple-500/20 flex items-center justify-center">
              👤
            </div>
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="flex-1 overflow-hidden p-6 relative z-0">
          <div className="h-full flex gap-6 max-w-7xl mx-auto">
            
            {/* LEFT PANEL (55%) */}
            <div className="w-[55%] flex flex-col gap-6 overflow-y-auto pb-12 custom-scrollbar pr-2">
              <AdaptiveDemo fatigueLevel={fatigueLevel} />
              <FatigueTrend history={history} />
              <AIAnalysisCard insight={aiInsight} loading={aiLoading} />
            </div>

            {/* RIGHT PANEL (45%) */}
            <div className="w-[45%] flex flex-col gap-6 overflow-y-auto pb-12 custom-scrollbar pr-2">
              <FatigueScore score={fatigueScore} fatigueLevel={fatigueLevel} signals={signals} />
              <Timeline data={history} sessionStart={sessionStart} />
            </div>

          </div>
        </main>

        {/* BOTTOM BAR */}
        <footer className="fixed bottom-0 left-0 right-0 h-12 border-t border-white/10 bg-[#050508]/80 backdrop-blur-md px-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-2 text-xs text-gray-400 font-medium">
            <span className={`w-2 h-2 rounded-full ${hasFaceTracking ? 'bg-green-400' : 'bg-gray-600'}`} />
            {hasFaceTracking ? 'Camera Active' : 'Camera Inactive'}
          </div>
          <button className="flex items-center gap-2 text-xs text-gray-400 hover:text-white transition font-medium cursor-pointer">
            Alerts
            <span className="bg-purple-500 text-white px-1.5 py-0.5 rounded-full text-[10px] font-bold">2</span>
          </button>
        </footer>

        <BreakSuggestion
          fatigueScore={fatigueScore}
          sessionStart={sessionStart}
          onBreakActive={setIsBreakActive}
        />
        <FaceTracker onSignals={updateFaceData} />
        <AlertSystem fatigueScore={fatigueScore} sessionStart={sessionStart} />
      </motion.div>
    </AdaptiveUI>
  )
}

export default App
