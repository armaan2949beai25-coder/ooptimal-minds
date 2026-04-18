import { useState, useEffect, useRef, useCallback } from 'react'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  const sqDiffs = arr.map((v) => (v - mean) ** 2)
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / arr.length)
}

function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// ─── Normalizers (raw → 0-100) ───────────────────────────────────────────────

function normalizeTypingVariance(sd) {
  return clamp(((sd - 30) / 170) * 100, 0, 100)
}

function normalizeMouseJitter(ratio) {
  if (ratio <= 1) return 0
  return clamp(((ratio - 1) / 3) * 100, 0, 100)
}

function normalizeScrollReversals(count) {
  return clamp((count / 10) * 100, 0, 100)
}

function normalizeClickAccuracy(avgDist) {
  return clamp((avgDist / 80) * 100, 0, 100)
}

// ── Face signal normalizers ──

/**
 * Blink rate: Normal 15-20 blinks/min
 *  <8 or >25 = fatigued
 *  Distance from ideal range → fatigue score
 */
function normalizeBlinkRate(bpm) {
  if (bpm >= 15 && bpm <= 20) return 0
  if (bpm < 15) return clamp(((15 - bpm) / 10) * 100, 0, 100)
  return clamp(((bpm - 20) / 15) * 100, 0, 100)
}

/**
 * Eye openness: Normal EAR ~0.25-0.35
 *  <0.18 = droopy/heavy lids = high fatigue
 *  >0.35 = wide open = fresh
 */
function normalizeEyeOpenness(ear) {
  if (ear >= 0.30) return 0
  if (ear <= 0.15) return 100
  return clamp(((0.30 - ear) / 0.15) * 100, 0, 100)
}

/**
 * Gaze stability: low value = stable = fresh
 *  0-5 = very stable
 *  30+ = erratic
 */
function normalizeGazeStability(instability) {
  return clamp((instability / 30) * 100, 0, 100)
}

// ─── Weights ─────────────────────────────────────────────────────────────────

// When face tracking is NOT available (4 signals)
const WEIGHTS_4 = {
  typing: 0.35,
  mouse:  0.30,
  scroll: 0.20,
  click:  0.15,
}

// When face tracking IS available (7 signals — proportionally reduced)
const WEIGHTS_7 = {
  typing:   0.175,
  mouse:    0.15,
  scroll:   0.10,
  click:    0.075,
  blink:    0.20,
  eyeOpen:  0.15,
  gaze:     0.15,
}

// ─── Level thresholds ────────────────────────────────────────────────────────

function getLevel(score) {
  if (score >= 60) return 'FATIGUED'
  if (score >= 30) return 'MILD'
  return 'FRESH'
}

// ─── Constants ───────────────────────────────────────────────────────────────

const COMPUTE_INTERVAL_MS = 5000
const HISTORY_MAX         = 60
const KEYSTROKE_BUF_SIZE  = 20
const MOUSE_BUF_SIZE      = 50
const CLICK_BUF_SIZE      = 30
const SCROLL_WINDOW_MS    = 30_000

// ─── Hook ────────────────────────────────────────────────────────────────────

export default function useFatigueDetection() {
  // ── Public state ──
  const [fatigueScore, setFatigueScore]   = useState(0)
  const [fatigueLevel, setFatigueLevel]   = useState('FRESH')
  const [history, setHistory]             = useState([])
  const [isMonitoring, setIsMonitoring]   = useState(true)
  const [signals, setSignals]             = useState({
    typing: { raw: 0, normalized: 0 },
    mouse:  { raw: 1, normalized: 0 },
    scroll: { raw: 0, normalized: 0 },
    click:  { raw: 0, normalized: 0 },
  })

  // ── Face signal state (null = no face tracking) ──
  const [faceSignals, setFaceSignals] = useState(null)
  const faceDataRef = useRef(null) // latest face data from FaceTracker

  // Stable setter for FaceTracker callback
  const updateFaceData = useCallback((data) => {
    faceDataRef.current = data
  }, [])

  // ── Mutable refs ──
  const keystrokeTimestamps = useRef([])
  const mousePositions      = useRef([])
  const scrollEvents        = useRef([])
  const clickDistances      = useRef([])
  const lastScrollY         = useRef(0)
  const lastScrollDir       = useRef(0)
  const monitoringRef       = useRef(true)

  useEffect(() => { monitoringRef.current = isMonitoring }, [isMonitoring])

  const toggleMonitoring = useCallback(() => {
    setIsMonitoring((prev) => !prev)
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  //  EVENT HANDLERS
  // ══════════════════════════════════════════════════════════════════════════

  const handleKeydown = useCallback((e) => {
    if (!monitoringRef.current) return
    const buf = keystrokeTimestamps.current
    buf.push(performance.now())
    if (buf.length > KEYSTROKE_BUF_SIZE) buf.shift()
  }, [])

  const handleMousemove = useCallback((e) => {
    if (!monitoringRef.current) return
    const buf = mousePositions.current
    buf.push({ x: e.clientX, y: e.clientY, t: performance.now() })
    if (buf.length > MOUSE_BUF_SIZE) buf.shift()
  }, [])

  const handleScroll = useCallback(() => {
    if (!monitoringRef.current) return
    const y = window.scrollY
    const dir = y > lastScrollY.current ? 1 : y < lastScrollY.current ? -1 : 0
    if (dir !== 0 && dir !== lastScrollDir.current && lastScrollDir.current !== 0) {
      scrollEvents.current.push({ dir, t: Date.now() })
    }
    lastScrollDir.current = dir
    lastScrollY.current = y
  }, [])

  const handleClick = useCallback((e) => {
    if (!monitoringRef.current) return
    const target = e.target
    if (!target?.getBoundingClientRect) return
    const rect = target.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const d = Math.sqrt((e.clientX - centerX) ** 2 + (e.clientY - centerY) ** 2)
    const buf = clickDistances.current
    buf.push(d)
    if (buf.length > CLICK_BUF_SIZE) buf.shift()
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  //  LISTENERS
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    document.addEventListener('keydown',   handleKeydown,   { capture: true })
    document.addEventListener('mousemove', handleMousemove, { capture: true, passive: true })
    document.addEventListener('click',     handleClick,     { capture: true })
    window.addEventListener('scroll',      handleScroll,    { capture: true, passive: true })

    return () => {
      document.removeEventListener('keydown',   handleKeydown,   { capture: true })
      document.removeEventListener('mousemove', handleMousemove, { capture: true })
      document.removeEventListener('click',     handleClick,     { capture: true })
      window.removeEventListener('scroll',      handleScroll,    { capture: true })
    }
  }, [handleKeydown, handleMousemove, handleScroll, handleClick])

  // ══════════════════════════════════════════════════════════════════════════
  //  COMPUTE — every 5s
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const id = setInterval(() => {
      if (!monitoringRef.current) return

      // --- Typing variance ---
      const kBuf = keystrokeTimestamps.current
      let typingSD = 0
      if (kBuf.length >= 3) {
        const intervals = []
        for (let i = 1; i < kBuf.length; i++) intervals.push(kBuf[i] - kBuf[i - 1])
        typingSD = stdDev(intervals)
      }
      const typingNorm = normalizeTypingVariance(typingSD)

      // --- Mouse jitter ---
      const mBuf = mousePositions.current
      let jitterRatio = 1
      if (mBuf.length >= 3) {
        let pathLen = 0
        for (let i = 1; i < mBuf.length; i++) pathLen += dist(mBuf[i - 1], mBuf[i])
        const straightLine = dist(mBuf[0], mBuf[mBuf.length - 1])
        jitterRatio = straightLine > 1 ? pathLen / straightLine : 1
      }
      const mouseNorm = normalizeMouseJitter(jitterRatio)

      // --- Scroll reversals ---
      const now = Date.now()
      scrollEvents.current = scrollEvents.current.filter((e) => now - e.t < SCROLL_WINDOW_MS)
      const reversals = scrollEvents.current.length
      const scrollNorm = normalizeScrollReversals(reversals)

      // --- Click accuracy ---
      const cBuf = clickDistances.current
      let avgClickDist = 0
      if (cBuf.length > 0) {
        avgClickDist = cBuf.reduce((a, b) => a + b, 0) / cBuf.length
      }
      const clickNorm = normalizeClickAccuracy(avgClickDist)

      // --- Face signals (if available) ---
      const face = faceDataRef.current
      const hasFace = !!face
      let blinkNorm = 0, eyeNorm = 0, gazeNorm = 0

      if (hasFace) {
        blinkNorm = normalizeBlinkRate(face.blinkRate)
        eyeNorm   = normalizeEyeOpenness(face.eyeOpenness)
        gazeNorm  = normalizeGazeStability(face.gazeStability)
      }

      // --- Weighted composite ---
      let composite
      if (hasFace) {
        composite =
          typingNorm * WEIGHTS_7.typing +
          mouseNorm  * WEIGHTS_7.mouse +
          scrollNorm * WEIGHTS_7.scroll +
          clickNorm  * WEIGHTS_7.click +
          blinkNorm  * WEIGHTS_7.blink +
          eyeNorm    * WEIGHTS_7.eyeOpen +
          gazeNorm   * WEIGHTS_7.gaze
      } else {
        composite =
          typingNorm * WEIGHTS_4.typing +
          mouseNorm  * WEIGHTS_4.mouse +
          scrollNorm * WEIGHTS_4.scroll +
          clickNorm  * WEIGHTS_4.click
      }

      const score = Math.round(clamp(composite, 0, 100) * 10) / 10

      // --- Build signals object ---
      const newSignals = {
        typing: { raw: Math.round(typingSD),                normalized: Math.round(typingNorm) },
        mouse:  { raw: Math.round(jitterRatio * 100) / 100, normalized: Math.round(mouseNorm) },
        scroll: { raw: reversals,                            normalized: Math.round(scrollNorm) },
        click:  { raw: Math.round(avgClickDist * 10) / 10,  normalized: Math.round(clickNorm) },
      }

      // Add face signals if available
      if (hasFace) {
        newSignals.blink = { raw: face.blinkRate,     normalized: Math.round(blinkNorm) }
        newSignals.eye   = { raw: face.eyeOpenness,   normalized: Math.round(eyeNorm) }
        newSignals.gaze  = { raw: face.gazeStability, normalized: Math.round(gazeNorm) }
      }

      setSignals(newSignals)
      setFatigueScore(score)
      setFatigueLevel(getLevel(score))

      if (hasFace) {
        setFaceSignals({
          blinkRate:     face.blinkRate,
          eyeOpenness:   face.eyeOpenness,
          gazeStability: face.gazeStability,
        })
      }

      setHistory((prev) => {
        const entry = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          score,
          timestamp: Date.now(),
        }
        return [...prev, entry].slice(-HISTORY_MAX)
      })
    }, COMPUTE_INTERVAL_MS)

    return () => clearInterval(id)
  }, [])

  return {
    fatigueScore,
    fatigueLevel,
    history,
    signals,
    isMonitoring,
    toggleMonitoring,
    faceSignals,
    updateFaceData,     // pass to FaceTracker's onSignals prop
    hasFaceTracking: !!faceSignals,
  }
}
