import { Link } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useOpenNotification } from '@/components/notifications/NotificationBell'
import { CATEGORY_LABELS, notificationCta, relativeTime } from '@/lib/notifications'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import { PushPrompt } from '@/components/notifications/PushPrompt'

export function NotificationsPage() {
  const { items, unreadCount, loading, markAllRead } = useNotifications()
  const open = useOpenNotification()

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-28 lg:pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-medium text-basalt">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-sm font-medium text-molten-ink min-h-[44px] px-2">
            Mark all read
          </button>
        )}
      </div>

      <PushPrompt className="mb-4" />

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>
      ) : items.length === 0 ? (
        <div className="bg-bone border border-line rounded-xl p-8 text-center">
          <Bell className="w-8 h-8 text-ash mx-auto mb-3" />
          <p className="font-medium text-basalt">No notifications yet</p>
          <p className="text-sm text-stone mt-1">Price changes, new products and reminders will appear here.</p>
        </div>
      ) : (
        <ul className="bg-bone border border-line rounded-xl overflow-hidden divide-y divide-line-soft">
          {items.map(item => {
            const n = item.notification!
            const unread = !item.read_at
            return (
              <li key={item.notification_id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className={`w-full text-left flex gap-3 px-4 py-4 hover:bg-limestone ${unread ? 'bg-bone' : 'bg-transparent'}`}
                >
                  <span aria-hidden="true" className={`w-2 h-2 rounded-full mt-2 shrink-0 ${unread ? 'bg-molten' : 'bg-transparent'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold tracking-wide text-stone uppercase">
                      {CATEGORY_LABELS[n.category]} · {relativeTime(item.delivered_at)}
                      {unread && <span className="sr-only"> (unread)</span>}
                    </span>
                    <span className={`block text-sm mt-0.5 text-basalt ${unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</span>
                    <span className="block text-sm text-ink mt-0.5">{n.body}</span>
                    <span className="block text-sm font-medium text-molten-ink mt-1">{notificationCta(n)} ›</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-stone text-center mt-6">
        Choose what you receive on your <Link to="/profile" className="underline">Profile</Link> page.
      </p>
    </div>
  )
}
