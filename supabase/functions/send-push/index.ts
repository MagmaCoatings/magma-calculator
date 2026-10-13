// Supabase Edge Function: send-push
// Sends phone alerts (Web Push) for one notification. Called only by the database
// (public.request_push via pg_net) with the shared x-push-secret header, so deploy
// with "Verify JWT" turned OFF.
//
// Secrets needed (Edge Functions > Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_HOOK_SECRET
//   (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically)

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

// Split long id lists so query URLs stay short
function chunks<T>(arr: T[], size = 100): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

// Compare secrets without leaking timing
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// Same rules as the app's notificationTarget(): where a tap should land
function targetUrl(linkType: string, linkTarget: string | null, id: string): string {
  let path = '/'
  switch (linkType) {
    case 'system': path = linkTarget ? `/?system=${encodeURIComponent(linkTarget)}` : '/'; break
    case 'quotes': path = '/quotes'; break
    case 'quote': path = linkTarget ? `/quotes/${encodeURIComponent(linkTarget)}` : '/quotes'; break
    case 'url':
      if (linkTarget && /^https:\/\//i.test(linkTarget)) return linkTarget
      break
  }
  // n=<id> lets the app record that the alert was opened
  return path + (path.includes('?') ? '&' : '?') + 'n=' + encodeURIComponent(id)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  const hookSecret = Deno.env.get('PUSH_HOOK_SECRET')
  if (!hookSecret || !sameSecret(req.headers.get('x-push-secret') || '', hookSecret)) {
    return json({ error: 'Not allowed' }, 401)
  }

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  if (!publicKey || !privateKey) return json({ error: 'VAPID keys not set' }, 500)
  webpush.setVapidDetails('mailto:info@magmacoatings.com', publicKey, privateKey)

  const { notification_id } = await req.json().catch(() => ({}))
  if (!notification_id || typeof notification_id !== 'string') return json({ error: 'notification_id required' }, 400)

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  const { data: n, error: nErr } = await db
    .from('notifications')
    .select('id, title, body, link_type, link_target, send_push, status')
    .eq('id', notification_id)
    .single()
  if (nErr || !n) return json({ error: 'Notification not found' }, 404)
  if (!n.send_push || n.status !== 'sent') return json({ skipped: true })

  // Claim the recipients not yet alerted (marking them first means a repeat call never double-sends)
  const { data: recips, error: rErr } = await db
    .from('notification_recipients')
    .update({ pushed_at: new Date().toISOString() })
    .eq('notification_id', n.id)
    .is('pushed_at', null)
    .select('user_id')
  if (rErr) return json({ error: rErr.message }, 500)
  let userIds = (recips || []).map(r => r.user_id as string)
  if (userIds.length === 0) return json({ sent: 0 })

  // Respect the "phone alerts" master switch (notify_prefs.push)
  const blocked = new Set<string>()
  for (const part of chunks(userIds)) {
    const { data: profiles } = await db.from('profiles').select('id, notify_prefs').in('id', part)
    for (const p of profiles || []) if (p.notify_prefs?.push === false) blocked.add(p.id as string)
  }
  userIds = userIds.filter(id => !blocked.has(id))

  type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }
  const subs: Sub[] = []
  for (const part of chunks(userIds)) {
    const { data } = await db.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', part)
    subs.push(...((data || []) as Sub[]))
  }

  const payload = JSON.stringify({
    id: n.id,
    title: n.title,
    body: n.body,
    url: targetUrl(n.link_type, n.link_target, n.id),
  })

  let sent = 0
  const gone: string[] = []
  const reached = new Set<string>()
  const list = subs
  // Small batches so a big audience doesn't open hundreds of connections at once
  for (let i = 0; i < list.length; i += 20) {
    await Promise.all(list.slice(i, i + 20).map(async s => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: 'normal' },
        )
        sent++
        reached.add(s.user_id)
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) gone.push(s.id) // phone unsubscribed or app removed
        else console.warn('push failed', code, (e as Error).message)
      }
    }))
  }

  for (const part of chunks(gone)) await db.from('push_subscriptions').delete().in('id', part)
  return json({ sent, devices: list.length, people: reached.size, removed: gone.length })
})
