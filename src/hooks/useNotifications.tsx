import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { resyncPush } from '@/lib/push'
import { useAuth } from '@/hooks/useAuth'
import type { InboxItem } from '@/lib/notifications'

interface NotificationsContextType {
  items: InboxItem[]
  unreadCount: number
  loading: boolean
  /** The newest message that arrived while the app was open, for the slide-in banner */
  incoming: InboxItem | null
  dismissIncoming: () => void
  refresh: () => Promise<void>
  markRead: (notificationId: string) => Promise<void>
  markOpened: (notificationId: string) => Promise<void>
  markAllRead: () => Promise<void>
}

const NotificationsContext = createContext<NotificationsContextType | null>(null)

const SELECT = 'notification_id, delivered_at, read_at, opened_at, notification:notifications(id, title, body, category, kind, link_type, link_target)'

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(false)
  const [incoming, setIncoming] = useState<InboxItem | null>(null)
  const knownIds = useRef<Set<string>>(new Set())
  const loadedOnce = useRef(false)

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notification_recipients')
      .select(SELECT)
      .eq('user_id', user.id)
      .order('delivered_at', { ascending: false })
      .limit(50)
    setLoading(false)
    if (error) {
      // Table not there yet (SQL not run) or offline: keep the bell quiet rather than erroring
      console.warn('Notifications unavailable:', error.message)
      return
    }
    const list = ((data || []) as unknown as InboxItem[]).filter(i => i.notification)
    // After the first load, a new unread item means something just arrived: show the banner
    if (loadedOnce.current) {
      const fresh = list.find(i => !knownIds.current.has(i.notification_id) && !i.read_at)
      if (fresh) setIncoming(fresh)
    }
    knownIds.current = new Set(list.map(i => i.notification_id))
    loadedOnce.current = true
    setItems(list)
  }, [user])

  // Load on sign-in, clear on sign-out
  useEffect(() => {
    knownIds.current = new Set()
    loadedOnce.current = false
    setItems([])
    setIncoming(null)
    if (user) refresh()
  }, [user, refresh])

  // Live updates: a new delivery for this user refreshes the bell straight away
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_recipients', filter: `user_id=eq.${user.id}` },
        () => { refresh() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, refresh])

  // Backstop for when live updates aren't available: refresh on focus and every few minutes
  useEffect(() => {
    if (!user) return
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    const timer = window.setInterval(refresh, 3 * 60 * 1000)
    return () => { window.removeEventListener('focus', onFocus); window.clearInterval(timer) }
  }, [user, refresh])

  const markRead = useCallback(async (notificationId: string) => {
    if (!user) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.notification_id === notificationId && !i.read_at ? { ...i, read_at: now } : i))
    await supabase.from('notification_recipients').update({ read_at: now })
      .eq('notification_id', notificationId).eq('user_id', user.id).is('read_at', null)
  }, [user])

  const markOpened = useCallback(async (notificationId: string) => {
    if (!user) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.notification_id === notificationId
      ? { ...i, read_at: i.read_at || now, opened_at: i.opened_at || now } : i))
    await supabase.from('notification_recipients').update({ opened_at: now })
      .eq('notification_id', notificationId).eq('user_id', user.id).is('opened_at', null)
    await supabase.from('notification_recipients').update({ read_at: now })
      .eq('notification_id', notificationId).eq('user_id', user.id).is('read_at', null)
  }, [user])

  // Opened from a phone alert: the link carries ?n=<id>. Record the open, then tidy the address bar.
  useEffect(() => {
    if (!user) return
    const params = new URLSearchParams(window.location.search)
    const id = params.get('n')
    if (!id) return
    params.delete('n')
    window.history.replaceState(window.history.state, '', window.location.pathname + (params.toString() ? `?${params}` : '') + window.location.hash)
    if (/^[0-9a-f-]{36}$/i.test(id)) markOpened(id).then(refresh)
  }, [user, markOpened, refresh])

  // Keep this device's phone alerts linked to whoever is signed in
  useEffect(() => {
    if (user) resyncPush().catch(() => undefined)
  }, [user])

  // Phone alert tapped while Magma is already open: the service worker hands over the link
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; url?: string } | null
      if (!msg || msg.type !== 'magma-open' || typeof msg.url !== 'string' || !msg.url.startsWith('/')) return
      const target = new URL(msg.url, window.location.origin)
      const id = target.searchParams.get('n')
      target.searchParams.delete('n')
      if (id && /^[0-9a-f-]{36}$/i.test(id)) markOpened(id).then(refresh)
      navigate(target.pathname + target.search)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [user, markOpened, refresh, navigate])

  const markAllRead = useCallback(async () => {
    if (!user) return
    const now = new Date().toISOString()
    setItems(prev => prev.map(i => i.read_at ? i : { ...i, read_at: now }))
    await supabase.from('notification_recipients').update({ read_at: now })
      .eq('user_id', user.id).is('read_at', null)
  }, [user])

  const unreadCount = items.filter(i => !i.read_at).length

  return (
    <NotificationsContext.Provider value={{
      items, unreadCount, loading, incoming,
      dismissIncoming: () => setIncoming(null),
      refresh, markRead, markOpened, markAllRead,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider')
  return ctx
}
