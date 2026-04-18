import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Eye landmark indices ────────────────────────────────────────────────────

const LEFT_EYE  = { top: 159, bottom: 145, left: 33, right: 133 }
const RIGHT_EYE = { top: 386, bottom: 374, left: 362, right: 263 }

// Iris center landmarks (available with refineLandmarks: true)
const LEFT_IRIS_CENTER  = 468
const RIGHT_IRIS_CENTER = 473

// EAR blink threshold — below this = eye closed
const BLINK_EAR_THRESHOLD = 0.21

// CDN URLs for MediaPipe (Closure-compiled IIFEs that assign to window)
const FACE_MESH_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js'
const CAMERA_UTILS_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1640029074/camera_utils.js'
const FACE_MESH_ASSETS = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function euclidean(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)
}

function eyeAspectRatio(landmarks, eye) {
  const vertical   = euclidean(landmarks[eye.top], landmarks[eye.bottom])
  const horizontal = euclidean(landmarks[eye.left], landmarks[eye.right])
  return horizontal > 0 ? vertical / horizontal : 0
}

function stdDev(arr) {
  if (arr.length < 2) return 0
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

// ─── Load script from CDN ────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.crossOrigin = 'anonymous'
    script.onload = resolve
    script.onerror = () => reject(new Error(`Failed to load ${src}`))
    document.head.appendChild(script)
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FaceTracker({ onSignals }) {
  const videoRef     = useRef(null)
  const canvasRef    = useRef(null)
  const cameraRef    = useRef(null)
  const faceMeshRef  = useRef(null)

  const [permission, setPermission] = useState(null) // null=pending, true, false
  const [loading, setLoading]       = useState(true)
  const [faceDetected, setFaceDetected] = useState(false)

  // Blink tracking
  const blinkTimes   = useRef([])
  const wasBlinking  = useRef(false)

  // Eye openness buffer
  const earBuffer    = useRef([])

  // Gaze stability buffer
  const gazeBuffer   = useRef([])

  // ── Process face landmarks ──
  const onResults = useCallback((results) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setFaceDetected(false)
      return
    }
    setFaceDetected(true)
    const lm = results.multiFaceLandmarks[0]

    // ── Draw eye contours highlighted ──
    const drawEye = (eye, color) => {
      const pts = [eye.left, eye.top, eye.right, eye.bottom]
      ctx.beginPath()
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      pts.forEach((idx, i) => {
        const p = lm[idx]
        const x = p.x * canvas.width
        const y = p.y * canvas.height
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.closePath()
      ctx.stroke()
    }
    drawEye(LEFT_EYE, 'rgba(34, 197, 94, 0.8)')
    drawEye(RIGHT_EYE, 'rgba(34, 197, 94, 0.8)')

    // Draw iris dots if available
    if (lm.length > RIGHT_IRIS_CENTER) {
      ;[LEFT_IRIS_CENTER, RIGHT_IRIS_CENTER].forEach((idx) => {
        const p = lm[idx]
        ctx.beginPath()
        ctx.arc(p.x * canvas.width, p.y * canvas.height, 2, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(124, 58, 237, 0.9)'
        ctx.fill()
      })
    }

    // Draw nose tip for face position reference
    const nose = lm[1]
    ctx.beginPath()
    ctx.arc(nose.x * canvas.width, nose.y * canvas.height, 1.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(6, 182, 212, 0.6)'
    ctx.fill()

    // ── 1. EAR + Blink detection ──
    const leftEAR  = eyeAspectRatio(lm, LEFT_EYE)
    const rightEAR = eyeAspectRatio(lm, RIGHT_EYE)
    const avgEAR   = (leftEAR + rightEAR) / 2

    const isBlinking = avgEAR < BLINK_EAR_THRESHOLD
    if (isBlinking && !wasBlinking.current) {
      blinkTimes.current.push(Date.now())
    }
    wasBlinking.current = isBlinking

    // Keep blinks from last 60s
    const now = Date.now()
    blinkTimes.current = blinkTimes.current.filter((t) => now - t < 60_000)
    const blinksPerMinute = blinkTimes.current.length

    // ── 2. Eye openness ──
    earBuffer.current.push(avgEAR)
    if (earBuffer.current.length > 60) earBuffer.current.shift()
    const avgOpenness = earBuffer.current.reduce((a, b) => a + b, 0) / earBuffer.current.length

    // ── 3. Gaze stability (iris tracking) ──
    let gazeInstability = 0
    if (lm.length > RIGHT_IRIS_CENTER) {
      const leftIris  = lm[LEFT_IRIS_CENTER]
      const rightIris = lm[RIGHT_IRIS_CENTER]
      gazeBuffer.current.push({
        x: (leftIris.x + rightIris.x) / 2,
        y: (leftIris.y + rightIris.y) / 2,
      })
      if (gazeBuffer.current.length > 60) gazeBuffer.current.shift()

      if (gazeBuffer.current.length >= 5) {
        const xs = gazeBuffer.current.map((g) => g.x)
        const ys = gazeBuffer.current.map((g) => g.y)
        gazeInstability = (stdDev(xs) + stdDev(ys)) * 500
      }
    }

    // ── Send to hook ──
    onSignals({
      blinkRate: blinksPerMinute,
      eyeOpenness: Math.round(avgOpenness * 1000) / 1000,
      gazeStability: Math.round(gazeInstability * 10) / 10,
    })
  }, [onSignals])

  // ── Initialize MediaPipe + Camera ──
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        // Request camera permission FIRST (before loading heavy WASM)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 320, height: 240, facingMode: 'user' },
        })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        setPermission(true)

        const video = videoRef.current
        if (!video) return
        video.srcObject = stream

        // Load MediaPipe from CDN (Closure-compiled IIFEs assign to window)
        await loadScript(FACE_MESH_CDN)
        await loadScript(CAMERA_UTILS_CDN)
        if (cancelled) return

        // Access constructors from window (where the IIFE registered them)
        const FaceMeshCtor = window.FaceMesh
        const CameraCtor = window.Camera

        if (typeof FaceMeshCtor !== 'function' || typeof CameraCtor !== 'function') {
          throw new Error('MediaPipe CDN scripts loaded but constructors not found on window')
        }

        const faceMesh = new FaceMeshCtor({
          locateFile: (file) => `${FACE_MESH_ASSETS}${file}`,
        })

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true, // enables 478 landmarks (includes iris)
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        })

        faceMesh.onResults(onResults)
        faceMeshRef.current = faceMesh

        const camera = new CameraCtor(video, {
          onFrame: async () => {
            if (faceMeshRef.current) {
              await faceMeshRef.current.send({ image: video })
            }
          },
          width: 320,
          height: 240,
        })

        cameraRef.current = camera
        await camera.start()
        if (cancelled) { camera.stop(); return }

        setLoading(false)
      } catch (err) {
        console.warn('FaceTracker: Camera access denied or unavailable —', err.message)
        if (!cancelled) {
          setPermission(false)
          setLoading(false)
        }
      }
    }

    init()

    return () => {
      cancelled = true
      if (cameraRef.current) {
        try { cameraRef.current.stop() } catch {}
      }
      if (faceMeshRef.current) {
        try { faceMeshRef.current.close() } catch {}
      }
      if (videoRef.current?.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((t) => t.stop())
      }
    }
  }, [onResults])

  // ── No permission → fallback silently ──
  if (permission === false) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/[0.06] backdrop-blur-xl text-[10px] text-gray-500"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <span>📷</span>
          <span>Camera unavailable — using 4-signal mode</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <motion.div
        className="relative rounded-xl overflow-hidden border border-white/[0.1] backdrop-blur-xl"
        style={{ background: 'rgba(0,0,0,0.6)', width: 160, height: 120 }}
        initial={{ opacity: 0, scale: 0.8, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5, type: 'spring' }}
        whileHover={{ scale: 1.05, borderColor: 'rgba(124,58,237,0.3)' }}
      >
        {/* Video */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          playsInline
          muted
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Canvas overlay for landmarks */}
        <canvas
          ref={canvasRef}
          width={320}
          height={240}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'scaleX(-1)' }}
        />

        {/* Status badge */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
          <motion.span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: faceDetected ? '#22c55e' : '#eab308' }}
            animate={faceDetected ? { scale: [1, 1.4, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-[8px] font-bold tracking-wider" style={{ color: faceDetected ? '#22c55e' : '#eab308' }}>
            {loading ? 'LOADING' : faceDetected ? 'FACE' : 'NO FACE'}
          </span>
        </div>

        {/* Loading overlay */}
        <AnimatePresence>
          {loading && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center bg-black/70"
              exit={{ opacity: 0 }}
            >
              <div className="text-center">
                <motion.div
                  className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full mx-auto mb-1"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <span className="text-[8px] text-gray-400">Loading AI</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
