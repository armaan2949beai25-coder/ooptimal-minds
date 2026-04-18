import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import emailjs from '@emailjs/browser'

// ─── Constants ───────────────────────────────────────────────────────────────

const SCORE_THRESHOLD    = 80
const SUSTAINED_MS       = 5 * 60 * 1000   // 5 minutes
const NOTIF_COOLDOWN_MS  = 10 * 60 * 1000  // Don't re-notify for 10 min
const BANNER_DISMISS_MS  = 60 * 1000       // Banner auto-reappears after 1 min

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(ms) {
  const mins = Math.floor(ms / 60_000)
  const hrs  = Math.floor(mins / 60)
  if (hrs > 0) return `${hrs}h ${mins % 60}m`
  return `${mins}m`
}

// ═════════════════════════════════════════════════════════════════════════════
//  ALERT SYSTEM
// ═════════════════════════════════════════════════════════════════════════════

export default function AlertSystem({ fatigueScore, sessionStart }) {
  // ── State ──
  const [alertActive, setAlertActive]       = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [showSettings, setShowSettings]     = useState(false)
  const [notifPermission, setNotifPermission] = useState('default')

  // EmailJS settings (persisted in localStorage)
  const [emailSettings, setEmailSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('cogniflow_email_settings')
      return saved ? JSON.parse(saved) : {
        enabled: false,
        caregiverEmail: '',
        userName: '',
        serviceId: '',
        templateId: '',
        publicKey: '',
      }
    } catch { return { enabled: false, caregiverEmail: '', userName: '', serviceId: '', templateId: '', publicKey: '' } }
  })

  // Tracking refs
  const aboveThresholdSince = useRef(null)  // timestamp when score first exceeded threshold
  const lastNotificationAt  = useRef(0)     // last notification sent timestamp
  const dismissedAt         = useRef(0)     // when banner was dismissed

  // ── Request browser notification permission on mount ──
  useEffect(() => {
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
      if (Notification.permission === 'default') {
        Notification.requestPermission().then((perm) => {
          setNotifPermission(perm)
        })
      }
    }
  }, [])

  // ── Persist email settings ──
  useEffect(() => {
    localStorage.setItem('cogniflow_email_settings', JSON.stringify(emailSettings))
  }, [emailSettings])

  // ── Send browser notification ──
  const sendBrowserNotification = useCallback(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const sessionMins = fmtDuration(Date.now() - sessionStart)
    try {
      new Notification('⚠️ CogniFlow — High Fatigue Alert', {
        body: `High fatigue detected for 5+ minutes.\nScore: ${Math.round(fatigueScore)}/100\nSession: ${sessionMins}\nPlease take a break!`,
        icon: '🧠',
        tag: 'cogniflow-fatigue-alert',  // prevents duplicate notifs
        requireInteraction: true,
      })
    } catch (err) {
      console.warn('AlertSystem: Browser notification failed', err)
    }
  }, [fatigueScore, sessionStart])

  // ── Send email notification ──
  const sendEmailNotification = useCallback(() => {
    if (!emailSettings.enabled || !emailSettings.caregiverEmail || !emailSettings.publicKey) return
    const sessionDuration = fmtDuration(Date.now() - sessionStart)

    emailjs.send(
      emailSettings.serviceId,
      emailSettings.templateId,
      {
        to_email: emailSettings.caregiverEmail,
        from_name: emailSettings.userName || 'CogniFlow User',
        subject: `${emailSettings.userName || 'Someone'} needs a break - CogniFlow Alert`,
        score: Math.round(fatigueScore),
        session_duration: sessionDuration,
        message: `Fatigue score has been above ${SCORE_THRESHOLD} for 5+ minutes.\nCurrent score: ${Math.round(fatigueScore)}/100\nSession duration: ${sessionDuration}\nPlease check in with them.`,
      },
      emailSettings.publicKey,
    ).then(
      () => console.log('AlertSystem: Email sent successfully'),
      (err) => console.warn('AlertSystem: Email failed', err),
    )
  }, [emailSettings, fatigueScore, sessionStart])

  // ══════════════════════════════════════════════════════════════════════════
  //  MAIN TRACKING LOGIC — runs every render
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    const now = Date.now()

    if (fatigueScore >= SCORE_THRESHOLD) {
      // Start counting if not already
      if (aboveThresholdSince.current === null) {
        aboveThresholdSince.current = now
      }

      const elapsed = now - aboveThresholdSince.current

      if (elapsed >= SUSTAINED_MS) {
        // Activate alert
        if (!alertActive) setAlertActive(true)

        // Send notifications (respect cooldown)
        if (now - lastNotificationAt.current >= NOTIF_COOLDOWN_MS) {
          lastNotificationAt.current = now
          sendBrowserNotification()
          sendEmailNotification()
        }

        // Auto-reappear banner if dismissed long enough ago
        if (bannerDismissed && now - dismissedAt.current >= BANNER_DISMISS_MS) {
          setBannerDismissed(false)
        }
      }
    } else {
      // Score dropped below threshold — reset
      aboveThresholdSince.current = null
      if (alertActive) setAlertActive(false)
      if (bannerDismissed) setBannerDismissed(false)
    }
  }, [fatigueScore, alertActive, bannerDismissed, sendBrowserNotification, sendEmailNotification])

  // ── Dismiss banner ──
  const dismissBanner = useCallback(() => {
    setBannerDismissed(true)
    dismissedAt.current = Date.now()
  }, [])

  // ── Update email settings field ──
  const updateField = useCallback((field, value) => {
    setEmailSettings((prev) => ({ ...prev, [field]: value }))
  }, [])

  // ══════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════════════

  const sustainedMins = aboveThresholdSince.current
    ? Math.floor((Date.now() - aboveThresholdSince.current) / 60_000)
    : 0

  return (
    <>
      {/* ══════ Pulsing red border overlay ══════ */}
      <AnimatePresence>
        {alertActive && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-[60]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
          >
            <motion.div
              className="absolute inset-0 border-[3px] rounded-lg"
              style={{ borderColor: 'rgba(239, 68, 68, 0.5)' }}
              animate={{
                borderColor: [
                  'rgba(239, 68, 68, 0.2)',
                  'rgba(239, 68, 68, 0.6)',
                  'rgba(239, 68, 68, 0.2)',
                ],
                boxShadow: [
                  'inset 0 0 30px rgba(239, 68, 68, 0.0)',
                  'inset 0 0 30px rgba(239, 68, 68, 0.08)',
                  'inset 0 0 30px rgba(239, 68, 68, 0.0)',
                ],
              }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Top banner ══════ */}
      <AnimatePresence>
        {alertActive && !bannerDismissed && (
          <motion.div
            className="fixed top-0 left-0 right-0 z-[70] flex items-center justify-center"
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            <div
              className="w-full flex items-center justify-between px-6 py-3 backdrop-blur-xl border-b"
              style={{
                background: 'linear-gradient(90deg, rgba(239,68,68,0.12), rgba(220,38,38,0.08), rgba(239,68,68,0.12))',
                borderColor: 'rgba(239,68,68,0.2)',
              }}
            >
              {/* Left — warning content */}
              <div className="flex items-center gap-3">
                <motion.span
                  className="text-lg"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ⚠️
                </motion.span>
                <div>
                  <p className="text-sm font-semibold text-red-400">
                    Extended high fatigue detected
                  </p>
                  <p className="text-[11px] text-red-400/60">
                    Score above {SCORE_THRESHOLD} for {sustainedMins > 0 ? `${sustainedMins}+ minutes` : 'over 5 minutes'}
                    {' · '}
                    Session: {fmtDuration(Date.now() - sessionStart)}
                  </p>
                </div>
              </div>

              {/* Right — actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowSettings(true)}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-colors"
                >
                  ⚙ Alerts
                </button>
                <button
                  onClick={dismissBanner}
                  className="text-[10px] px-2.5 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  ✕ Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Alert Settings Modal ══════ */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowSettings(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-md mx-4 rounded-2xl border border-white/[0.08] backdrop-blur-xl overflow-hidden"
              style={{ background: 'rgba(15, 12, 30, 0.95)' }}
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-3">
                <div>
                  <h2 className="text-base font-bold text-white">Alert Settings</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Configure fatigue notifications</p>
                </div>
                <button
                  onClick={() => setShowSettings(false)}
                  className="w-7 h-7 rounded-lg border border-white/10 flex items-center justify-center text-gray-500 hover:text-white hover:border-white/20 transition-colors text-xs"
                >
                  ✕
                </button>
              </div>

              <div className="px-6 pb-6 space-y-5">
                {/* ── Browser Notifications ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-1 h-4 rounded-full bg-cyan-500" />
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Browser Notifications</h3>
                  </div>
                  <div
                    className="rounded-xl border border-white/[0.06] p-4"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white">Desktop alerts</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          Sends a notification when fatigue stays high for 5+ min
                        </p>
                      </div>
                      <div
                        className="px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                        style={{
                          background: notifPermission === 'granted'
                            ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                          color: notifPermission === 'granted' ? '#22c55e' : '#ef4444',
                          border: `1px solid ${notifPermission === 'granted'
                            ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                        }}
                      >
                        {notifPermission === 'granted' ? '✓ Enabled' : notifPermission === 'denied' ? '✕ Blocked' : 'Pending'}
                      </div>
                    </div>
                    {notifPermission === 'default' && (
                      <button
                        onClick={() => Notification.requestPermission().then(setNotifPermission)}
                        className="mt-3 w-full text-xs py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
                      >
                        Enable Browser Notifications
                      </button>
                    )}
                    {notifPermission === 'denied' && (
                      <p className="mt-2 text-[10px] text-gray-500 italic">
                        Notifications are blocked. Please enable them in your browser settings.
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Email Notifications (EmailJS) ── */}
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-1 h-4 rounded-full bg-purple-500" />
                    <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Email Alerts (Caregiver)</h3>
                  </div>
                  <div
                    className="rounded-xl border border-white/[0.06] p-4 space-y-3"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    {/* Toggle */}
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-white">Email a caregiver</p>
                      <button
                        onClick={() => updateField('enabled', !emailSettings.enabled)}
                        className="relative w-10 h-5 rounded-full transition-colors"
                        style={{
                          background: emailSettings.enabled
                            ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)',
                        }}
                      >
                        <motion.div
                          className="absolute top-0.5 w-4 h-4 rounded-full"
                          style={{
                            background: emailSettings.enabled ? '#7c3aed' : '#555',
                          }}
                          animate={{ left: emailSettings.enabled ? 22 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {emailSettings.enabled && (
                        <motion.div
                          className="space-y-2.5"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <InputField
                            label="Your Name"
                            value={emailSettings.userName}
                            onChange={(v) => updateField('userName', v)}
                            placeholder="John Doe"
                          />
                          <InputField
                            label="Caregiver Email"
                            value={emailSettings.caregiverEmail}
                            onChange={(v) => updateField('caregiverEmail', v)}
                            placeholder="caregiver@example.com"
                            type="email"
                          />

                          <div className="pt-1">
                            <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-2 font-semibold">
                              EmailJS Configuration
                            </p>
                            <div className="space-y-2">
                              <InputField
                                label="Service ID"
                                value={emailSettings.serviceId}
                                onChange={(v) => updateField('serviceId', v)}
                                placeholder="service_xxxxxxx"
                                small
                              />
                              <InputField
                                label="Template ID"
                                value={emailSettings.templateId}
                                onChange={(v) => updateField('templateId', v)}
                                placeholder="template_xxxxxxx"
                                small
                              />
                              <InputField
                                label="Public Key"
                                value={emailSettings.publicKey}
                                onChange={(v) => updateField('publicKey', v)}
                                placeholder="your_public_key"
                                small
                              />
                            </div>
                          </div>

                          <p className="text-[9px] text-gray-600 leading-relaxed">
                            Get free EmailJS keys at{' '}
                            <a
                              href="https://www.emailjs.com/"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-400 hover:text-purple-300 underline"
                            >
                              emailjs.com
                            </a>
                            {' '}— 200 emails/month free.
                          </p>

                          {/* Test button */}
                          <button
                            onClick={() => {
                              sendEmailNotification()
                              sendBrowserNotification()
                            }}
                            className="w-full text-xs py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-colors"
                          >
                            📧 Send Test Alert
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ── Threshold info ── */}
                <div className="rounded-xl border border-white/[0.04] p-3" style={{ background: 'rgba(255,255,255,0.015)' }}>
                  <p className="text-[10px] text-gray-600 leading-relaxed">
                    <span className="text-gray-400 font-semibold">How it works:</span> When your fatigue score stays
                    above <span className="text-red-400 font-bold">{SCORE_THRESHOLD}</span> for more than{' '}
                    <span className="text-red-400 font-bold">5 minutes</span>, CogniFlow will send alerts via your
                    enabled channels. Notifications cooldown for 10 minutes to avoid spam.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══════ Small settings trigger (always visible in header area) ══════ */}
      <div className="fixed bottom-4 right-4 z-[55]">
        <motion.button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border backdrop-blur-xl text-[10px] font-medium transition-colors"
          style={{
            background: alertActive ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
            borderColor: alertActive ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)',
            color: alertActive ? '#ef4444' : '#6b7280',
          }}
          whileHover={{ scale: 1.03, borderColor: 'rgba(124,58,237,0.3)' }}
          whileTap={{ scale: 0.97 }}
        >
          {alertActive && (
            <motion.span
              className="w-1.5 h-1.5 rounded-full bg-red-500"
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          )}
          <span>🔔</span>
          <span>Alerts</span>
        </motion.button>
      </div>
    </>
  )
}

// ─── Reusable input field ────────────────────────────────────────────────────

function InputField({ label, value, onChange, placeholder, type = 'text', small = false }) {
  return (
    <div>
      <label className={`block ${small ? 'text-[9px]' : 'text-[10px]'} text-gray-500 mb-1 font-medium`}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full ${small ? 'text-[11px] px-2.5 py-1.5' : 'text-xs px-3 py-2'} rounded-lg bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/30 transition-colors`}
      />
    </div>
  )
}
