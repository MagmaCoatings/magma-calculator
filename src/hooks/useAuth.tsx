import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, getClientLocation, getDeviceType, getBrowser, getOS } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  session: Session | null
  loading: boolean
  profileLoading: boolean
  authError: string | null
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error?: string }>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return null
    }

    return data
  }

  async function logLogin(userId: string, email?: string | null) {
    // Prevent duplicate logs across tabs - check localStorage
    const lockKey = `login_lock_${userId}`
    const lastLogin = localStorage.getItem(lockKey)
    const now = Date.now()
    
    // If logged within last 10 seconds, skip
    if (lastLogin && (now - parseInt(lastLogin)) < 10000) {
      return
    }
    
    // Set lock immediately
    localStorage.setItem(lockKey, now.toString())

    try {
      // Single Edge Function call for IP + geo (server-side)
      const location = await getClientLocation()

      const { error } = await supabase.from('login_logs').insert({
        user_id: userId,
        email: email || null,
        success: true,
        ip_address: location?.ip || null,
        city: location?.city || null,
        region: location?.region || null,
        country: location?.country || null,
        user_agent: navigator.userAgent,
        device_type: getDeviceType(),
        browser: getBrowser(),
        os: getOS(),
        is_suspicious: false,
      })
      // Supabase inserts return an error object (they don't throw on RLS/DB
      // rejections), so check it explicitly — otherwise failures pass silently.
      if (error) {
        console.error('Login log insert failed:', error)
        localStorage.removeItem(lockKey) // clear lock so a retry can re-log
      }
    } catch (error) {
      console.error('Error logging login:', error)
      // Clear lock on error so retry works
      localStorage.removeItem(lockKey)
    }
  }

  useEffect(() => {
    // Timeout fallback - don't leave users stuck on spinner
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth loading timed out after 10s')
        setLoading(false)
        setAuthError('Loading timed out. Please refresh the page.')
      }
    }, 10000)

    // Get initial session. Render as soon as we know the session — don't block
    // the whole app on the profile fetch (that network call on a cold first
    // load is what made the app sit on a spinner until a manual refresh).
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
      clearTimeout(timeout)
      if (session?.user) {
        setProfileLoading(true)
        fetchProfile(session.user.id).then(p => {
          setProfile(p)
          setProfileLoading(false)
        })
      } else {
        setProfile(null)
      }
    }).catch(err => {
      console.error('Auth error:', err)
      setLoading(false)
      setAuthError('Failed to load session. Please refresh.')
      clearTimeout(timeout)
    })

    // Listen for auth changes - NO login logging here
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)

        if (session?.user) {
          setProfileLoading(true)
          fetchProfile(session.user.id).then(p => {
            setProfile(p)
            setProfileLoading(false)
          })
        } else {
          setProfile(null)
          setProfileLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Tell the index.html watchdog the app rendered past the loading spinner.
  // (If this never fires, the watchdog self-heals a stale/broken cache.)
  useEffect(() => {
    if (!loading) {
      ;(window as Window & { __magmaReady?: boolean }).__magmaReady = true
    }
  }, [loading])

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return { error: error.message }
    }

    // Log login ONLY here - this only runs once per actual sign-in
    if (data.user) {
      await logLogin(data.user.id, data.user.email)
    }

    return {}
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setSession(null)
  }

  const resetPassword = async (email: string) => {
    // Race against a timeout so callers never await forever if email is slow/down.
    const result = await Promise.race([
      supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      }),
      new Promise<{ error: { message: string } }>(resolve =>
        setTimeout(
          () =>
            resolve({
              error: {
                message:
                  "We couldn't send the reset email just now. Please try again in a moment.",
              },
            }),
          20000
        )
      ),
    ])

    const error = (result as { error: { message: string } | null }).error
    if (error) {
      return { error: error.message }
    }

    return {}
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        profileLoading,
        authError,
        signIn,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
