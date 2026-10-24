// Installers: the Media pack. Ready-made posts, videos, architect material and logos to save and share.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import {
  Images, Play, FileText, Archive, X, Download, Copy, Check, Share2, ChevronLeft, ChevronRight, HelpCircle, Eye,
  AlertTriangle, Smartphone, Instagram, ClipboardPaste,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import { useMediaAccess } from '@/hooks/useMediaAccess'
import {
  FILE_COLUMNS, ITEM_COLUMNS, SECTION_LABELS, SECTION_LONG, SECTION_ORDER, downloadFile, durationLabel, fullCaption, isNew,
  logMediaEvent, mediaShareUrl, prefersShareSheet, saveToPhone, shareFetched, signMedia, sizeLabel,
  type MediaCampaign, type MediaFile, type MediaItem, type MediaSection,
} from '@/lib/media'

type Filter = 'all' | MediaSection

function tileFile(files: MediaFile[]) { return files[0] }

export function MediaPage() {
  const { access, loading: accessLoading, refresh } = useMediaAccess()
  const [params, setParams] = useSearchParams()
  const [items, setItems] = useState<MediaItem[] | null>(null)
  const [files, setFiles] = useState<MediaFile[]>([])
  const [campaigns, setCampaigns] = useState<MediaCampaign[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [loadError, setLoadError] = useState(false)
  const openId = params.get('item')

  const canBrowse = access.visible && access.agreed

  useEffect(() => {
    if (!canBrowse) return
    let live = true
    async function load() {
      const [it, fi, ca] = await Promise.all([
        supabase.from('media_items').select(ITEM_COLUMNS).eq('status', 'published').order('pinned', { ascending: false }).order('display_order'),
        supabase.from('media_files').select(FILE_COLUMNS).eq('is_current', true).order('position'),
        supabase.from('media_campaigns').select('id, name, starts_on, display_order').order('starts_on', { ascending: false }),
      ])
      if (!live) return
      if (it.error || fi.error) { setLoadError(true); setItems([]); return }
      const fileRows = (fi.data as MediaFile[]) || []
      setItems((it.data as MediaItem[]) || [])
      setFiles(fileRows)
      setCampaigns((ca.data as MediaCampaign[]) || [])
      // Grids load small previews, not the full files
      const paths = fileRows.map(f => f.preview_path || '').filter(Boolean)
      setPreviews(await signMedia(paths))
    }
    load()
    const timer = window.setInterval(load, 45 * 60 * 1000) // keep links fresh while open
    return () => { live = false; window.clearInterval(timer) }
  }, [canBrowse])

  const filesOf = useMemo(() => {
    const m = new Map<string, MediaFile[]>()
    for (const f of files) m.set(f.item_id, [...(m.get(f.item_id) || []), f])
    m.forEach(list => list.sort((a, b) => a.position - b.position))
    return m
  }, [files])

  // Newest campaign first; items without a campaign last
  const groups = useMemo(() => {
    if (!items) return []
    const visible = items.filter(i => (filter === 'all' || i.section === filter) && (filesOf.get(i.id)?.length || 0) > 0)
    const sortItems = (list: MediaItem[]) => [...list].sort((a, b) =>
      SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section) || Number(b.pinned) - Number(a.pinned) || a.display_order - b.display_order)
    const out: { key: string; title: string; list: MediaItem[] }[] = []
    for (const c of campaigns) {
      const list = visible.filter(i => i.campaign_id === c.id)
      if (list.length) out.push({ key: c.id, title: c.name, list: sortItems(list) })
    }
    const rest = visible.filter(i => !i.campaign_id || !campaigns.some(c => c.id === i.campaign_id))
    if (rest.length) out.push({ key: 'rest', title: out.length ? 'More' : '', list: sortItems(rest) })
    return out
  }, [items, filter, campaigns, filesOf])

  const hasPack = !!items?.some(i => i.section === 'pack')
  const filters: Filter[] = ['all', 'social', 'videos', 'architects', 'logos', ...(hasPack ? ['pack' as Filter] : [])]
  const openItem = items?.find(i => i.id === openId) || null

  const setOpen = (id: string | null) => setParams(p => { if (id) p.set('item', id); else p.delete('item'); return p })

  if (accessLoading) return <div className="flex justify-center py-16"><MagmaSpinner size={40} /></div>
  // Hidden: behave as if the page doesn't exist
  if (!access.visible) return <Navigate to="/" replace />

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-28 lg:pb-8">
      {access.admin && !access.enabled && (
        <div className="mb-4 rounded-xl bg-molten text-white px-4 py-3 text-sm font-medium flex items-center gap-2" role="status">
          <Eye className="w-4 h-4 shrink-0" /> Preview: installers cannot see this yet
        </div>
      )}

      <h1 className="text-xl font-medium text-basalt">Media pack</h1>
      <p className="text-sm text-stone mt-1">Ready-made posts, videos and documents to promote your Magma work. Save them to your phone and share.</p>

      {!access.agreed ? (
        <TermsPrompt version={access.terms_version || 0} title={access.terms_title || ''} body={access.terms_body || ''} onAgreed={refresh} />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mt-4" role="group" aria-label="Show">
            {filters.map(f => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}
                className={`min-h-[40px] px-3.5 rounded-full text-sm ${filter === f ? 'bg-basalt text-bone font-medium border border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}>
                {f === 'all' ? 'All' : SECTION_LABELS[f]}
              </button>
            ))}
          </div>

          {items === null ? (
            <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>
          ) : loadError ? (
            <p className="text-sm text-danger mt-6">The Media pack could not load. Please check your connection and reload.</p>
          ) : groups.length === 0 ? (
            <div className="bg-bone border border-line rounded-xl p-8 text-center mt-6">
              <Images className="w-8 h-8 text-ash mx-auto mb-3" aria-hidden="true" />
              <p className="font-medium text-basalt">{filter === 'all' ? 'New content is on its way' : `Nothing in ${SECTION_LABELS[filter as MediaSection]} yet`}</p>
              <p className="text-sm text-stone mt-1">You'll get an alert when the next posts are ready.</p>
            </div>
          ) : (
            groups.map(g => (
              <section key={g.key} className="mt-6" aria-labelledby={`g-${g.key}`}>
                {g.title && <h2 id={`g-${g.key}`} className="text-xs font-semibold text-stone uppercase tracking-wide mb-2">{g.title}</h2>}
                <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {g.list.map(item => {
                    const fs = filesOf.get(item.id) || []
                    const f = tileFile(fs)
                    const pv = f?.preview_path ? previews[f.preview_path] : undefined
                    return (
                      <li key={item.id}>
                        <button type="button" onClick={() => { setOpen(item.id); logMediaEvent(item.id, 'view') }}
                          className="w-full text-left bg-bone border border-line rounded-xl overflow-hidden hover:border-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-molten/40">
                          <div className="aspect-square bg-limestone relative flex items-center justify-center">
                            {pv ? <img src={pv} alt="" loading="lazy" className={`w-full h-full ${item.section === 'logos' ? 'object-contain p-4' : 'object-cover'}`} />
                              : f?.kind === 'zip' ? <Archive className="w-10 h-10 text-stone" aria-hidden="true" />
                              : f?.kind === 'document' ? <FileText className="w-10 h-10 text-stone" aria-hidden="true" />
                              : <Images className="w-10 h-10 text-ash" aria-hidden="true" />}
                            {f?.kind === 'video' && (
                              <>
                                <span className="absolute inset-0 flex items-center justify-center"><span className="w-11 h-11 rounded-full bg-basalt/60 flex items-center justify-center"><Play className="w-5 h-5 text-white ml-0.5" /></span></span>
                                {f.duration_s ? <span className="absolute bottom-2 right-2 bg-basalt/75 text-white text-xs font-medium px-1.5 py-0.5 rounded">{durationLabel(f.duration_s)}</span> : null}
                              </>
                            )}
                            {fs.length > 1 && item.section === 'social' && (
                              <span className="absolute top-2 right-2 bg-basalt/75 text-white text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-1"><Images className="w-3 h-3" /> {fs.length}</span>
                            )}
                            {isNew(item) && <span className="absolute top-2 left-2 bg-molten text-white text-xs font-semibold px-2 py-0.5 rounded-full">New</span>}
                          </div>
                          <div className="p-2.5">
                            <p className="text-sm font-medium text-basalt line-clamp-2 [overflow-wrap:anywhere]">{item.title}</p>
                            <p className="text-xs text-stone mt-0.5">{SECTION_LABELS[item.section]}{f?.kind === 'document' ? ` · ${fs.map(x => /docx$/i.test(x.file_name) ? 'Word' : 'PDF').join(' + ')}` : ''}</p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}

      {openItem && canBrowse && (
        <Viewer item={openItem} files={filesOf.get(openItem.id) || []} previews={previews} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

// ---- Usage terms ----------------------------------------------------------------------
function TermsPrompt({ version, title, body, onAgreed }: { version: number; title: string; body: string; onAgreed: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function agree() {
    setBusy(true)
    setError(null)
    const { error: e } = await supabase.rpc('agree_media_terms', { p_version: version })
    if (e) { setError(e.message); setBusy(false); return }
    await onAgreed()
    setBusy(false)
  }
  if (!version) {
    return <p className="mt-6 text-sm text-stone">The Media pack is being prepared. Please check back soon.</p>
  }
  return (
    <section className="mt-5 bg-bone border border-line rounded-xl p-5 sm:p-6 max-w-2xl" aria-labelledby="terms-title">
      <h2 id="terms-title" className="font-medium text-basalt">{title}</h2>
      <p className="text-sm text-stone mt-1">Please read and agree before using the Media pack. You'll only be asked again if the terms change.</p>
      <div className="mt-4 text-sm text-ink whitespace-pre-line leading-relaxed max-h-[50vh] overflow-y-auto border-y border-line-soft py-3">{body}</div>
      {error && <p className="text-sm text-danger mt-3" role="alert">{error}</p>}
      <Button size="lg" className="w-full sm:w-auto mt-4" onClick={agree} disabled={busy}>{busy ? 'Saving…' : 'I agree'}</Button>
    </section>
  )
}

// ---- One item, full size ------------------------------------------------------------------
function Viewer({ item, files, previews, onClose }: { item: MediaItem; files: MediaFile[]; previews: Record<string, string>; onClose: () => void }) {
  const [view, setView] = useState<Record<string, string>>({})
  const [dl, setDl] = useState<Record<string, string>>({})
  const [index, setIndex] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [pending, setPending] = useState<File[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [help, setHelp] = useState(false)
  const [shareMsg, setShareMsg] = useState<Record<string, string>>({})
  const strip = useRef<HTMLDivElement>(null)
  const closeBtn = useRef<HTMLButtonElement>(null)

  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Full-size links for this item only (the grid uses small previews)
  useEffect(() => {
    let live = true
    const paths = files.map(f => f.file_path)
    Promise.all([signMedia(paths), signMedia(paths, true)]).then(([v, d]) => { if (live) { setView(v); setDl(d) } })
    return () => { live = false }
  }, [files])

  useEffect(() => {
    closeBtn.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [])

  const isVisual = item.section === 'social' || item.section === 'videos'
  const caption = fullCaption(item)
  const ready = files.every(f => view[f.file_path] && dl[f.file_path])
  const flash = (m: string) => { setMessage(m); window.setTimeout(() => setMessage(x => (x === m ? null : x)), 4000) }

  function goTo(i: number) {
    const el = strip.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  async function save() {
    if (!ready) return
    setMessage(null)
    try {
      setProgress(0)
      const out = await saveToPhone(files.map(f => ({ url: view[f.file_path], downloadUrl: dl[f.file_path], name: f.file_name, type: f.mime_type, size: f.file_size })), p => setProgress(p))
      setProgress(null)
      if (out.result === 'needs-tap') { setPending(out.files); return }
      if (out.result === 'cancelled') return
      logMediaEvent(item.id, out.result === 'shared' ? 'save' : 'download')
      flash(out.result === 'shared' ? 'Saved.' : files.length > 1 ? `${files.length} files downloading.` : 'Downloading.')
    } catch (e) {
      setProgress(null)
      flash((e as Error).message || 'Could not save. Please try again.')
    }
  }

  async function savePending() {
    if (!pending) return
    const r = await shareFetched(pending)
    setPending(null)
    if (r === 'shared') { logMediaEvent(item.id, 'save'); flash('Saved.') }
    else if (r === 'refused') {
      for (const f of files) downloadFile(dl[f.file_path], f.file_name)
      logMediaEvent(item.id, 'download')
      flash('Your phone would not open the share options, so the file is downloading instead.')
    }
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      logMediaEvent(item.id, 'caption')
      window.setTimeout(() => setCopied(false), 2500)
    } catch { flash('Could not copy. Press and hold the caption to copy it instead.') }
  }

  async function shareLink(f: MediaFile) {
    const { data, error } = await supabase.from('media_shares').insert({ file_id: f.id }).select('token, expires_at').single()
    if (error || !data) { flash('Could not create a link. Please try again.'); return }
    const url = mediaShareUrl(data.token)
    const until = new Date(data.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    logMediaEvent(item.id, 'share')
    if (prefersShareSheet() && navigator.share) {
      try { await navigator.share({ title: item.title, url }); setShareMsg(m => ({ ...m, [f.id]: `Link works until ${until}.` })); return } catch { /* fall back to copying */ }
    }
    try {
      await navigator.clipboard.writeText(url)
      setShareMsg(m => ({ ...m, [f.id]: `Link copied. It works until ${until}, no login needed.` }))
    } catch {
      setShareMsg(m => ({ ...m, [f.id]: url }))
    }
  }

  const saveLabel = item.section === 'videos' ? 'Save video to phone' : files.length > 1 ? `Save all ${files.length} images` : 'Save to phone'

  return (
    <div className="fixed inset-0 z-[80] bg-basalt/70 flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={item.title} onClick={onClose}>
      <div className="bg-bone w-full sm:max-w-3xl sm:rounded-2xl overflow-y-auto max-h-full sm:max-h-[94vh] flex flex-col lg:flex-row" onClick={e => e.stopPropagation()}>
        {/* Media */}
        <div className={`bg-basalt shrink-0 relative ${isVisual ? 'lg:w-[55%]' : 'lg:w-[30%]'}`}>
          <button ref={closeBtn} aria-label="Close" onClick={onClose}
            className="absolute top-3 right-3 z-10 w-11 h-11 rounded-full bg-basalt/70 text-white flex items-center justify-center lg:hidden"><X className="w-5 h-5" /></button>
          {isVisual ? (
            item.section === 'videos' ? (
              <video className="w-full max-h-[70vh] bg-black" controls playsInline preload="metadata"
                poster={files[0]?.preview_path ? previews[files[0].preview_path] : undefined} src={view[files[0]?.file_path]} />
            ) : (
              <>
                <div ref={strip} className="flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none]"
                  onScroll={e => { const el = e.currentTarget; setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))) }}>
                  {files.map((f, i) => (
                    <div key={f.id} className="w-full shrink-0 snap-center flex items-center justify-center min-h-[300px] max-h-[70vh]">
                      <img src={view[f.file_path] || (f.preview_path ? previews[f.preview_path] : undefined)} alt={`${item.title}${files.length > 1 ? `, image ${i + 1} of ${files.length}` : ''}`}
                        className="max-w-full max-h-[70vh] object-contain" />
                    </div>
                  ))}
                </div>
                {files.length > 1 && (
                  <>
                    <button aria-label="Previous image" onClick={() => goTo(Math.max(0, index - 1))} disabled={index === 0}
                      className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bone/80 items-center justify-center disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
                    <button aria-label="Next image" onClick={() => goTo(Math.min(files.length - 1, index + 1))} disabled={index === files.length - 1}
                      className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-bone/80 items-center justify-center disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5" aria-hidden="true">
                      {files.map((f, i) => <span key={f.id} className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />)}
                    </div>
                  </>
                )}
              </>
            )
          ) : (
            <div className="min-h-[180px] flex items-center justify-center p-6">
              {files[0]?.preview_path && previews[files[0].preview_path]
                ? <img src={previews[files[0].preview_path]} alt="" className="max-h-[40vh] object-contain" />
                : files[0]?.mime_type === 'image/png' && view[files[0].file_path]
                  ? <img src={view[files[0].file_path]} alt="" className="max-h-[40vh] object-contain" />
                  : item.section === 'pack' ? <Archive className="w-16 h-16 text-bone/70" /> : <FileText className="w-16 h-16 text-bone/70" />}
            </div>
          )}
        </div>

        {/* Details and actions */}
        <div className="p-5 flex-1 min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-stone">{SECTION_LONG[item.section]}</p>
              <h2 className="text-lg font-medium text-basalt [overflow-wrap:anywhere]">{item.title}</h2>
            </div>
            <button aria-label="Close" onClick={onClose} className="hidden lg:flex w-11 h-11 items-center justify-center text-stone hover:text-basalt shrink-0"><X className="w-5 h-5" /></button>
          </div>
          {item.description && <p className="text-sm text-ink">{item.description}</p>}

          {isVisual && (
            <div className="space-y-2">
              {pending ? (
                <Button size="lg" className="w-full gap-2" onClick={savePending}><Smartphone className="w-5 h-5" /> Ready: tap to save</Button>
              ) : (
                <Button size="lg" className="w-full gap-2" onClick={save} disabled={!ready || progress !== null}>
                  <Download className="w-5 h-5" /> {progress !== null ? `Getting it ready… ${Math.round(progress * 100)}%` : saveLabel}
                </Button>
              )}
              {progress !== null && (
                <div className="h-1.5 bg-track rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-molten transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              )}
              <p className="text-xs text-stone">
                {prefersShareSheet() ? 'Your phone will offer Save Image or Save Video: it goes straight into your photos.' : 'On a computer the file downloads.'}
                {' '}{files.length > 1 ? `${files.length} images` : sizeLabel(files[0]?.file_size)}
              </p>
            </div>
          )}

          {isVisual && caption && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-ink">Caption</p>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={copyCaption} aria-live="polite">
                  {copied ? <><Check className="w-4 h-4 text-sage" /> Copied</> : <><Copy className="w-4 h-4" /> Copy caption</>}
                </Button>
              </div>
              <p className="text-sm text-ink whitespace-pre-line bg-limestone rounded-lg p-3 max-h-48 overflow-y-auto select-text [overflow-wrap:anywhere]">{caption}</p>
            </div>
          )}

          {item.credit && <p className="text-sm text-stone italic">{item.credit}</p>}

          {isVisual && (
            <div>
              <button type="button" className="text-sm text-molten-ink hover:underline inline-flex items-center gap-1 min-h-[36px]" onClick={() => setHelp(h => !h)} aria-expanded={help}>
                <HelpCircle className="w-4 h-4" /> How to post this
              </button>
              {help && <HowToPost video={item.section === 'videos'} />}
            </div>
          )}

          {!isVisual && (
            <ul className="space-y-3">
              {files.map(f => (
                <li key={f.id} className="border border-line rounded-xl p-3">
                  <p className="text-sm font-medium text-basalt flex items-center gap-2 [overflow-wrap:anywhere]">
                    {item.section === 'pack' ? <Archive className="w-4 h-4 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
                    {f.file_name}
                  </p>
                  <p className="text-xs text-stone mt-0.5">{/docx$/i.test(f.file_name) ? 'Word document' : f.mime_type === 'application/pdf' ? 'PDF' : f.mime_type === 'image/png' ? 'PNG image' : 'ZIP'} · {sizeLabel(f.file_size)}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(f.mime_type === 'application/pdf' || f.mime_type === 'image/png') && view[f.file_path] && (
                      <a className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone"
                        href={view[f.file_path]} target="_blank" rel="noopener noreferrer" onClick={() => logMediaEvent(item.id, 'view')}>
                        <Eye className="w-4 h-4" /> View
                      </a>
                    )}
                    <Button size="sm" className="gap-1.5 min-h-[40px]" disabled={!dl[f.file_path]}
                      onClick={() => { downloadFile(dl[f.file_path], f.file_name); logMediaEvent(item.id, 'download') }}>
                      <Download className="w-4 h-4" /> Download
                    </Button>
                    {item.section === 'architects' && (
                      <Button size="sm" variant="outline" className="gap-1.5 min-h-[40px]" onClick={() => shareLink(f)}>
                        <Share2 className="w-4 h-4" /> Share link
                      </Button>
                    )}
                  </div>
                  {shareMsg[f.id] && <p className="text-xs text-sage mt-2 [overflow-wrap:anywhere]" role="status">{shareMsg[f.id]}</p>}
                </li>
              ))}
              {item.section === 'architects' && (
                <li className="text-xs text-stone">Share link gives your architect or designer this one file without a login, for 30 days. You can also attach the downloaded file to an email.</li>
              )}
              {item.section === 'logos' && (
                <li className="text-xs text-stone flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 text-molten-ink" /> Please use the logo as supplied: do not alter, recolour, stretch or redraw it.</li>
              )}
            </ul>
          )}

          {message && <p className="text-sm text-basalt bg-limestone rounded-lg px-3 py-2" role="status">{message}</p>}
        </div>
      </div>
    </div>
  )
}

function HowToPost({ video }: { video: boolean }) {
  const steps = [
    { icon: Smartphone, title: video ? 'Save the video' : 'Save the picture', text: `Tap ${video ? 'Save video to phone' : 'Save to phone'}, then choose ${video ? 'Save Video' : 'Save Image'}. It goes into your photos.` },
    { icon: Copy, title: 'Copy the caption', text: 'Tap Copy caption. The text and hashtags are now ready to paste.' },
    { icon: Instagram, title: 'Post it', text: `Open Instagram, tap +, choose ${video ? 'Reel and pick the video' : 'Post and pick the picture'}, then press and hold in the caption box and tap Paste.` },
  ]
  return (
    <ol className="mt-2 space-y-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3">
          <span className="w-10 h-10 rounded-xl bg-molten-tint text-molten-ink flex items-center justify-center shrink-0 relative">
            <s.icon className="w-5 h-5" aria-hidden="true" />
            <span className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-basalt text-bone text-[11px] font-semibold flex items-center justify-center">{i + 1}</span>
          </span>
          <span className="text-sm">
            <span className="block font-medium text-basalt">{s.title}</span>
            <span className="text-ink">{s.text}</span>
          </span>
        </li>
      ))}
      <li className="flex gap-3 text-xs text-stone"><ClipboardPaste className="w-4 h-4 shrink-0" /> Facebook works the same way: save, copy, then paste into your post.</li>
    </ol>
  )
}
