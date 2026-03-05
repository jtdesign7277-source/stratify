import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabaseClient'

// ── Animated line chart canvas for left panel ──────────────────
function QuantChart() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let frame
    let offset = 0

    const W = canvas.width = canvas.offsetWidth
    const H = canvas.height = canvas.offsetHeight

    // Generate smooth price-like data
    const makeData = (seed, len = 300) => {
      let v = seed
      return Array.from({ length: len }, () => {
        v += (Math.random() - 0.49) * 8
        v = Math.max(60, Math.min(H - 60, v))
        return v
      })
    }

    const lines = [
      { data: makeData(H * 0.45), color: '#10b981', alpha: 0.7, width: 1.5 },
      { data: makeData(H * 0.55), color: '#06b6d4', alpha: 0.4, width: 1 },
      { data: makeData(H * 0.35), color: '#10b981', alpha: 0.2, width: 0.8 },
      { data: makeData(H * 0.65), color: '#818cf8', alpha: 0.25, width: 1 },
    ]

    const draw = () => {
      ctx.clearRect(0, 0, W, H)

      // Subtle grid
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let y = 0; y < H; y += 60) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
      for (let x = 0; x < W; x += 80) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }

      lines.forEach(({ data, color, alpha, width }) => {
        const visible = 120
        const startIdx = Math.floor(offset) % data.length

        ctx.beginPath()
        ctx.strokeStyle = color
        ctx.globalAlpha = alpha
        ctx.lineWidth = width
        ctx.shadowColor = color
        ctx.shadowBlur = 8

        for (let i = 0; i < visible; i++) {
          const idx = (startIdx + i) % data.length
          const x = (i / visible) * W
          const y = data[idx]
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()

        // Glow fill under the line
        const gradIdx = (startIdx) % data.length
        ctx.beginPath()
        for (let i = 0; i < visible; i++) {
          const idx = (startIdx + i) % data.length
          const x = (i / visible) * W
          const y = data[idx]
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath()
        const grad = ctx.createLinearGradient(0, 0, 0, H)
        grad.addColorStop(0, color + '22')
        grad.addColorStop(1, 'transparent')
        ctx.fillStyle = grad
        ctx.globalAlpha = alpha * 0.4
        ctx.fill()
      })

      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      offset += 0.4
      frame = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// ── Floating stat pills ─────────────────────────────────────────
const PILLS = [
  { label: '$NVDA', val: '+4.2%', top: '18%', left: '8%', delay: 0 },
  { label: '$SPY',  val: '+1.1%', top: '35%', left: '62%', delay: 0.8 },
  { label: '$BTC',  val: '+7.3%', top: '58%', left: '15%', delay: 1.4 },
  { label: '$TSLA', val: '+3.8%', top: '72%', left: '55%', delay: 0.4 },
  { label: '$AAPL', val: '+2.6%', top: '82%', left: '28%', delay: 1.8 },
]

function FloatingPills() {
  return (
    <>
      {PILLS.map((p) => (
        <motion.div
          key={p.label}
          className="absolute font-mono text-xs text-emerald-400 pointer-events-none"
          style={{ top: p.top, left: p.left }}
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.6, 0.3, 0.6] }}
          transition={{ delay: p.delay, duration: 4, repeat: Infinity, repeatType: 'mirror' }}
        >
          {p.label} <span className="text-emerald-300">{p.val}</span>
        </motion.div>
      ))}
    </>
  )
}

// ── Main Component ──────────────────────────────────────────────
export default function SignUpPage({ onSuccess, onBackToLanding }) {
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        if (onSuccess) onSuccess()
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email)
        if (error) throw error
        setMessage('Password reset email sent.')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) setError(error.message)
  }

  const titles = {
    login: 'Welcome back',
    signup: 'Create your account',
    forgot: 'Reset your password',
  }
  const subtitles = {
    login: 'AI-powered trading. Built for the edge.',
    signup: 'Join thousands of smarter traders.',
    forgot: "We'll send a reset link to your email.",
  }

  return (
    <div className="min-h-screen flex bg-[#0a0a0f] overflow-hidden">

      {/* ── LEFT PANEL ─────────────────────────────────────────── */}
      <div className="hidden lg:flex relative w-[58%] flex-col overflow-hidden">
        {/* Deep space background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0f] via-[#060d18] to-[#0a0a0f]" />

        {/* Radial glow */}
        <div className="absolute inset-0"
          style={{ background: 'radial-gradient(ellipse 80% 60% at 40% 50%, rgba(16,185,129,0.06) 0%, transparent 70%)' }}
        />

        {/* Animated chart */}
        <QuantChart />

        {/* Floating stat pills */}
        <FloatingPills />

        {/* Bottom branding */}
        <div className="relative z-10 mt-auto p-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 25 }}
          >
            <div className="text-white text-2xl font-bold tracking-tight mb-2">Stratify</div>
            <div className="text-gray-500 text-sm">AI-powered trading. Built for the edge.</div>
          </motion.div>
        </div>
      </div>

      {/* ── RIGHT PANEL ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col justify-center px-8 md:px-16 py-12 relative bg-[#060d18]">

        {/* Subtle glow behind form */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(16,185,129,0.04) 0%, transparent 70%)' }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden mb-10 text-white text-xl font-bold">Stratify</div>

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative z-10 w-full max-w-sm mx-auto"
        >
          {/* Title */}
          <div className="mb-8">
            <h1 className="text-white text-2xl font-semibold tracking-tight mb-1">
              {titles[mode]}
            </h1>
            <p className="text-gray-500 text-sm">{subtitles[mode]}</p>
          </div>

          {/* Google button — not on forgot */}
          {mode !== 'forgot' && (
            <motion.button
              onClick={handleGoogle}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-medium rounded-xl px-4 py-3 text-sm transition-colors mb-5 shadow-[0_2px_12px_rgba(0,0,0,0.3)]"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </motion.button>
          )}

          {/* Divider */}
          {mode !== 'forgot' && (
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-gray-600 text-xs uppercase tracking-widest">or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-emerald-500/40 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.08)] transition-all"
              style={{ boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.4)' }}
            />

            {mode !== 'forgot' && (
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/[0.06] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 outline-none focus:border-emerald-500/40 focus:shadow-[0_0_0_3px_rgba(16,185,129,0.08)] transition-all"
                style={{ boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.4)' }}
              />
            )}

            {/* Forgot password link */}
            {mode === 'login' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode('forgot')}
                  className="text-gray-500 text-xs hover:text-gray-400 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Error / Success */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs"
                >
                  {error}
                </motion.p>
              )}
              {message && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-emerald-400 text-xs"
                >
                  {message}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.01 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 text-black font-semibold rounded-xl py-3 text-sm transition-colors shadow-[0_4px_20px_rgba(16,185,129,0.3)]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Processing...
                </span>
              ) : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </motion.button>
          </form>

          {/* Toggle mode */}
          <div className="mt-6 text-center text-sm text-gray-500">
            {mode === 'login' && (
              <>Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setMessage('') }}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Sign up
                </button>
              </>
            )}
            {mode === 'signup' && (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); setMessage('') }}
                  className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Sign in
                </button>
              </>
            )}
            {mode === 'forgot' && (
              <button onClick={() => { setMode('login'); setError(''); setMessage('') }}
                className="text-emerald-400 hover:text-emerald-300 transition-colors">
                ← Back to sign in
              </button>
            )}
          </div>

          {/* Back to landing */}
          {onBackToLanding && (
            <div className="mt-4 text-center">
              <button onClick={onBackToLanding}
                className="text-gray-600 text-xs hover:text-gray-500 transition-colors">
                ← Back to home
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
