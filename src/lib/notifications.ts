// Shared types and helpers for in-app (and later push) notifications

export type NotificationCategory = 'products' | 'quotes' | 'social'
export type NotificationKind = 'manual' | 'price' | 'product' | 'quote_followup' | 'nudge'
export type NotificationLinkType = 'calc' | 'system' | 'quotes' | 'quote' | 'url'

export interface AppNotification {
  id: string
  title: string
  body: string
  category: NotificationCategory
  kind: NotificationKind
  link_type: NotificationLinkType
  link_target: string | null
}

// One delivered message as the installer sees it in the bell
export interface InboxItem {
  notification_id: string
  delivered_at: string
  read_at: string | null
  opened_at: string | null
  notification: AppNotification | null
}

export interface NotifyPrefs {
  push: boolean
  products: boolean
  quotes: boolean
  social: boolean
}

export const DEFAULT_NOTIFY_PREFS: NotifyPrefs = { push: true, products: true, quotes: true, social: true }

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  products: 'Prices & products',
  quotes: 'Quote reminder',
  social: 'News & social',
}

// Where tapping a notification goes: an in-app path, or an external https link
export function notificationTarget(n: Pick<AppNotification, 'link_type' | 'link_target'>): { path?: string; url?: string } {
  switch (n.link_type) {
    case 'system':
      return { path: n.link_target ? `/?system=${encodeURIComponent(n.link_target)}` : '/' }
    case 'quotes':
      return { path: '/quotes' }
    case 'quote':
      return { path: n.link_target ? `/quotes/${encodeURIComponent(n.link_target)}` : '/quotes' }
    case 'url':
      return n.link_target && /^https:\/\//i.test(n.link_target) ? { url: n.link_target } : { path: '/' }
    default:
      return { path: '/' }
  }
}

// Short call-to-action label for each kind of link
export function notificationCta(n: Pick<AppNotification, 'link_type' | 'link_target'>): string {
  switch (n.link_type) {
    case 'system': return 'See it in the calculator'
    case 'quotes': return 'Open your quotes'
    case 'quote': return 'Open the quote'
    case 'url': return /instagram\.com/i.test(n.link_target || '') ? 'Open Instagram' : 'Open the link'
    default: return 'Open the calculator'
  }
}

// "2h ago", "Yesterday", "Mon 13 Oct"
export function relativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso)
  const mins = Math.round((now.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24 && d.getDate() === now.getDate()) return `${hours}h ago`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}
