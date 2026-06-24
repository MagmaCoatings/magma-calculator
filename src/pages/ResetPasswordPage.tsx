import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, Lock, CheckCircle, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [sessionValid, setSessionValid] = useState<boolean | null>(null)

  // Check if user arrived with a valid recovery session
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      // Check URL for recovery token (Supabase adds this)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const type = hashParams.get('type')
      
      if (session || type === 'recovery') {
        setSessionValid(true)
      } else {
        setSessionValid(false)
      }
    }
    checkSession()
  }, [])

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return 'Password must be at least 8 characters'
    if (!/[A-Z]/.test(pwd)) return 'Password must contain an uppercase letter'
    if (!/[a-z]/.test(pwd)) return 'Password must contain a lowercase letter'
    if (!/[0-9]/.test(pwd)) return 'Password must contain a number'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    const validationError = validatePassword(password)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(true)
      
      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login')
      }, 3000)
    } catch (err) {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state while checking session
  if (sessionValid === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-limestone">
        <div className="h-8 w-8 rounded-full border-4 border-molten border-t-transparent animate-spin"></div>
      </div>
    )
  }

  // Invalid/expired session
  if (sessionValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-limestone px-4">
        <div className="max-w-md w-full bg-bone rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-danger-tint rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-danger" />
          </div>
          <h1 className="text-2xl font-bold text-basalt mb-2">Link Expired</h1>
          <p className="text-ink mb-6">
            This password reset link has expired or is invalid. Please request a new one.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">
            Back to Login
          </Button>
        </div>
      </div>
    )
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-limestone px-4">
        <div className="max-w-md w-full bg-bone rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-sage-tint rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-sage" />
          </div>
          <h1 className="text-2xl font-bold text-basalt mb-2">Password Updated</h1>
          <p className="text-ink mb-6">
            Your password has been successfully reset. Redirecting to login...
          </p>
          <div className="h-6 w-6 rounded-full border-2 border-molten border-t-transparent animate-spin mx-auto"></div>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-limestone px-4">
      <div className="max-w-md w-full bg-bone rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-molten-tint rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-molten-ink" />
          </div>
          <h1 className="text-2xl font-bold text-basalt">Reset Your Password</h1>
          <p className="text-ink mt-2">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-danger-tint border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-stone rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-molten pr-12"
                placeholder="Enter new password"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone hover:text-ink"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-stone">
              Minimum 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-ink mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-stone rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-molten"
              placeholder="Confirm new password"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full py-3"
          >
            {loading ? 'Updating...' : 'Reset Password'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-ink">
          Remember your password?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-molten-ink hover:text-molten-ink font-medium"
          >
            Back to login
          </button>
        </p>
      </div>
    </div>
  )
}
