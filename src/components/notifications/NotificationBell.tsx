import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { notificationTarget, CATEGORY_LABELS, type InboxItem } from '@/lib/notifications'

/** Opens a notification: records the tap, then goes to its page or link */
export function useOpenNotification() {
  const navigate = useNavigate()
  const { markOpened } = useNotifications()
  return (item: InboxItem) => {
    if (!item.notification) return
    markOpened(item.notification_id)
    const target = notificationTarget(item.notification)
    if (target.url) window.open(target.url, '_blank', 'noopener,noreferrer')
    else if (target.path) navigate(target.path)
  }
}

/** Bell icon with an unread count, linking to the notifications page */
export function NotificationBell({ className = '' }: { className?: string }) {
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const active = location.pathname === '/notifications'
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
  return (
    <Link
      to="/notifications"
      aria-label={label}
      title="Notifications"
      className={`relative inline-flex items-center justify-center w-11 h-11 rounded-[var(--radius-control)] hover:bg-line-soft ${active ? 'bg-molten-tint' : ''} ${className}`}
    >
      <Bell className={`w-5 h-5 ${active ? 'text-molten' : 'text-ink'}`} />
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[11px] font-semibold leading-[18px] text-center">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  )
}

/** Small banner that slides in when a message arrives while the app is open */
export function IncomingNotification() {
  const { incoming, dismissIncoming } = useNotifications()
  const open = useOpenNotification()
  const location = useLocation()
  if (!incoming?.notification || location.pathname === '/notifications') return null
  const n = incoming.notification
  return (
    <div className="fixed z-[80] top-[4.5rem] left-4 right-4 lg:left-auto lg:right-6 lg:w-96" role="status">
      <div className="bg-basalt text-bone rounded-xl shadow-lg p-4 flex items-start gap-3">
        <button
          type="button"
          onClick={() => { open(incoming); dismissIncoming() }}
          className="flex-1 text-left min-w-0"
        >
          <span className="block text-[11px] font-semibold tracking-wide text-bone/70 uppercase">{CATEGORY_LABELS[n.category]}</span>
          <span className="block text-sm font-medium mt-0.5">{n.title}</span>
          <span className="text-xs text-bone/80 mt-0.5 line-clamp-2 [overflow-wrap:anywhere]">{n.body}</span>
        </button>
        <button type="button" onClick={dismissIncoming} aria-label="Dismiss" className="p-1 text-bone/70 hover:text-bone">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
