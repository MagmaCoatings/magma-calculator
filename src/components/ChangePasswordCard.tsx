// Profile: change your own password (checks the current one first)
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { KeyRound, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const inputCls = 'w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent'

function strengthError(pwd: string): string | null {
  if (pwd.length < 8) return 'Your new password must be at least 8 characters'
  if (!/[A-Z]/.test(pwd)) return 'Your new password needs an uppercase letter'
  if (!/[a-z]/.test(pwd)) return 'Your new password needs a lowercase letter'
  if (!/[0-9]/.test(pwd)) return 'Your new password needs a number'
  return null
}

export function ChangePasswordCard() {
  const { user } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    if (!user?.email) { setError('Please sign in again and retry.'); return }
    if (!current) { setError('Enter your current password'); return }
    const weak = strengthError(next)
    if (weak) { setError(weak); return }
    if (next !== confirm) { setError('The new passwords do not match'); return }
    if (next === current) { setError('Your new password must be different from your current one'); return }

    setBusy(true)
    try {
      // Check the current password on a separate, throwaway client so this session is untouched
      const check = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'magma-password-check' },
      })
      const { error: checkErr } = await check.auth.signInWithPassword({ email: user.email, password: current })
      if (checkErr) { setError('Your current password is not correct'); return }

      const { error: updErr } = await supabase.auth.updateUser({ password: next })
      if (updErr) { setError(updErr.message); return }
      setCurrent(''); setNext(''); setConfirm('')
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="w-5 h-5 text-ash" />
        <h2 className="font-medium text-basalt">Password</h2>
      </div>
      <p className="text-xs text-stone mb-4">At least 8 characters, with an uppercase letter, a lowercase letter and a number.</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="pw-current" className="block text-sm font-medium text-ink mb-1">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" className={inputCls} value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pw-new" className="block text-sm font-medium text-ink mb-1">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password" className={inputCls} value={next} onChange={e => setNext(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pw-confirm" className="block text-sm font-medium text-ink mb-1">Confirm new password</label>
            <input id="pw-confirm" type="password" autoComplete="new-password" className={inputCls} value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        {done && <p className="text-sm text-sage flex items-center gap-1.5" role="status"><Check className="w-4 h-4" /> Password changed. Use your new password next time you log in.</p>}
        <div className="flex justify-end">
          <Button type="submit" variant="outline" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</Button>
        </div>
      </form>
    </Card>
  )
}
