import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// ═════════════════════════════════════════════════════════════════════════════
//  AUTH — Login / Signup with dark glassmorphism
// ═════════════════════════════════════════════════════════════════════════════

export default function Auth() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [mode, setMode]         = useState('signin') // 'signin' | 'signup'
  const [success, setSuccess]   = useState(null)

  const handleAuth = async (type) => {
    setError(null)
    setSuccess(null)
    if (!email || !password) {
      setError('Please enter both email and password.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    try {
      let result
      if (type === 'signup') {
        result = await supabase.auth.signUp({ email, password })
      } else {
        result = await supabase.auth.signInWithPassword({ email, password })
      }

      if (result.error) {
        setError(result.error.message)
      } else if (type === 'signup' && result.data?.user && !result.data.session) {
        // Email confirmation required
        setSuccess('Check your email for a confirmation link!')
      }
      // If sign-in succeeds, App.jsx will detect the session change via onAuthStateChange
    } catch (err) {
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-[120px] opacity-[0.08]"
          style={{ background: '#7c3aed' }}
        />
        <div
          className="absolute bottom-1/4 -right-32 w-96 h-96 rounded-full blur-[120px] opacity-[0.06]"
          style={{ background: '#06b6d4' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.04]"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
        />
      </div>

      <motion.div
        className="relative w-full max-w-md mx-4"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, type: 'spring', damping: 20 }}
      >
        {/* Card */}
        <div
          className="rounded-2xl border border-white/[0.08] backdrop-blur-xl p-8 relative overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          {/* Gradient accent top */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.5), rgba(6,182,212,0.5), transparent)' }}
          />

          {/* Logo */}
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-4 border border-white/[0.08]"
              style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))' }}
            >
              <span className="text-2xl">🧠</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-purple-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                CogniFlow
              </span>
            </h1>
            <p className="text-[10px] text-gray-600 tracking-[0.25em] uppercase mt-1">
              Adaptive Interface for Human Minds
            </p>
          </div>

          {/* Tab toggle */}
          <div className="flex rounded-xl bg-white/[0.03] border border-white/[0.06] p-1 mb-6">
            {['signin', 'signup'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(null); setSuccess(null) }}
                className="flex-1 py-2 rounded-lg text-xs font-semibold tracking-wider transition-all relative"
                style={{
                  color: mode === tab ? '#fff' : '#6b7280',
                }}
              >
                {mode === tab && (
                  <motion.div
                    layoutId="auth-tab"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab === 'signin' ? 'Sign In' : 'Sign Up'}</span>
              </button>
            ))}
          </div>

          {/* Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm outline-none focus:border-purple-500/30 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(mode)}
              />
            </div>

            <div>
              <label className="block text-[10px] text-gray-500 mb-1.5 font-medium uppercase tracking-wider">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white placeholder-gray-600 text-sm outline-none focus:border-purple-500/30 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleAuth(mode)}
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-4 py-2.5"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  <p className="text-xs text-red-400">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.div
                  className="rounded-lg border border-green-500/20 bg-green-500/[0.06] px-4 py-2.5"
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                >
                  <p className="text-xs text-green-400">{success}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              onClick={() => handleAuth(mode)}
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-white text-sm cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #7c3aedcc, #06b6d4aa)' }}
              whileHover={!loading ? { scale: 1.01, brightness: 1.1 } : {}}
              whileTap={!loading ? { scale: 0.98 } : {}}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                  <span>{mode === 'signin' ? 'Signing in...' : 'Creating account...'}</span>
                </div>
              ) : (
                mode === 'signin' ? 'Sign In' : 'Create Account'
              )}
            </motion.button>
          </div>

          {/* Footer note */}
          <p className="text-center text-[10px] text-gray-600 mt-6 leading-relaxed">
            {mode === 'signin' ? (
              <>Don't have an account?{' '}
                <button onClick={() => setMode('signup')} className="text-purple-400 hover:text-purple-300 underline cursor-pointer">Sign up</button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => setMode('signin')} className="text-purple-400 hover:text-purple-300 underline cursor-pointer">Sign in</button>
              </>
            )}
          </p>
        </div>

        {/* Bottom text */}
        <p className="text-center text-[9px] text-gray-700 mt-4">
          Your data is encrypted and securely stored via Supabase.
        </p>
      </motion.div>
    </div>
  )
}
