import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { loadMediaAccess, type MediaAccess } from '@/lib/media'

/** Whether the Media tab is shown to this person (admins always; installers once launched) */
export function useMediaAccess(): { access: MediaAccess; loading: boolean; refresh: () => Promise<void> } {
  const { user, profile } = useAuth()
  // Re-check when the person, their role or their status changes
  const key = user ? `${user.id}:${profile?.role || ''}:${profile?.status || ''}` : 'anon'
  const [access, setAccess] = useState<MediaAccess>({ visible: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    if (!user) { setAccess({ visible: false }); setLoading(false); return }
    loadMediaAccess(key).then(a => { if (live) { setAccess(a); setLoading(false) } })
    return () => { live = false }
  }, [key, user])

  const refresh = useCallback(async () => {
    const a = await loadMediaAccess(key, true)
    setAccess(a)
  }, [key])

  return { access, loading, refresh }
}
