// Phone alerts (Web Push): support checks, subscribing and unsubscribing this device
import { supabase } from '@/lib/supabase'

// Public half of the key pair; the private half lives only in Supabase (Edge Function secret)
export const VAPID_PUBLIC_KEY = 'BGtMOZikkptwrd7sO5PnDiwzq-DSFzZEgW-35uy3oRwcYu5H6SDJ9tcgvZ2yyAofNbOMW9QaJFyE33a6oGs5E0k'

export type PushState =
  | 'unsupported'    // this browser can't do web push
  | 'needs-install'  // iPhone/iPad in Safari: add to home screen first
  | 'denied'         // the person blocked notifications for this site
  | 'off'            // allowed or not yet asked, but this device isn't subscribed
  | 'on'             // this device is subscribed

export function isIos(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function getPushState(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await currentSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

/** Ask permission (must be called from a tap) and register this device. Returns the new state. */
export async function enablePush(): Promise<PushState> {
  if (isIos() && !isStandalone()) return 'needs-install'
  if (!pushSupported()) return 'unsupported'
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off'

  // ready never settles if no worker is registered (dev mode, or after a reset): give up after 10s
  const reg = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Service worker not ready')), 10000)),
  ])
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
  }
  await saveSubscription(sub)
  return 'on'
}

async function saveSubscription(sub: PushSubscription) {
  const json = sub.toJSON()
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_user_agent: navigator.userAgent.slice(0, 300),
  })
  if (error) throw new Error(error.message)
}

/**
 * On app load: if this device already has alerts on, re-register it for whoever is signed in.
 * Repairs a device whose record was removed, moved to another account, or rotated by the browser.
 */
export async function resyncPush(): Promise<void> {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const sub = await currentSubscription()
  if (sub) await saveSubscription(sub)
}

/** Before signing out: stop this device receiving the departing user's alerts */
export async function releasePushOnSignOut(): Promise<void> {
  const sub = await currentSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe().catch(() => undefined)
}

/** Stop alerts on this device */
export async function disablePush(): Promise<PushState> {
  const sub = await currentSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe().catch(() => undefined)
  }
  return getPushState()
}
