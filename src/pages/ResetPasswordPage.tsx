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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
      </div>
    )
  }

  // Invalid/expired session
  if (sessionValid === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Link Expired</h1>
          <p className="text-gray-600 mb-6">
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Updated</h1>
          <p className="text-gray-600 mb-6">
            Your password has been successfully reset. Redirecting to login...
          </p>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto"></div>
        </div>
      </div>
    )
  }

  // Password reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Your Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 pr-12"
                placeholder="Enter new password"
                required
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Minimum 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
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

        <p className="mt-6 text-center text-sm text-gray-600">
          Remember your password?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-orange-600 hover:text-orange-700 font-medium"
          >
            Back to login
          </button>
        </p>
      </div>
    </div>
  )
}
