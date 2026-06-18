import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetSent, setResetSent] = useState(false)
  const [showReset, setShowReset] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Route through useAuth.signIn so the successful login gets recorded in login_logs
    const { error } = await signIn(email, password)

    if (error) {
      setError(error)
      await supabase.from('login_logs').insert({
        email,
        success: false,
        failure_reason: error,
      })
    }
    setLoading(false)
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) {
      setError(error.message)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  const inputClass =
    'w-full pl-11 pr-4 min-h-[48px] rounded-xl border border-line bg-bone text-base text-ink placeholder:text-ash focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent transition'

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-limestone px-4 py-10 overflow-hidden">
      {/* Soft brand glow for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full bg-molten/10 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <div className="bg-bone rounded-2xl border border-line shadow-xl shadow-basalt/5 overflow-hidden">
          {/* Brand accent bar */}
          <div className="h-1.5 bg-gradient-to-r from-molten to-molten-ink" />

          <div className="p-8 sm:p-10">
            {/* Logo */}
            <div className="text-center mb-8">
              <img
                src="/magma-logo.jpg"
                alt="Magma Coatings"
                className="h-11 w-auto mx-auto"
              />
              <p className="text-stone text-xs font-medium uppercase tracking-[0.2em] mt-4">
                Material Calculator
              </p>
            </div>

            {showReset ? (
              resetSent ? (
                <div className="text-center">
                  <div className="w-12 h-12 bg-sage-tint rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-sage" />
                  </div>
                  <h2 className="text-lg font-medium text-basalt mb-2">Check your email</h2>
                  <p className="text-stone text-sm mb-5">
                    We've sent a password reset link to {email}
                  </p>
                  <Button variant="outline" className="min-h-[48px]" onClick={() => { setShowReset(false); setResetSent(false) }}>
                    Back to login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div>
                    <h2 className="text-lg font-medium text-basalt">Reset password</h2>
                    <p className="text-stone text-sm mt-1">Enter your email and we'll send you a reset link.</p>
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ash" />
                    <input
                      type="email"
                      placeholder="Email address"
                      className={inputClass}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  {error && <p className="text-sm text-danger bg-danger-tint p-3 rounded-lg">{error}</p>}

                  <Button type="submit" className="w-full min-h-[48px] text-base" disabled={loading}>
                    {loading ? 'Sending...' : 'Send reset link'}
                  </Button>

                  <button type="button" className="w-full text-sm text-stone hover:text-ink transition" onClick={() => setShowReset(false)}>
                    Back to login
                  </button>
                </form>
              )
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ash" />
                  <input
                    type="email"
                    placeholder="Email address"
                    className={inputClass}
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ash" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    className={inputClass + ' pr-12'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-ink transition min-h-[44px] min-w-[44px] flex items-center justify-center"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {error && <p className="text-sm text-danger bg-danger-tint p-3 rounded-lg">{error}</p>}

                <Button type="submit" className="w-full min-h-[48px] text-base" disabled={loading}>
                  {loading ? 'Signing in...' : 'Sign in'}
                </Button>

                <button type="button" className="w-full text-sm text-stone hover:text-ink transition" onClick={() => setShowReset(true)}>
                  Forgot password?
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-ash mt-6">© Magma Coatings Ltd · Material Calculator</p>
      </div>
    </div>
  )
}
