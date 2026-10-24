// Admin > Media pack: upload and publish social posts, videos, architect material, logos and packs.
// Everything stays hidden from installers until "Show Media pack to installers" is switched on.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Images, Plus, Upload, X, Trash2, ArrowUp, ArrowDown, Pin, PinOff, Eye, Bell, Play, FileText, Archive,
  Users as UsersIcon, AlertTriangle, ExternalLink, RefreshCw, Check,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import {
  CAPTION_MAX, FILE_COLUMNS, FORMAT_LABELS, ITEM_COLUMNS, MEDIA_BUCKET, SECTION_ACCEPT, SECTION_LABELS, SECTION_LONG,
  SECTION_MAX_FILES, SECTION_ORDER, clearMediaAccess, coverFromImage, durationLabel, fileProblem, formatFromSize, isNew,
  kindOf, mediaPageUrl, mimeOf, readFileFacts, signMedia, sizeLabel, storedName, uploadMediaFile,
  type FileFacts, type MediaCampaign, type MediaFile, type MediaFormat, type MediaItem, type MediaKind, type MediaSection,
} from '@/lib/media'

type Tab = 'items' | 'campaigns' | 'settings'

interface NamedRow { id: string; name: string; group?: string | null }
interface Stats { views: number; saves: number; captions: number; downloads: number; shares: number; people: number }
interface Settings { media_pack_enabled: boolean; default_hashtags: string; default_credit: string; enabled_at: string | null }
interface Terms { version: number; title: string; body: string; created_at: string }
interface PersonRow { user_id: string; name: string; company: string; views: number; saves: number; captions: number; downloads: number; shares: number; last_at: string }
interface AgreementRow { user_id: string; name: string; company: string; version: number; agreed_at: string }

interface EditorFile {
  key: string
  existing?: MediaFile
  file?: File
  kind: MediaKind
  mime: string
  name: string
  size: number
  facts?: FileFacts
  newCover?: Blob          // a cover image uploaded by hand (videos)
  thumb?: string           // preview shown in the editor
  progress?: number
}

interface Draft {
  id: string
  isNew: boolean
  title: string
  section: MediaSection
  campaign_id: string
  description: string
  caption: string
  hashtags: string
  credit: string
  format: MediaFormat | ''
  check_watermark: boolean
  check_permission: boolean
  status: 'draft' | 'published'
  productIds: string[]
  systemIds: string[]
  files: EditorFile[]
}

const inputCls = 'w-full min-h-[44px] px-3 rounded-lg border border-line bg-bone text-basalt focus:outline-none focus:ring-2 focus:ring-molten/30'
const pill = (on: boolean) =>
  `min-h-[40px] px-3.5 rounded-full text-sm transition-colors ${on ? 'bg-basalt text-bone font-medium border border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`
const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function KindIcon({ kind, className = 'w-5 h-5' }: { kind: MediaKind; className?: string }) {
  if (kind === 'video') return <Play className={className} aria-hidden="true" />
  if (kind === 'zip') return <Archive className={className} aria-hidden="true" />
  if (kind === 'document') return <FileText className={className} aria-hidden="true" />
  return <Images className={className} aria-hidden="true" />
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`w-12 h-7 shrink-0 rounded-full relative transition-colors disabled:opacity-50 ${on ? 'bg-sage' : 'bg-ash'}`}>
      <span className={`absolute left-0 top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export function MediaAdminPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'items'
  const setTab = (t: Tab) => setParams(p => { p.set('tab', t); return p }, { replace: true })

  const [setupMissing, setSetupMissing] = useState(false)
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [links, setLinks] = useState<{ item_id: string; product_id: string | null; system_id: string | null }[]>([])
  const [campaigns, setCampaigns] = useState<MediaCampaign[]>([])
  const [stats, setStats] = useState<Record<string, Stats>>({})
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<Settings | null>(null)
  const [terms, setTerms] = useState<Terms | null>(null)
  const [products, setProducts] = useState<NamedRow[]>([])
  const [systems, setSystems] = useState<NamedRow[]>([])
  const [sectionFilter, setSectionFilter] = useState<MediaSection | 'all'>('all')
  const [toast, setToast] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft | null>(null)
  const [replaced, setReplaced] = useState<MediaFile[]>([])
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [whoFor, setWhoFor] = useState<MediaItem | null>(null)
  const [who, setWho] = useState<PersonRow[] | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const coverInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const [coverFor, setCoverFor] = useState<string | null>(null)
  const [replaceFor, setReplaceFor] = useState<string | null>(null)

  useEffect(() => {
    load()
    supabase.from('products').select('id, name, is_active').order('name')
      .then(({ data }) => setProducts(((data as (NamedRow & { is_active: boolean })[]) || []).filter(p => p.is_active !== false)))
    supabase.from('systems').select('id, name, family, surface_type, is_active').order('display_order')
      .then(({ data }) => setSystems(((data as { id: string; name: string; family: string | null; surface_type: string; is_active: boolean }[]) || [])
        .filter(s => s.is_active !== false && (s.surface_type === 'floor' || s.surface_type === 'wall'))
        .map(s => ({ id: s.id, name: s.name, group: s.family }))))
  }, [])

  function flash(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(t => (t === msg ? null : t)), 5000)
  }

  async function load() {
    const [it, fi, li, ca, se, te] = await Promise.all([
      supabase.from('media_items').select(ITEM_COLUMNS).order('section').order('pinned', { ascending: false }).order('display_order'),
      supabase.from('media_files').select(FILE_COLUMNS).order('position'),
      supabase.from('media_links').select('item_id, product_id, system_id'),
      supabase.from('media_campaigns').select('id, name, starts_on, display_order').order('starts_on', { ascending: false }),
      supabase.from('media_settings').select('media_pack_enabled, default_hashtags, default_credit, enabled_at').eq('id', 1).maybeSingle(),
      supabase.from('media_terms').select('version, title, body, created_at').order('version', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (it.error || se.error) { setSetupMissing(true); setItems([]); return }
    const itemRows = (it.data as MediaItem[]) || []
    const fileRows = (fi.data as MediaFile[]) || []
    setItems(itemRows)
    setFiles(fileRows)
    setLinks((li.data as typeof links) || [])
    setCampaigns((ca.data as MediaCampaign[]) || [])
    setSettings(se.data as Settings)
    setTerms((te.data as Terms) || null)

    const { data: s } = await supabase.rpc('media_stats')
    const map: Record<string, Stats> = {}
    for (const r of (s as ({ item_id: string } & Record<keyof Stats, number>)[]) || []) {
      map[r.item_id] = { views: +r.views, saves: +r.saves, captions: +r.captions, downloads: +r.downloads, shares: +r.shares, people: +r.people }
    }
    setStats(map)

    // Small previews for the list
    const firstOf = new Map<string, MediaFile>()
    for (const f of fileRows) if (f.is_current && !firstOf.has(f.item_id)) firstOf.set(f.item_id, f)
    const paths = [...firstOf.values()].map(f => f.preview_path || (f.kind === 'image' ? f.file_path : '')).filter(Boolean)
    const signed = await signMedia(paths)
    const t: Record<string, string> = {}
    firstOf.forEach((f, itemId) => { const p = f.preview_path || (f.kind === 'image' ? f.file_path : ''); if (p && signed[p]) t[itemId] = signed[p] })
    setThumbs(t)
  }

  const currentFiles = (itemId: string) => files.filter(f => f.item_id === itemId && f.is_current).sort((a, b) => a.position - b.position)
  const campaignName = useMemo(() => new Map(campaigns.map(c => [c.id, c.name])), [campaigns])

  // ---- Editor ---------------------------------------------------------------------
  async function openEditor(item: MediaItem | null, section?: MediaSection) {
    setFormError(null)
    setProductSearch('')
    if (!item) {
      setReplaced([])
      setDraft({
        id: crypto.randomUUID(), isNew: true, title: '', section: section || (sectionFilter === 'all' ? 'social' : sectionFilter),
        campaign_id: campaigns[0]?.id || '', description: '', caption: '', hashtags: settings?.default_hashtags || '',
        credit: settings?.default_credit || '', format: '', check_watermark: false, check_permission: false, status: 'draft',
        productIds: [], systemIds: [], files: [],
      })
      return
    }
    const cur = currentFiles(item.id)
    setReplaced(files.filter(f => f.item_id === item.id && !f.is_current).sort((a, b) => (b.replaced_at || '').localeCompare(a.replaced_at || '')))
    const ls = links.filter(l => l.item_id === item.id)
    const signed = await signMedia(cur.map(f => f.preview_path || (f.kind === 'image' ? f.file_path : '')))
    setDraft({
      id: item.id, isNew: false, title: item.title, section: item.section, campaign_id: item.campaign_id || '',
      description: item.description || '', caption: item.caption || '', hashtags: item.hashtags || '', credit: item.credit || '',
      format: item.format || '', check_watermark: item.check_watermark, check_permission: item.check_permission, status: item.status,
      productIds: ls.filter(l => l.product_id).map(l => l.product_id as string),
      systemIds: ls.filter(l => l.system_id).map(l => l.system_id as string),
      files: cur.map(f => ({
        key: f.id, existing: f, kind: f.kind, mime: f.mime_type, name: f.file_name, size: f.file_size,
        thumb: signed[f.preview_path || (f.kind === 'image' ? f.file_path : '')],
      })),
    })
  }

  function closeEditor() {
    draft?.files.forEach(f => { if (f.file && f.thumb?.startsWith('blob:')) URL.revokeObjectURL(f.thumb) })
    setDraft(null)
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => d && ({ ...d, [key]: value }))
  }

  async function addFiles(list: FileList | File[], replaceKey?: string) {
    if (!draft) return
    setFormError(null)
    const incoming = [...list]
    const problems: string[] = []
    const ok: File[] = []
    for (const f of incoming) {
      const p = fileProblem(draft.section, f)
      if (p) problems.push(p); else ok.push(f)
    }
    const room = SECTION_MAX_FILES[draft.section] - draft.files.length + (replaceKey ? 1 : 0)
    if (ok.length > room) problems.push(`${SECTION_LONG[draft.section]} can hold ${SECTION_MAX_FILES[draft.section]} file${SECTION_MAX_FILES[draft.section] === 1 ? '' : 's'}. Remove one first, or use Replace.`)
    const accepted = ok.slice(0, Math.max(0, room))
    if (problems.length) setFormError(problems.join(' '))
    const added: EditorFile[] = []
    for (const f of accepted) {
      const kind = kindOf(f) as MediaKind
      const facts = await readFileFacts(f, kind)
      const thumb = facts.preview ? URL.createObjectURL(facts.preview) : undefined
      added.push({ key: crypto.randomUUID(), file: f, kind, mime: mimeOf(f), name: f.name, size: f.size, facts, thumb })
    }
    setDraft(d => {
      if (!d) return d
      let next = d.files
      if (replaceKey && added[0]) next = d.files.map(x => x.key === replaceKey ? added[0] : x)
      else next = [...d.files, ...added]
      const first = next[0]
      const autoFormat = first?.facts ? formatFromSize(first.facts.width, first.facts.height) : null
      const title = d.title || (added[0] ? added[0].name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') : '')
      return { ...d, files: next, title, format: d.format || autoFormat || (first?.existing ? formatFromSize(first.existing.width, first.existing.height) || '' : '') }
    })
  }

  function moveFile(key: string, dir: -1 | 1) {
    setDraft(d => {
      if (!d) return d
      const i = d.files.findIndex(f => f.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= d.files.length) return d
      const next = [...d.files]
      ;[next[i], next[j]] = [next[j], next[i]]
      return { ...d, files: next }
    })
  }

  function removeFile(key: string) {
    setDraft(d => d && ({ ...d, files: d.files.filter(f => f.key !== key) }))
  }

  async function setCover(key: string, file: File | null) {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { setFormError('The cover must be a JPG, PNG or WebP image.'); return }
    const blob = await coverFromImage(file)
    if (!blob) { setFormError('Could not read that image.'); return }
    setDraft(d => d && ({ ...d, files: d.files.map(f => f.key === key ? { ...f, newCover: blob, thumb: URL.createObjectURL(blob) } : f) }))
  }

  function toggleId(key: 'productIds' | 'systemIds', id: string) {
    setDraft(d => d && ({ ...d, [key]: d[key].includes(id) ? d[key].filter(x => x !== id) : [...d[key], id] }))
  }

  async function save(status: 'draft' | 'published') {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) { setFormError('Give the item a title.'); return }
    if (status === 'published') {
      if (draft.files.length === 0) { setFormError('Add a file before publishing.'); return }
      if (!draft.check_watermark || !draft.check_permission) { setFormError('Tick both checks before publishing.'); return }
    }
    if (draft.caption.length > CAPTION_MAX) { setFormError(`The caption is over ${CAPTION_MAX.toLocaleString('en-GB')} characters.`); return }
    setSaving(true)
    setFormError(null)
    const uploaded: string[] = []
    try {
      const payloadFiles: Record<string, unknown>[] = []
      for (const f of draft.files) {
        const folder = `${draft.id}/${crypto.randomUUID()}`
        let previewPath: string | null = null
        const previewBlob = f.newCover || f.facts?.preview
        if (previewBlob) {
          previewPath = `${folder}/preview.jpg`
          await uploadMediaFile(previewPath, previewBlob, 'image/jpeg')
          uploaded.push(previewPath)
        }
        if (f.existing) {
          payloadFiles.push({ id: f.existing.id, ...(previewPath ? { preview_path: previewPath } : {}) })
          continue
        }
        const path = `${folder}/${storedName(f.name)}`
        await uploadMediaFile(path, f.file as File, f.mime, p => {
          setDraft(d => d && ({ ...d, files: d.files.map(x => x.key === f.key ? { ...x, progress: p } : x) }))
        })
        uploaded.push(path)
        payloadFiles.push({
          kind: f.kind, file_path: path, file_name: f.name, mime_type: f.mime, file_size: f.size,
          width: f.facts?.width ?? '', height: f.facts?.height ?? '',
          duration_s: f.facts?.duration ? Math.round(f.facts.duration * 100) / 100 : '', preview_path: previewPath ?? '',
        })
      }
      const { error } = await supabase.rpc('save_media_item', {
        p: {
          id: draft.id, title, section: draft.section, campaign_id: draft.campaign_id, description: draft.description,
          caption: draft.caption, hashtags: draft.hashtags, credit: draft.credit, format: draft.format,
          status, check_watermark: draft.check_watermark, check_permission: draft.check_permission,
          product_ids: draft.productIds, system_ids: draft.systemIds, files: payloadFiles,
        },
      })
      if (error) throw error
      uploaded.length = 0
      flash(status === 'published' ? `"${title}" is published${settings?.media_pack_enabled ? '' : ' (installers will see it once the Media pack is switched on)'}.` : `"${title}" saved as a draft.`)
      closeEditor()
      await load()
    } catch (e) {
      // Don't leave unused uploads behind
      if (uploaded.length) await supabase.storage.from(MEDIA_BUCKET).remove(uploaded)
      const msg = (e as Error).message || ''
      setFormError(/maximum allowed size|Payload too large|413/i.test(msg)
        ? 'The file is larger than storage currently allows. In Supabase > Storage > Settings, raise the upload size limit to 500 MB.'
        : `Could not save: ${msg || 'please try again'}`)
      setDraft(d => d && ({ ...d, files: d.files.map(x => ({ ...x, progress: undefined })) }))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!draft || draft.isNew) return
    if (!window.confirm(`Delete "${draft.title}" and all its files?\n\nInstallers who saved it keep their copy, but it disappears from the Media pack.`)) return
    setSaving(true)
    const { data, error } = await supabase.rpc('delete_media_item', { p_id: draft.id })
    if (error) { setFormError(`Could not delete: ${error.message}`); setSaving(false); return }
    const paths = (data as string[]) || []
    if (paths.length) {
      const rm = await supabase.storage.from(MEDIA_BUCKET).remove(paths)
      if (rm.error) console.warn('Some files could not be removed from storage', rm.error.message)
    }
    setSaving(false)
    closeEditor()
    await load()
  }

  async function openFile(path: string) {
    const tab = window.open('about:blank', '_blank')
    const signed = await signMedia([path], false, 600)
    if (signed[path] && tab) tab.location.href = signed[path]
    else { tab?.close(); flash('Could not open that file.') }
  }

  async function move(item: MediaItem, dir: -1 | 1) {
    const { error } = await supabase.rpc('move_media_item', { p_id: item.id, p_direction: dir })
    if (error) flash('Could not move: ' + error.message)
    else load()
  }

  async function pin(item: MediaItem) {
    const { error } = await supabase.rpc('pin_media_item', { p_id: item.id, p_pinned: !item.pinned })
    if (error) flash('Could not pin: ' + error.message)
    else load()
  }

  async function openWho(item: MediaItem) {
    setWhoFor(item)
    setWho(null)
    const { data } = await supabase.rpc('media_item_people', { p_item: item.id })
    setWho((data as PersonRow[]) || [])
  }

  function tellInstallers(campaign?: MediaCampaign) {
    const what = campaign ? `New Instagram content for ${campaign.name} is ready` : 'New content in the Media pack'
    const p = new URLSearchParams({
      title: what.slice(0, 80),
      body: 'Ready-made posts, videos and captions to save to your phone and share. Tap to open the Media pack.'.slice(0, 200),
      category: 'social',
      link: 'url',
      url: mediaPageUrl(),
    })
    navigate(`/admin/notifications?${p}`)
  }

  // ---- Render ------------------------------------------------------------------------
  if (items === null) return <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>

  if (setupMissing) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-basalt flex items-center gap-2 mb-6"><Images className="w-6 h-6" /> Media pack</h1>
        <div className="bg-bone border border-line rounded-xl p-6 text-sm text-ink">
          The Media pack isn't set up in the database yet. Run <code className="px-1 bg-line-soft rounded">sql/media_pack.sql</code> in the Supabase SQL Editor, then reload this page.
        </div>
      </div>
    )
  }

  const enabled = !!settings?.media_pack_enabled
  const shownItems = items.filter(i => sectionFilter === 'all' || i.section === sectionFilter)
  const statLine = (id: string) => {
    const s = stats[id]
    if (!s) return 'No activity yet'
    return `${s.saves} saves · ${s.captions} captions · ${s.downloads} downloads · ${s.views} views`
  }

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-medium text-basalt flex items-center gap-2"><Images className="w-6 h-6" /> Media pack</h1>
        {tab === 'items' && <Button onClick={() => openEditor(null)} className="gap-2"><Plus className="w-4 h-4" /> Add item</Button>}
      </div>
      <p className="text-sm text-stone mb-4">Marketing material installers save to their phones: social posts, videos, architect documents, logos and whole packs.</p>

      <div className={`mb-4 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3 text-sm ${enabled ? 'bg-sage-tint text-sage' : 'bg-molten-tint text-molten-ink'}`} role="status">
        {enabled ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
        <span className="flex-1">
          {enabled
            ? <>Installers can see the Media pack{settings?.enabled_at ? ` (switched on ${fmtDate(settings.enabled_at)})` : ''}.</>
            : <><strong>Hidden from installers.</strong> Only admins can see the Media pack until it is switched on in Settings.</>}
        </span>
        {!enabled && tab !== 'settings' && <Button size="sm" variant="outline" onClick={() => setTab('settings')}>Settings</Button>}
      </div>

      {toast && <div className="mb-4 bg-basalt text-bone rounded-xl px-4 py-3 text-sm" role="status">{toast}</div>}

      <div className="bg-track rounded-lg p-1 flex gap-1 mb-5 max-w-md" role="tablist" aria-label="Media pack">
        {(['items', 'campaigns', 'settings'] as Tab[]).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={`flex-1 py-2 px-3 rounded-md font-medium text-sm min-h-[44px] ${tab === t ? 'bg-bone text-basalt shadow-sm' : 'text-stone hover:text-ink'}`}>
            {t === 'items' ? 'Items' : t === 'campaigns' ? 'Campaigns' : 'Settings'}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <>
          <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Show">
            {(['all', ...SECTION_ORDER] as (MediaSection | 'all')[]).map(s => (
              <button key={s} type="button" aria-pressed={sectionFilter === s} onClick={() => setSectionFilter(s)} className={pill(sectionFilter === s)}>
                {s === 'all' ? 'All' : SECTION_LABELS[s]}
              </button>
            ))}
          </div>

          {shownItems.length === 0 ? (
            <div className="bg-bone border border-line rounded-xl p-6 text-sm text-stone">
              Nothing here yet. Use <strong>Add item</strong> to upload images, a video, a document, a logo or a zip.
            </div>
          ) : (
            SECTION_ORDER.filter(s => shownItems.some(i => i.section === s)).map(section => {
              const list = shownItems.filter(i => i.section === section)
              return (
                <section key={section} className="mb-6">
                  <h2 className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">{SECTION_LONG[section]}</h2>
                  <ul className="bg-bone border border-line rounded-xl divide-y divide-line-soft">
                    {list.map((item, idx) => {
                      const cur = currentFiles(item.id)
                      const first = cur[0]
                      return (
                        <li key={item.id} className="p-3 sm:p-4 flex gap-3 items-start">
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-limestone overflow-hidden shrink-0 flex items-center justify-center relative">
                            {thumbs[item.id]
                              ? <img src={thumbs[item.id]} alt="" className="w-full h-full object-cover" loading="lazy" />
                              : first ? <KindIcon kind={first.kind} className="w-6 h-6 text-stone" /> : <Upload className="w-6 h-6 text-ash" />}
                            {first?.kind === 'video' && thumbs[item.id] && (
                              <span className="absolute inset-0 flex items-center justify-center"><span className="w-7 h-7 rounded-full bg-basalt/60 flex items-center justify-center"><Play className="w-3.5 h-3.5 text-white" /></span></span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                            <p className="font-medium text-basalt">
                              {item.pinned && <Pin className="w-3.5 h-3.5 inline-block mr-1 text-molten align-[-2px]" aria-label="Pinned" />}
                              {item.title}
                            </p>
                            <p className="text-xs text-stone mt-0.5 flex flex-wrap gap-x-2 gap-y-1 items-center">
                              <span className={`px-2 py-0.5 rounded-full font-medium ${item.status === 'published' ? 'bg-sage-tint text-sage' : 'bg-limestone text-stone border border-line'}`}>
                                {item.status === 'published' ? 'Published' : 'Draft'}
                              </span>
                              {isNew(item) && item.status === 'published' && <span className="px-2 py-0.5 rounded-full bg-molten-tint text-molten-ink font-medium">New</span>}
                              {item.campaign_id && <span>{campaignName.get(item.campaign_id)}</span>}
                              <span>{cur.length === 0 ? 'No file yet' : cur.length > 1 ? `${cur.length} files` : first.kind === 'video' ? `Video ${durationLabel(first.duration_s)}` : sizeLabel(first.file_size)}</span>
                            </p>
                            <p className="text-xs text-stone mt-1">{statLine(item.id)}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <Button size="sm" variant="outline" onClick={() => openEditor(item)}>Edit</Button>
                              <Button size="sm" variant="ghost" onClick={() => openWho(item)} className="gap-1"><UsersIcon className="w-4 h-4" /> See who</Button>
                              <Button size="sm" variant="ghost" onClick={() => pin(item)} className="gap-1" aria-label={item.pinned ? 'Unpin' : 'Pin to the top'}>
                                {item.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}<span className="hidden sm:inline">{item.pinned ? 'Unpin' : 'Pin'}</span>
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => move(item, -1)} disabled={idx === 0} aria-label="Move up"><ArrowUp className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => move(item, 1)} disabled={idx === list.length - 1} aria-label="Move down"><ArrowDown className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              )
            })
          )}
        </>
      )}

      {tab === 'campaigns' && (
        <CampaignsTab campaigns={campaigns} items={items} enabled={enabled} onChanged={load} onTell={tellInstallers} flash={flash} />
      )}

      {tab === 'settings' && settings && (
        <SettingsTab settings={settings} terms={terms} onChanged={load} flash={flash} onTell={() => tellInstallers()} />
      )}

      {/* ---- Editor ---- */}
      {draft && (
        <div className="fixed inset-0 z-[70] bg-basalt/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={draft.isNew ? 'Add item' : 'Edit item'}>
          <div className="bg-bone w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-basalt">{draft.isNew ? 'Add item' : 'Edit item'}</h2>
              <button aria-label="Close" onClick={closeEditor} disabled={saving} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-2">Section</p>
              <div className="flex flex-wrap gap-2">
                {SECTION_ORDER.map(s => (
                  <button key={s} type="button" aria-pressed={draft.section === s} className={pill(draft.section === s)}
                    disabled={draft.files.length > 0 && draft.section !== s}
                    title={draft.files.length > 0 && draft.section !== s ? 'Remove the files first to change section' : undefined}
                    onClick={() => set('section', s)}>
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="m-title" className="block text-sm font-medium text-ink mb-1">Title</label>
              <input id="m-title" className={inputCls} maxLength={120} value={draft.title} placeholder="e.g. Polished wet room, Essex" onChange={e => set('title', e.target.value)} />
            </div>

            <div>
              <label htmlFor="m-campaign" className="block text-sm font-medium text-ink mb-1">Campaign <span className="font-normal text-stone">(optional)</span></label>
              <select id="m-campaign" className={inputCls} value={draft.campaign_id} onChange={e => set('campaign_id', e.target.value)}>
                <option value="">No campaign</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <p className="text-xs text-stone mt-1">Add or rename campaigns in the Campaigns tab.</p>
            </div>

            {/* Files */}
            <div>
              <p className="text-sm font-medium text-ink mb-1">Files</p>
              <p className="text-xs text-stone mb-2">
                {{ social: 'One image, or 2 to 10 for a carousel (JPG, PNG or WebP, up to 15 MB each). All the same shape.',
                   videos: 'One MP4 video, up to 100 MB (aim for 30 MB). The cover is taken from the first second, or upload your own.',
                   architects: 'A Word (.docx) file, a PDF, or one of each, up to 25 MB.',
                   logos: 'A PNG with a transparent background, a PDF for print, or one of each. SVG is not accepted.',
                   pack: 'One ZIP file, up to 500 MB.' }[draft.section]}
              </p>
              <input ref={fileInput} type="file" accept={SECTION_ACCEPT[draft.section]} multiple={SECTION_MAX_FILES[draft.section] > 1} className="hidden"
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }} />
              <input ref={replaceInput} type="file" accept={SECTION_ACCEPT[draft.section]} className="hidden"
                onChange={e => { if (e.target.files && replaceFor) addFiles(e.target.files, replaceFor); setReplaceFor(null); e.target.value = '' }} />
              <input ref={coverInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                onChange={e => { if (coverFor) setCover(coverFor, e.target.files?.[0] || null); setCoverFor(null); e.target.value = '' }} />

              {draft.files.length > 0 && (
                <ul className="border border-line rounded-lg divide-y divide-line-soft mb-2">
                  {draft.files.map((f, i) => (
                    <li key={f.key} className="flex items-center gap-3 p-2.5">
                      <div className="w-14 h-14 rounded-md bg-limestone overflow-hidden shrink-0 flex items-center justify-center">
                        {f.thumb ? <img src={f.thumb} alt="" className="w-full h-full object-cover" /> : <KindIcon kind={f.kind} className="w-5 h-5 text-stone" />}
                      </div>
                      <div className="min-w-0 flex-1 text-sm [overflow-wrap:anywhere]">
                        <p className="text-basalt">{f.name}</p>
                        <p className="text-xs text-stone">
                          {[sizeLabel(f.size),
                            f.facts?.width ? `${f.facts.width} × ${f.facts.height} px` : f.existing?.width ? `${f.existing.width} × ${f.existing.height} px` : '',
                            f.kind === 'video' ? durationLabel(f.facts?.duration ?? f.existing?.duration_s) : '',
                            f.file ? 'uploads when you save' : ''].filter(Boolean).join(' · ')}
                        </p>
                        {f.progress !== undefined && (
                          <div className="h-1.5 bg-track rounded-full mt-1.5 overflow-hidden" role="progressbar" aria-valuenow={Math.round(f.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full bg-molten" style={{ width: `${Math.round(f.progress * 100)}%` }} />
                          </div>
                        )}
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                          {f.kind === 'video' && (
                            <button type="button" className="text-xs text-molten-ink hover:underline min-h-[28px]" onClick={() => { setCoverFor(f.key); coverInput.current?.click() }}>
                              {f.newCover ? 'Cover changed' : 'Upload a cover'}
                            </button>
                          )}
                          {f.existing && (
                            <button type="button" className="text-xs text-molten-ink hover:underline min-h-[28px]" onClick={() => { setReplaceFor(f.key); replaceInput.current?.click() }}>Replace</button>
                          )}
                          {f.existing && (
                            <button type="button" className="text-xs text-molten-ink hover:underline min-h-[28px]" onClick={() => openFile(f.existing!.file_path)}>View</button>
                          )}
                        </div>
                      </div>
                      {draft.files.length > 1 && (
                        <div className="flex flex-col">
                          <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => moveFile(f.key, -1)} className="w-9 h-9 flex items-center justify-center disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                          <button type="button" aria-label="Move later" disabled={i === draft.files.length - 1} onClick={() => moveFile(f.key, 1)} className="w-9 h-9 flex items-center justify-center disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                        </div>
                      )}
                      <button type="button" aria-label={`Remove ${f.name}`} onClick={() => removeFile(f.key)} className="w-10 h-10 flex items-center justify-center text-stone hover:text-danger"><X className="w-4 h-4" /></button>
                    </li>
                  ))}
                </ul>
              )}

              {draft.files.length < SECTION_MAX_FILES[draft.section] && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files) }}
                  className={`border-2 border-dashed rounded-xl p-5 text-center ${dragOver ? 'border-molten bg-molten-tint' : 'border-line'}`}
                >
                  <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="gap-2">
                    <Upload className="w-4 h-4" /> {draft.files.length ? 'Add more' : 'Choose files'}
                  </Button>
                  <p className="text-xs text-stone mt-2 hidden sm:block">or drag them here</p>
                </div>
              )}
              {draft.section === 'social' && new Set(draft.files.map(f => formatFromSize(f.facts?.width ?? f.existing?.width, f.facts?.height ?? f.existing?.height)).filter(Boolean)).size > 1 && (
                <p className="text-xs text-danger mt-1.5 flex gap-1.5" role="alert"><AlertTriangle className="w-4 h-4 shrink-0" /> These images are different shapes. Instagram crops a carousel to the shape of the first image, so use the same shape for all of them.</p>
              )}
              {!draft.isNew && draft.files.some(f => f.existing) && (
                <p className="text-xs text-stone mt-1.5">Replacing or removing a file keeps the old one below for reference; installers only see the new one.</p>
              )}
            </div>

            {(draft.section === 'social' || draft.section === 'videos') && (
              <>
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="m-caption" className="block text-sm font-medium text-ink mb-1">Caption</label>
                    <span className={`text-xs ${draft.caption.length + (draft.hashtags ? draft.hashtags.length + 2 : 0) > CAPTION_MAX ? 'text-danger' : 'text-stone'}`}>
                      {(draft.caption.length + (draft.hashtags ? draft.hashtags.length + 2 : 0)).toLocaleString('en-GB')} / {CAPTION_MAX.toLocaleString('en-GB')} with hashtags
                    </span>
                  </div>
                  <textarea id="m-caption" rows={5} maxLength={CAPTION_MAX} className={`${inputCls} py-2.5`} value={draft.caption}
                    placeholder="Suggested post text. Include @magmacoatings where you want it tagged." onChange={e => set('caption', e.target.value)} />
                </div>
                <div>
                  <label htmlFor="m-tags" className="block text-sm font-medium text-ink mb-1">Hashtags</label>
                  <input id="m-tags" className={inputCls} maxLength={500} value={draft.hashtags} onChange={e => set('hashtags', e.target.value)} />
                  <p className="text-xs text-stone mt-1">Copied under the caption. New items start with the default set from Settings.</p>
                </div>
                <div>
                  <label htmlFor="m-format" className="block text-sm font-medium text-ink mb-1">Format</label>
                  <select id="m-format" className={inputCls} value={draft.format} onChange={e => set('format', e.target.value as MediaFormat | '')}>
                    <option value="">Not set</option>
                    {(Object.keys(FORMAT_LABELS) as MediaFormat[]).map(f => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
                  </select>
                  <p className="text-xs text-stone mt-1">Filled in from the first file.</p>
                </div>
              </>
            )}

            {(draft.section === 'architects' || draft.section === 'logos' || draft.section === 'pack') && (
              <div>
                <label htmlFor="m-desc" className="block text-sm font-medium text-ink mb-1">Short description <span className="font-normal text-stone">(optional)</span></label>
                <textarea id="m-desc" rows={2} maxLength={300} className={`${inputCls} py-2.5`} value={draft.description} onChange={e => set('description', e.target.value)} />
              </div>
            )}

            <div>
              <label htmlFor="m-credit" className="block text-sm font-medium text-ink mb-1">Credit line <span className="font-normal text-stone">(optional)</span></label>
              <input id="m-credit" className={inputCls} maxLength={120} value={draft.credit} placeholder="e.g. Please tag @magmacoatings, or Photo: Smith Interiors" onChange={e => set('credit', e.target.value)} />
            </div>

            <details className="border border-line rounded-lg">
              <summary className="px-3 py-3 text-sm font-medium text-ink cursor-pointer min-h-[44px]">
                Products and systems <span className="font-normal text-stone">({draft.productIds.length + draft.systemIds.length} linked, optional)</span>
              </summary>
              <div className="px-3 pb-3 space-y-3">
                <p className="text-xs text-stone">Used later to show "Media for this system" in the calculator.</p>
                <input className={inputCls} placeholder="Search products" value={productSearch} onChange={e => setProductSearch(e.target.value)} aria-label="Search products" />
                <div className="max-h-40 overflow-y-auto border border-line rounded-lg divide-y divide-line-soft">
                  {products.filter(p => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.trim().toLowerCase())).map(p => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px] cursor-pointer hover:bg-limestone">
                      <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={() => toggleId('productIds', p.id)} className="w-4 h-4 accent-molten" />
                      <span className="text-sm text-basalt">{p.name}</span>
                    </label>
                  ))}
                </div>
                <div className="border border-line rounded-lg divide-y divide-line-soft">
                  {systems.map(s => (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px] cursor-pointer hover:bg-limestone">
                      <input type="checkbox" checked={draft.systemIds.includes(s.id)} onChange={() => toggleId('systemIds', s.id)} className="w-4 h-4 accent-molten" />
                      <span className="text-sm text-basalt">{s.name}{s.group ? <span className="text-stone"> · {s.group}</span> : null}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>

            <fieldset className="bg-limestone rounded-xl p-4 space-y-3">
              <legend className="text-sm font-medium text-ink px-1">Checks before publishing</legend>
              <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                <input type="checkbox" className="w-5 h-5 mt-0.5 accent-molten shrink-0" checked={draft.check_watermark} onChange={e => set('check_watermark', e.target.checked)} />
                <span className="text-sm text-basalt">This file carries the Magma watermark or credit</span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer min-h-[44px]">
                <input type="checkbox" className="w-5 h-5 mt-0.5 accent-molten shrink-0" checked={draft.check_permission} onChange={e => set('check_permission', e.target.checked)} />
                <span className="text-sm text-basalt">We have permission to use this photo or video (client agreed, photographer credited)</span>
              </label>
            </fieldset>

            {replaced.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-2">Replaced files <span className="font-normal text-stone">(admin reference only)</span></p>
                <ul className="border border-line rounded-lg divide-y divide-line-soft">
                  {replaced.map(v => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="text-ink [overflow-wrap:anywhere]">{v.file_name}<span className="text-stone"> · replaced {fmtDate(v.replaced_at)}</span></span>
                      <Button size="sm" variant="ghost" onClick={() => openFile(v.file_path)}>View</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formError && <p className="text-sm text-danger" role="alert">{formError}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-line">
              {!draft.isNew ? (
                <Button variant="ghost" onClick={remove} disabled={saving} className="gap-1.5 text-danger"><Trash2 className="w-4 h-4" /> Delete</Button>
              ) : <span />}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => save('draft')} disabled={saving}>
                  {saving ? 'Saving…' : draft.status === 'published' ? 'Unpublish (draft)' : 'Save as draft'}
                </Button>
                <Button onClick={() => save('published')} disabled={saving || !draft.check_watermark || !draft.check_permission || draft.files.length === 0}
                  title={!draft.check_watermark || !draft.check_permission ? 'Tick both checks to publish' : undefined}>
                  {saving ? 'Uploading…' : draft.status === 'published' ? 'Save' : 'Publish'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- See who ---- */}
      {whoFor && (
        <div className="fixed inset-0 z-[70] bg-basalt/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label="Who used this item" onClick={() => setWhoFor(null)}>
          <div className="bg-bone w-full sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-basalt [overflow-wrap:anywhere]">{whoFor.title}</h2>
              <button aria-label="Close" onClick={() => setWhoFor(null)} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>
            {who === null ? <div className="flex justify-center py-6"><MagmaSpinner size={32} /></div>
              : who.length === 0 ? <p className="text-sm text-stone">Nobody has opened or saved this yet.</p>
              : (
                <ul className="divide-y divide-line-soft">
                  {who.map(p => (
                    <li key={p.user_id} className="py-2.5 text-sm">
                      <p className="font-medium text-basalt">{p.name}{p.company && <span className="font-normal text-stone"> · {p.company}</span>}</p>
                      <p className="text-xs text-stone mt-0.5">
                        {[p.saves && `Saved ${p.saves}`, p.captions && `Caption ${p.captions}`, p.downloads && `Downloaded ${p.downloads}`, p.shares && `Shared ${p.shares}`, p.views && `Viewed ${p.views}`]
                          .filter(Boolean).join(' · ')} · last {fmtDate(p.last_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---- Campaigns ------------------------------------------------------------------------
function CampaignsTab({ campaigns, items, enabled, onChanged, onTell, flash }: {
  campaigns: MediaCampaign[]; items: MediaItem[]; enabled: boolean; onChanged: () => void
  onTell: (c: MediaCampaign) => void; flash: (m: string) => void
}) {
  const [name, setName] = useState('')
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10))
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')

  async function add() {
    if (!name.trim()) return
    const { error } = await supabase.from('media_campaigns').insert({ name: name.trim(), starts_on: startsOn })
    if (error) flash('Could not add: ' + error.message)
    else { setName(''); onChanged() }
  }
  async function saveEdit(id: string) {
    const { error } = await supabase.from('media_campaigns').update({ name: editName.trim(), starts_on: editStart }).eq('id', id)
    if (error) flash('Could not save: ' + error.message)
    else { setEditing(null); onChanged() }
  }
  async function remove(c: MediaCampaign) {
    if (!window.confirm(`Delete the campaign "${c.name}"?\n\nIts items are kept; they just won't belong to a campaign.`)) return
    const { error } = await supabase.from('media_campaigns').delete().eq('id', c.id)
    if (error) flash('Could not delete: ' + error.message)
    else onChanged()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-stone">Installers see the newest campaign first (by start date). Items published in the last 14 days show a New badge.</p>
      <div className="bg-bone border border-line rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="c-name" className="block text-sm font-medium text-ink mb-1">New campaign</label>
          <input id="c-name" className={inputCls} maxLength={80} value={name} placeholder="e.g. Spring launch" onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label htmlFor="c-start" className="block text-sm font-medium text-ink mb-1">Starts</label>
          <input id="c-start" type="date" className={inputCls} value={startsOn} onChange={e => setStartsOn(e.target.value)} />
        </div>
        <Button onClick={add} disabled={!name.trim()} className="gap-2"><Plus className="w-4 h-4" /> Add</Button>
      </div>
      <ul className="bg-bone border border-line rounded-xl divide-y divide-line-soft">
        {campaigns.length === 0 && <li className="p-4 text-sm text-stone">No campaigns yet.</li>}
        {campaigns.map(c => {
          const its = items.filter(i => i.campaign_id === c.id)
          const published = its.filter(i => i.status === 'published').length
          return (
            <li key={c.id} className="p-4">
              {editing === c.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <input className={`${inputCls} flex-1 min-w-[160px]`} value={editName} maxLength={80} onChange={e => setEditName(e.target.value)} aria-label="Campaign name" />
                  <input type="date" className={`${inputCls} w-auto`} value={editStart} onChange={e => setEditStart(e.target.value)} aria-label="Start date" />
                  <Button size="sm" onClick={() => saveEdit(c.id)} disabled={!editName.trim()}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0 [overflow-wrap:anywhere]">
                    <p className="font-medium text-basalt">{c.name}</p>
                    <p className="text-xs text-stone">Starts {fmtDate(c.starts_on)} · {published} published, {its.length - published} draft</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c.id); setEditName(c.name); setEditStart(c.starts_on) }}>Edit</Button>
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => onTell(c)} disabled={!enabled || published === 0}
                    title={!enabled ? 'Switch the Media pack on first' : published === 0 ? 'Publish something in this campaign first' : undefined}>
                    <Bell className="w-4 h-4" /> Tell installers
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {!enabled && <p className="text-xs text-stone">Tell installers is available once the Media pack is switched on, so no alert gives it away early.</p>}
    </div>
  )
}

// ---- Settings: launch switch, defaults, usage terms ----------------------------------------
function SettingsTab({ settings, terms, onChanged, flash, onTell }: {
  settings: Settings; terms: Terms | null; onChanged: () => void; flash: (m: string) => void; onTell: () => void
}) {
  const [hashtags, setHashtags] = useState(settings.default_hashtags)
  const [credit, setCredit] = useState(settings.default_credit)
  const [confirmOn, setConfirmOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [editTerms, setEditTerms] = useState(false)
  const [termsTitle, setTermsTitle] = useState(terms?.title || 'Magma Media pack: terms of use')
  const [termsBody, setTermsBody] = useState(terms?.body || '')
  const [agreements, setAgreements] = useState<AgreementRow[] | null>(null)
  const [showPeople, setShowPeople] = useState(false)

  useEffect(() => {
    supabase.rpc('media_terms_agreements').then(({ data }) => setAgreements((data as AgreementRow[]) || []))
  }, [terms?.version])

  async function setEnabled(on: boolean) {
    setBusy(true)
    const { error } = await supabase.from('media_settings')
      .update({ media_pack_enabled: on, ...(on ? { enabled_at: new Date().toISOString() } : {}), updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    setConfirmOn(false)
    if (error) { flash('Could not change the switch: ' + error.message); return }
    clearMediaAccess()
    flash(on ? 'The Media pack is now visible to installers.' : 'The Media pack is hidden from installers again. Nothing has been deleted.')
    onChanged()
  }

  async function saveDefaults() {
    const { error } = await supabase.from('media_settings').update({ default_hashtags: hashtags.trim(), default_credit: credit.trim(), updated_at: new Date().toISOString() }).eq('id', 1)
    if (error) flash('Could not save: ' + error.message)
    else { flash('Defaults saved. They apply to new items.'); onChanged() }
  }

  async function publishTerms() {
    if (!termsTitle.trim() || !termsBody.trim()) return
    if (!window.confirm('Publish these terms as a new version?\n\nEvery installer will be asked to agree again before they can use the Media pack.')) return
    const { error } = await supabase.from('media_terms').insert({ version: (terms?.version || 0) + 1, title: termsTitle.trim(), body: termsBody.trim() })
    if (error) { flash('Could not publish: ' + error.message); return }
    setEditTerms(false)
    clearMediaAccess()
    flash('New terms published. Installers will be asked to agree on their next visit.')
    onChanged()
  }

  const onCurrent = (agreements || []).filter(a => terms && a.version >= terms.version).length

  return (
    <div className="max-w-3xl space-y-5">
      <section className="bg-bone border border-line rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 className="font-medium text-basalt">Show Media pack to installers</h2>
            <p className="text-sm text-stone mt-1">
              {settings.media_pack_enabled
                ? 'On: every active installer sees the Media tab. Turning it off hides it instantly; nothing is deleted.'
                : 'Off: installers see no Media tab, link or alert. Admins see it with a preview banner.'}
            </p>
          </div>
          <Toggle on={settings.media_pack_enabled} disabled={busy} label="Show Media pack to installers"
            onChange={v => v ? setConfirmOn(true) : setEnabled(false)} />
        </div>
        {confirmOn && (
          <div className="mt-4 bg-molten-tint rounded-lg p-4 text-sm text-basalt space-y-3">
            <p><strong>Ready to launch?</strong> Every active installer will see the Media tab straight away. Before switching on:</p>
            <ol className="list-decimal pl-5 space-y-1 text-ink">
              <li>The first campaign is uploaded and published.</li>
              <li>You have checked the Media tab on a phone and a computer.</li>
              <li>The usage terms below are the approved wording.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEnabled(true)} disabled={busy}>Switch on now</Button>
              <Button variant="outline" onClick={() => setConfirmOn(false)}>Not yet</Button>
            </div>
          </div>
        )}
        {settings.media_pack_enabled && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={onTell}><Bell className="w-4 h-4" /> Tell installers</Button>
            <span className="text-xs text-stone">Opens a pre-filled phone alert linking to the Media tab.</span>
          </div>
        )}
      </section>

      <section className="bg-bone border border-line rounded-xl p-5 space-y-4">
        <h2 className="font-medium text-basalt">Defaults for new items</h2>
        <div>
          <label htmlFor="s-tags" className="block text-sm font-medium text-ink mb-1">Standard hashtags</label>
          <textarea id="s-tags" rows={2} maxLength={500} className={`${inputCls} py-2.5`} value={hashtags} onChange={e => setHashtags(e.target.value)} />
        </div>
        <div>
          <label htmlFor="s-credit" className="block text-sm font-medium text-ink mb-1">Standard credit line</label>
          <input id="s-credit" className={inputCls} maxLength={120} value={credit} onChange={e => setCredit(e.target.value)} />
        </div>
        <Button variant="outline" onClick={saveDefaults}>Save defaults</Button>
      </section>

      <section className="bg-bone border border-line rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium text-basalt">Usage terms {terms && <span className="text-sm font-normal text-stone">· version {terms.version}, {fmtDate(terms.created_at)}</span>}</h2>
          {!editTerms && <Button size="sm" variant="outline" className="gap-1" onClick={() => { setTermsTitle(terms?.title || termsTitle); setTermsBody(terms?.body || ''); setEditTerms(true) }}><RefreshCw className="w-4 h-4" /> Update terms</Button>}
        </div>
        <p className="text-sm text-stone">
          Installers agree before first use; the date and version are recorded.
          {agreements && terms ? ` ${onCurrent} ${onCurrent === 1 ? 'person has' : 'people have'} agreed to the current version.` : ''}
          {agreements && agreements.length > 0 && (
            <button type="button" className="ml-1 text-molten-ink hover:underline" onClick={() => setShowPeople(s => !s)}>{showPeople ? 'Hide' : 'See who'}</button>
          )}
        </p>
        {showPeople && agreements && (
          <ul className="border border-line rounded-lg divide-y divide-line-soft text-sm">
            {agreements.map(a => (
              <li key={a.user_id} className="px-3 py-2 flex flex-wrap justify-between gap-2">
                <span className="text-basalt">{a.name}{a.company && <span className="text-stone"> · {a.company}</span>}</span>
                <span className="text-stone">Version {a.version}, {fmtDate(a.agreed_at)}{terms && a.version < terms.version ? ' (needs to agree again)' : ''}</span>
              </li>
            ))}
          </ul>
        )}
        {editTerms ? (
          <div className="space-y-3">
            <input className={inputCls} value={termsTitle} maxLength={120} onChange={e => setTermsTitle(e.target.value)} aria-label="Terms title" />
            <textarea rows={14} maxLength={8000} className={`${inputCls} py-2.5 font-normal`} value={termsBody} onChange={e => setTermsBody(e.target.value)} aria-label="Terms wording" />
            <p className="text-xs text-stone">Publishing saves a new version. Every installer is asked to agree again on their next visit.</p>
            <div className="flex gap-2">
              <Button onClick={publishTerms} disabled={!termsBody.trim()}>Publish new version</Button>
              <Button variant="outline" onClick={() => setEditTerms(false)}>Cancel</Button>
            </div>
          </div>
        ) : terms ? (
          <div className="bg-limestone rounded-lg p-4 text-sm text-ink whitespace-pre-line max-h-80 overflow-y-auto">
            <p className="font-medium text-basalt mb-2">{terms.title}</p>
            {terms.body}
          </div>
        ) : <p className="text-sm text-danger">No terms set: installers cannot use the Media pack until terms are published.</p>}
      </section>

      <p className="text-xs text-stone flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Preview the installer view from the <a href="/media" className="text-molten-ink hover:underline inline-flex items-center gap-0.5">Media tab <ExternalLink className="w-3 h-3" /></a>.</p>
    </div>
  )
}
