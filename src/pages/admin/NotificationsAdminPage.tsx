import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import { Bell, Send, Clock, Trash2, Plus, X } from 'lucide-react'
import {
  CATEGORY_LABELS, notificationCta,
  type NotificationCategory, type NotificationKind, type NotificationLinkType,
} from '@/lib/notifications'

type Tab = 'send' | 'auto' | 'history'
type LinkChoice = 'calc' | 'system' | 'quotes' | 'instagram' | 'url'

interface SystemRow { id: string; name: string; surface_type: string; family: string | null }
interface PersonRow { id: string; email: string | null; full_name: string | null; company_name: string | null; status: string | null }
interface Settings {
  auto_price: boolean
  auto_product: boolean
  quote_followup: boolean
  quote_followup_days: number
  nudge_enabled: boolean
  nudge_gap_days: number
  auto_send_time: string
  weekly_cap: number
}
interface NudgeRow { id: string; title: string; body: string; url: string; position: number; active: boolean; last_sent_at: string | null }
interface HistoryRow {
  id: string; title: string; body: string; category: NotificationCategory; kind: NotificationKind
  audience: 'all' | 'selected'; audience_user_ids: string[]; status: 'scheduled' | 'sent' | 'cancelled'
  send_at: string; sent_at: string | null; recipient_count: number
}

const KIND_LABELS: Record<NotificationKind, string> = {
  manual: 'You', price: 'Price change', product: 'New product', quote_followup: 'Quote follow-up', nudge: 'Quiet-period nudge',
}

const inputCls = 'w-full min-h-[44px] px-3 rounded-lg border border-line bg-bone text-basalt focus:outline-none focus:ring-2 focus:ring-molten/30'
const pill = (on: boolean) =>
  `min-h-[40px] px-3.5 rounded-full text-sm transition-colors ${on ? 'bg-basalt text-bone font-medium border border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`

function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange}
      className={`w-12 h-7 shrink-0 rounded-full relative transition-colors ${on ? 'bg-sage' : 'bg-ash'}`}>
      <span className={`absolute top-1 w-5 h-5 rounded-full bg-bone shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// Default schedule slot: next weekday at 08:30, in the local datetime-local format
function nextWeekdayMorning() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(8, 30, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function NotificationsAdminPage() {
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState<Tab>((params.get('tab') as Tab) || 'send')
  const [toast, setToast] = useState<string | null>(null)
  const [setupMissing, setSetupMissing] = useState(false)

  // ---- Send form (can be pre-filled from a price-change / new-product prompt)
  const [title, setTitle] = useState(params.get('title') || '')
  const [body, setBody] = useState(params.get('body') || '')
  const [kind] = useState<NotificationKind>((params.get('kind') as NotificationKind) || 'manual')
  const [category, setCategory] = useState<NotificationCategory>((params.get('category') as NotificationCategory) || 'products')
  const [linkChoice, setLinkChoice] = useState<LinkChoice>((params.get('link') as LinkChoice) || 'calc')
  const [systemId, setSystemId] = useState(params.get('system') || '')
  const [url, setUrl] = useState('')
  const [audience, setAudience] = useState<'all' | 'selected'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [personSearch, setPersonSearch] = useState('')
  const [sendPush, setSendPush] = useState(true)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleAt, setScheduleAt] = useState(nextWeekdayMorning())
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [systems, setSystems] = useState<SystemRow[]>([])
  const [people, setPeople] = useState<PersonRow[]>([])

  // ---- Automatic
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [nudges, setNudges] = useState<NudgeRow[]>([])
  const [newNudge, setNewNudge] = useState({ title: '', body: '', url: '' })

  // ---- History
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [stats, setStats] = useState<Record<string, { delivered: number; opened: number }>>({})
  const [historyLoading, setHistoryLoading] = useState(false)

  // Prefill params are used once, then cleared from the address bar
  useEffect(() => {
    if (params.toString()) setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    supabase.from('systems').select('id, name, surface_type, family').eq('is_active', true).order('display_order')
      .then(({ data }) => setSystems(((data as SystemRow[]) || []).filter(s => s.surface_type === 'floor' || s.surface_type === 'wall')))
    supabase.from('profiles').select('id, email, full_name, company_name, status').order('company_name')
      .then(({ data }) => setPeople(((data as PersonRow[]) || []).filter(p => (p.status || 'active') === 'active')))
    loadSettings()
  }, [])

  useEffect(() => { if (tab === 'history') loadHistory() }, [tab])

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 6000)
  }

  async function loadSettings() {
    const { data, error } = await supabase.from('notification_settings').select('*').eq('id', 1).maybeSingle()
    if (error) { setSetupMissing(true); return }
    if (data) setSettings({ ...data, auto_send_time: String(data.auto_send_time).slice(0, 5) } as Settings)
    const { data: n } = await supabase.from('nudge_messages').select('*').order('position')
    setNudges((n as NudgeRow[]) || [])
  }

  async function loadHistory() {
    setHistoryLoading(true)
    const { data } = await supabase.from('notifications')
      .select('id, title, body, category, kind, audience, audience_user_ids, status, send_at, sent_at, recipient_count')
      .order('created_at', { ascending: false }).limit(100)
    setHistory((data as HistoryRow[]) || [])
    const { data: s } = await supabase.rpc('notification_stats')
    const map: Record<string, { delivered: number; opened: number }> = {}
    for (const r of (s as { notification_id: string; delivered: number; opened: number }[]) || []) {
      map[r.notification_id] = { delivered: Number(r.delivered), opened: Number(r.opened) }
    }
    setStats(map)
    setHistoryLoading(false)
  }

  // ---- Send
  const linkType: NotificationLinkType =
    linkChoice === 'instagram' || linkChoice === 'url' ? 'url' : linkChoice
  const linkTarget = linkType === 'system' ? systemId : linkType === 'url' ? url.trim() : null
  const recipientsLabel = audience === 'all' ? 'all installers' : `${selected.length} installer${selected.length === 1 ? '' : 's'}`

  function validate(): string | null {
    if (!title.trim()) return 'Add a title.'
    if (!body.trim()) return 'Add a message.'
    if (linkType === 'system' && !systemId) return 'Choose which system it opens.'
    if (linkType === 'url' && !/^https:\/\/\S+\.\S+/i.test(url.trim())) return 'The link must start with https://'
    if (audience === 'selected' && selected.length === 0) return 'Choose at least one installer.'
    if (scheduling && new Date(scheduleAt).getTime() < Date.now() - 60000) return 'Choose a time in the future.'
    return null
  }

  async function submit() {
    const problem = validate()
    if (problem) { setFormError(problem); setConfirming(false); return }
    setFormError(null)
    setSending(true)
    const { data, error } = await supabase.from('notifications').insert({
      title: title.trim(),
      body: body.trim(),
      category,
      kind,
      link_type: linkType,
      link_target: linkTarget,
      audience,
      audience_user_ids: audience === 'selected' ? selected : [],
      send_push: sendPush,
      send_at: scheduling ? new Date(scheduleAt).toISOString() : new Date().toISOString(),
    }).select('id').single()
    if (error || !data) {
      setSending(false)
      setFormError('Could not save the notification. ' + (error?.message || ''))
      return
    }
    if (scheduling) {
      setSending(false)
      flash(`Scheduled for ${fmt(new Date(scheduleAt).toISOString())}, to ${recipientsLabel}.`)
    } else {
      const { data: count, error: sendError } = await supabase.rpc('deliver_notification', { p_id: data.id })
      setSending(false)
      if (sendError) {
        flash('Saved, but sending failed: it will go out automatically within 5 minutes.')
      } else {
        flash(`Sent to ${count} ${count === 1 ? 'person' : 'people'}. It's in their bell now.`)
      }
    }
    setConfirming(false)
    setScheduling(false)
    setTitle(''); setBody(''); setUrl(''); setSelected([])
  }

  // ---- Automatic settings
  async function saveSettings(next: Settings) {
    setSettings(next)
    setSettingsSaved(false)
    const { error } = await supabase.from('notification_settings').update({
      ...next,
      quote_followup_days: Math.min(60, Math.max(1, Number(next.quote_followup_days) || 7)),
      nudge_gap_days: Math.min(60, Math.max(3, Number(next.nudge_gap_days) || 10)),
      weekly_cap: Math.min(14, Math.max(1, Number(next.weekly_cap) || 2)),
      updated_at: new Date().toISOString(),
    }).eq('id', 1)
    if (error) flash('Could not save: ' + error.message)
    else { setSettingsSaved(true); window.setTimeout(() => setSettingsSaved(false), 2500) }
  }

  async function addNudge() {
    const t = newNudge.title.trim(), b = newNudge.body.trim(), u = newNudge.url.trim()
    if (!t || !b || !/^https:\/\/\S+\.\S+/i.test(u)) { flash('Each message needs a title, text and an https:// link.'); return }
    const position = Math.max(0, ...nudges.map(n => n.position)) + 1
    const { data, error } = await supabase.from('nudge_messages').insert({ title: t, body: b, url: u, position }).select('*').single()
    if (error) { flash('Could not add: ' + error.message); return }
    setNudges([...nudges, data as NudgeRow])
    setNewNudge({ title: '', body: '', url: newNudge.url })
  }

  async function removeNudge(id: string) {
    const { error } = await supabase.from('nudge_messages').delete().eq('id', id)
    if (!error) setNudges(nudges.filter(n => n.id !== id))
  }

  async function toggleNudge(n: NudgeRow) {
    const { error } = await supabase.from('nudge_messages').update({ active: !n.active }).eq('id', n.id)
    if (!error) setNudges(nudges.map(x => x.id === n.id ? { ...x, active: !n.active } : x))
  }

  async function cancelScheduled(id: string) {
    const { error } = await supabase.from('notifications').update({ status: 'cancelled' }).eq('id', id).eq('status', 'scheduled')
    if (!error) setHistory(history.map(h => h.id === id ? { ...h, status: 'cancelled' } : h))
  }

  const filteredPeople = useMemo(() => {
    const q = personSearch.trim().toLowerCase()
    return people.filter(p => !q || [p.full_name, p.company_name, p.email].some(v => (v || '').toLowerCase().includes(q)))
  }, [people, personSearch])

  const previewTitle = title.trim() || 'Your title'
  const previewBody = body.trim() || 'Your message'
  const previewCta = notificationCta({ link_type: linkType, link_target: linkTarget })

  if (setupMissing) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-medium text-basalt mb-3">Notifications</h1>
        <div className="bg-bone border border-line rounded-xl p-6 text-sm text-ink">
          Notifications aren't set up in the database yet. Run <code className="px-1 bg-line-soft rounded">sql/notifications.sql</code> in the Supabase SQL Editor, then reload this page.
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-medium text-basalt flex items-center gap-2"><Bell className="w-6 h-6" /> Notifications</h1>
        <div className="bg-track rounded-lg p-1 flex gap-1" role="tablist">
          {([['send', 'Send'], ['auto', 'Automatic'], ['history', 'History']] as [Tab, string][]).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              className={`min-h-[40px] px-4 rounded-md text-sm font-medium ${tab === id ? 'bg-bone text-basalt shadow-sm' : 'text-stone hover:text-ink'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'send' && (
        <div className="flex flex-wrap gap-6 items-start">
          <div className="flex-[999_1_520px] min-w-0 bg-bone border border-line rounded-xl p-6 space-y-5">
            {kind !== 'manual' && (
              <p className="text-sm bg-molten-tint text-molten-ink rounded-lg px-3 py-2">
                Written for you from your {kind === 'price' ? 'price change' : 'new product'}. Check it, then send or schedule.
              </p>
            )}
            <label className="block">
              <span className="block text-sm font-medium text-basalt mb-1.5">Title</span>
              <input className={inputCls} value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="e.g. New: Crack Bridging Tape" />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-basalt mb-1.5">
                Message <span className="font-normal text-stone">{body.length} / 200, under 140 reads best on a lock screen</span>
              </span>
              <textarea className={`${inputCls} py-2.5`} rows={3} value={body} maxLength={200} onChange={e => setBody(e.target.value)}
                placeholder="e.g. 100m tanking roll, £78.50. Now in Wall Belt & Braces." />
            </label>

            <div>
              <span className="block text-sm font-medium text-basalt mb-2">When they tap it, open</span>
              <div className="flex flex-wrap gap-2">
                {([['calc', 'Calculator'], ['system', 'A system'], ['quotes', 'Their quotes'], ['instagram', 'Instagram'], ['url', 'Website or other link']] as [LinkChoice, string][]).map(([id, label]) => (
                  <button key={id} type="button" className={pill(linkChoice === id)} onClick={() => setLinkChoice(id)}>{label}</button>
                ))}
              </div>
              {linkChoice === 'system' && (
                <select className={`${inputCls} mt-2`} value={systemId} onChange={e => setSystemId(e.target.value)}>
                  <option value="">Choose a system…</option>
                  {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {(linkChoice === 'instagram' || linkChoice === 'url') && (
                <input className={`${inputCls} mt-2`} value={url} onChange={e => setUrl(e.target.value)}
                  placeholder={linkChoice === 'instagram' ? 'https://www.instagram.com/… (your profile, a post or a reel)' : 'https://…'} />
              )}
            </div>

            <div>
              <span className="block text-sm font-medium text-basalt mb-2">Who gets it</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={pill(audience === 'all')} onClick={() => setAudience('all')}>All installers</button>
                <button type="button" className={pill(audience === 'selected')} onClick={() => setAudience('selected')}>Selected installers</button>
              </div>
              {audience === 'selected' && (
                <div className="mt-2 border border-line rounded-lg">
                  <input className="w-full min-h-[44px] px-3 border-b border-line rounded-t-lg focus:outline-none" placeholder="Search by name, company or email"
                    value={personSearch} onChange={e => setPersonSearch(e.target.value)} />
                  <div className="max-h-56 overflow-y-auto divide-y divide-line-soft">
                    {filteredPeople.map(p => (
                      <label key={p.id} className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-limestone">
                        <input type="checkbox" className="w-4 h-4" checked={selected.includes(p.id)}
                          onChange={() => setSelected(selected.includes(p.id) ? selected.filter(x => x !== p.id) : [...selected, p.id])} />
                        <span className="min-w-0">
                          <span className="block text-basalt">{p.full_name || p.email}</span>
                          <span className="block text-xs text-stone">{[p.company_name, p.email].filter(Boolean).join(' · ')}</span>
                        </span>
                      </label>
                    ))}
                    {filteredPeople.length === 0 && <p className="px-3 py-3 text-sm text-stone">No matches</p>}
                  </div>
                  <p className="px-3 py-2 text-xs text-stone border-t border-line">{selected.length} selected</p>
                </div>
              )}
            </div>

            <div>
              <span className="block text-sm font-medium text-basalt mb-2">Category <span className="font-normal text-stone">installers can switch categories off</span></span>
              <div className="flex flex-wrap gap-2">
                {(['products', 'quotes', 'social'] as NotificationCategory[]).map(c => (
                  <button key={c} type="button" className={pill(category === c)} onClick={() => setCategory(c)}>{CATEGORY_LABELS[c]}</button>
                ))}
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" className="w-4 h-4 mt-0.5" checked={sendPush} onChange={e => setSendPush(e.target.checked)} />
              <span><span className="text-basalt font-medium">Also send as a phone alert</span><span className="block text-xs text-stone">To installers who have turned alerts on. It always appears in the bell.</span></span>
            </label>

            {formError && <p className="text-sm text-danger">{formError}</p>}

            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-line-soft">
              {!confirming ? (
                <>
                  <Button onClick={() => { const p = validate(); if (p) setFormError(p); else { setFormError(null); setConfirming(true) } }} disabled={sending}>
                    {scheduling ? <Clock className="w-4 h-4 mr-1.5" /> : <Send className="w-4 h-4 mr-1.5" />}
                    {scheduling ? 'Schedule' : 'Send now'}
                  </Button>
                  <Button variant="outline" onClick={() => setScheduling(!scheduling)}>
                    {scheduling ? 'Send now instead' : 'Schedule for later…'}
                  </Button>
                  {scheduling && (
                    <input type="datetime-local" className={`${inputCls} w-auto`} value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3 bg-molten-tint rounded-lg px-3 py-2">
                  <span className="text-sm text-basalt">
                    {scheduling ? `Schedule for ${fmt(new Date(scheduleAt).toISOString())} to ${recipientsLabel}?` : `Send to ${recipientsLabel} now?`}
                  </span>
                  <Button size="sm" onClick={submit} disabled={sending}>{sending ? 'Sending…' : 'Yes, go'}</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex-[1_1_320px] min-w-0 space-y-3">
            <p className="text-xs font-medium tracking-wide text-stone uppercase">Preview: phone lock screen</p>
            <div className="bg-[#2E2B28] rounded-2xl p-4">
              <div className="bg-bone/95 rounded-2xl p-3 flex gap-3">
                <span className="w-9 h-9 rounded-lg bg-molten text-basalt font-bold flex items-center justify-center shrink-0">M</span>
                <span className="min-w-0">
                  <span className="flex justify-between text-xs text-stone"><span className="font-semibold text-ink">MAGMA</span><span>now</span></span>
                  <span className="block text-sm font-semibold text-basalt">{previewTitle}</span>
                  <span className="block text-sm text-ink leading-snug">{previewBody}</span>
                </span>
              </div>
            </div>
            <p className="text-xs font-medium tracking-wide text-stone uppercase pt-2">Preview: in the app's bell</p>
            <div className="bg-bone border border-line rounded-xl p-4 flex gap-3">
              <span className="w-2 h-2 rounded-full bg-molten mt-2 shrink-0" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold tracking-wide text-stone uppercase">{CATEGORY_LABELS[category]} · Just now</span>
                <span className="block text-sm font-semibold text-basalt mt-0.5">{previewTitle}</span>
                <span className="block text-sm text-ink mt-0.5">{previewBody}</span>
                <span className="block text-sm font-medium text-molten-ink mt-1">{previewCta} ›</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {tab === 'auto' && (
        !settings ? <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div> : (
          <div className="space-y-4 max-w-3xl">
            <p className="text-sm text-stone">
              Automatic messages go out on weekdays at{' '}
              <input type="time" className="inline-block w-28 min-h-[36px] px-2 rounded-lg border border-line bg-bone text-basalt"
                value={settings.auto_send_time} onChange={e => setSettings({ ...settings, auto_send_time: e.target.value })}
                onBlur={() => saveSettings(settings)} aria-label="Automatic send time" /> (UK time).
              {settingsSaved && <span className="ml-2 text-sage font-medium">Saved</span>}
            </p>

            {([
              ['auto_price', 'Price change', 'When you save a new price in Products, you get a button to tell installers, with the message written for you to check.'],
              ['auto_product', 'New product', 'When you add a product, you get a button to announce it, ready to send or schedule.'],
            ] as [keyof Settings, string, string][]).map(([key, label, desc]) => (
              <div key={key} className="bg-bone border border-line rounded-xl p-5 flex justify-between gap-4">
                <div><p className="font-medium text-basalt">{label}</p><p className="text-sm text-stone mt-1">{desc}</p></div>
                <Switch on={!!settings[key]} label={label} onChange={() => saveSettings({ ...settings, [key]: !settings[key] })} />
              </div>
            ))}

            <div className="bg-bone border border-line rounded-xl p-5 space-y-3">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-medium text-basalt">Quote follow-up</p>
                  <p className="text-sm text-stone mt-1">A reminder to the installer when a saved quote is still Draft or Sent after a set number of days. Each quote is reminded once.</p>
                </div>
                <Switch on={settings.quote_followup} label="Quote follow-up" onChange={() => saveSettings({ ...settings, quote_followup: !settings.quote_followup })} />
              </div>
              <label className="flex items-center gap-2 text-sm text-ink">After
                <input type="number" min={1} max={60} className="w-20 min-h-[40px] px-2 rounded-lg border border-line text-center" value={settings.quote_followup_days}
                  onChange={e => setSettings({ ...settings, quote_followup_days: Number(e.target.value) })} onBlur={() => saveSettings(settings)} /> days
              </label>
              <p className="text-sm bg-limestone rounded-lg px-3 py-2">Example: <strong className="text-basalt">Smith Bathroom is a week old.</strong> Quote MQ-0123 is ready when you are.</p>
            </div>

            <div className="bg-bone border border-line rounded-xl p-5 space-y-4">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-medium text-basalt">Instagram nudge when it's quiet</p>
                  <p className="text-sm text-stone mt-1">If nothing has gone to all installers for a while, the next message below is sent. Anything you send resets the clock. Category: News &amp; social.</p>
                </div>
                <Switch on={settings.nudge_enabled} label="Instagram nudge" onChange={() => saveSettings({ ...settings, nudge_enabled: !settings.nudge_enabled })} />
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-ink">
                <label className="flex items-center gap-2">After
                  <input type="number" min={3} max={60} className="w-20 min-h-[40px] px-2 rounded-lg border border-line text-center" value={settings.nudge_gap_days}
                    onChange={e => setSettings({ ...settings, nudge_gap_days: Number(e.target.value) })} onBlur={() => saveSettings(settings)} /> quiet days
                </label>
                <label className="flex items-center gap-2">No more than
                  <input type="number" min={1} max={14} className="w-20 min-h-[40px] px-2 rounded-lg border border-line text-center" value={settings.weekly_cap}
                    onChange={e => setSettings({ ...settings, weekly_cap: Number(e.target.value) })} onBlur={() => saveSettings(settings)} /> messages a week per installer
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-basalt">Messages, sent in turn</p>
                {nudges.length === 0 && <p className="text-sm text-stone">None yet. Add at least one before switching the nudge on.</p>}
                {nudges.map((n, i) => (
                  <div key={n.id} className={`flex items-start gap-3 border border-line rounded-lg p-3 ${n.active ? '' : 'opacity-60'}`}>
                    <span className="text-xs font-semibold text-stone w-5 pt-0.5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-basalt">{n.title}</p>
                      <p className="text-sm text-ink">{n.body}</p>
                      <p className="text-xs text-stone truncate">{n.url}{n.last_sent_at ? ` · last sent ${fmt(n.last_sent_at)}` : ''}</p>
                    </div>
                    <Switch on={n.active} label={`Use "${n.title}"`} onChange={() => toggleNudge(n)} />
                    <button type="button" aria-label={`Remove "${n.title}"`} onClick={() => removeNudge(n.id)} className="w-10 h-10 flex items-center justify-center text-stone hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-2 border border-dashed border-line rounded-lg p-3">
                  <input className={inputCls} placeholder="Title, e.g. See this week's floors" maxLength={80} value={newNudge.title} onChange={e => setNewNudge({ ...newNudge, title: e.target.value })} />
                  <input className={inputCls} placeholder="https://www.instagram.com/…" value={newNudge.url} onChange={e => setNewNudge({ ...newNudge, url: e.target.value })} />
                  <input className={`${inputCls} sm:col-span-2`} placeholder="Text, e.g. Fresh Medium and Smooth finishes from installers around the UK" maxLength={200} value={newNudge.body} onChange={e => setNewNudge({ ...newNudge, body: e.target.value })} />
                  <Button variant="outline" className="sm:col-span-2" onClick={addNudge}><Plus className="w-4 h-4 mr-1.5" /> Add message</Button>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'history' && (
        <div className="bg-bone border border-line rounded-xl overflow-x-auto">
          {historyLoading ? <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div> : history.length === 0 ? (
            <p className="p-6 text-sm text-stone">Nothing sent yet.</p>
          ) : (
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-stone uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Message</th>
                  <th className="px-3 py-3 font-medium">Type</th>
                  <th className="px-3 py-3 font-medium">To</th>
                  <th className="px-5 py-3 font-medium">Opened</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => {
                  const st = stats[h.id]
                  return (
                    <tr key={h.id} className="border-t border-line-soft align-top">
                      <td className="px-5 py-3 text-stone whitespace-nowrap">
                        {h.status === 'scheduled' ? <>Scheduled<br />{fmt(h.send_at)}</> : h.status === 'cancelled' ? <>Cancelled<br />{fmt(h.send_at)}</> : fmt(h.sent_at || h.send_at)}
                      </td>
                      <td className="px-3 py-3"><p className="font-medium text-basalt">{h.title}</p><p className="text-ink">{h.body}</p></td>
                      <td className="px-3 py-3"><span className={`text-xs font-medium px-2.5 py-1 rounded-full ${h.kind === 'manual' ? 'bg-molten-tint text-molten-ink' : 'bg-sage-tint text-sage'}`}>{KIND_LABELS[h.kind]}</span></td>
                      <td className="px-3 py-3 text-ink">{h.audience === 'all' ? 'All installers' : `${h.audience_user_ids.length} selected`}</td>
                      <td className="px-5 py-3 text-ink whitespace-nowrap">
                        {h.status === 'scheduled' ? (
                          <Button size="sm" variant="outline" onClick={() => cancelScheduled(h.id)}><X className="w-4 h-4 mr-1" /> Cancel</Button>
                        ) : h.status === 'sent' ? (
                          `${st?.opened ?? 0} of ${st?.delivered ?? h.recipient_count}`
                        ) : '–'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {toast && (
        <div role="status" className="fixed right-6 bottom-6 z-[80] max-w-sm bg-basalt text-bone rounded-xl shadow-lg px-4 py-3 flex gap-3 items-start">
          <span className="text-sm flex-1">{toast}</span>
          <button aria-label="Dismiss" onClick={() => setToast(null)} className="text-bone/70 hover:text-bone"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}
