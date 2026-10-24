// Admin > Documents: upload data sheets and guides, link them to products and systems, keep versions
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderOpen, Plus, Upload, X, Copy, Check, Lock, Globe, Trash2, ExternalLink, Bell } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import {
  DOC_BUCKET, DOC_COLUMNS, DOC_TYPE_LABELS, DOC_TYPE_ORDER, clearDocumentCache, downloadName, fileSizeLabel, MIME_DOCX, hasFile, issueLabel,
  permanentLink, slugify, type DocType, type DocVisibility, type DocumentRow,
} from '@/lib/documents'

interface NamedRow { id: string; name: string; group?: string | null }
interface LinkRow { document_id: string; product_id: string | null; system_id: string | null }
interface VersionRow {
  id: string; version: string | null; issue_date: string | null; file_path: string
  file_name: string | null; file_size: number | null; replaced_at: string
}
interface Draft {
  id: string
  title: string
  slug: string
  slugTouched: boolean
  doc_type: DocType
  visibility: DocVisibility
  version: string
  issue_date: string
  description: string
  productIds: string[]
  systemIds: string[]
  file: File | null
}

const MAX_BYTES = 25 * 1024 * 1024
const inputCls = 'w-full min-h-[44px] px-3 rounded-lg border border-line bg-bone text-basalt focus:outline-none focus:ring-2 focus:ring-molten/30'
const pill = (on: boolean) =>
  `min-h-[40px] px-3.5 rounded-full text-sm transition-colors ${on ? 'bg-basalt text-bone font-medium border border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`

// New documents get their id straight away, so a retried save updates rather than duplicates
const emptyDraft = (): Draft => ({
  id: crypto.randomUUID(), title: '', slug: '', slugTouched: false, doc_type: 'tds', visibility: 'public', version: '', issue_date: '',
  description: '', productIds: [], systemIds: [], file: null,
})


export function DocumentsAdminPage() {
  const navigate = useNavigate()
  const [docs, setDocs] = useState<DocumentRow[] | null>(null)
  const [links, setLinks] = useState<LinkRow[]>([])
  const [products, setProducts] = useState<NamedRow[]>([])
  const [systems, setSystems] = useState<NamedRow[]>([])
  const [stats, setStats] = useState<Record<string, { opens: number; people: number }>>({})
  const [setupMissing, setSetupMissing] = useState(false)
  const [filter, setFilter] = useState<DocType | 'all'>('all')

  const [draft, setDraft] = useState<Draft | null>(null)
  const [editing, setEditing] = useState<DocumentRow | null>(null)
  const [versions, setVersions] = useState<VersionRow[]>([])
  const [versionsLoaded, setVersionsLoaded] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [productSearch, setProductSearch] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [announce, setAnnounce] = useState<DocumentRow | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    load()
    supabase.from('products').select('id, name, is_active').order('name')
      .then(({ data }) => setProducts(((data as (NamedRow & { is_active: boolean })[]) || []).filter(p => p.is_active !== false)))
    supabase.from('systems').select('id, name, family, surface_type, is_active').order('display_order')
      .then(({ data }) => setSystems(((data as { id: string; name: string; family: string | null; surface_type: string; is_active: boolean }[]) || [])
        .filter(s => s.is_active !== false && (s.surface_type === 'floor' || s.surface_type === 'wall'))
        .map(s => ({ id: s.id, name: s.name, group: s.family }))))
  }, [])

  async function load() {
    const { data, error } = await supabase.from('documents').select(DOC_COLUMNS).order('doc_type').order('display_order').order('title')
    if (error) { setSetupMissing(true); setDocs([]); return }
    setDocs((data as DocumentRow[]) || [])
    const { data: l } = await supabase.from('document_links').select('document_id, product_id, system_id')
    setLinks((l as LinkRow[]) || [])
    const { data: s } = await supabase.rpc('document_stats')
    const map: Record<string, { opens: number; people: number }> = {}
    for (const r of (s as { document_id: string; opens: number; people: number }[]) || []) map[r.document_id] = { opens: Number(r.opens), people: Number(r.people) }
    setStats(map)
  }

  const nameOf = useMemo(() => {
    const m = new Map<string, string>()
    products.forEach(p => m.set(p.id, p.name))
    systems.forEach(s => m.set(s.id, s.name))
    return m
  }, [products, systems])

  function linkedLabel(docId: string) {
    const ls = links.filter(l => l.document_id === docId)
    if (ls.length === 0) return 'All jobs (general)'
    const names = ls.map(l => nameOf.get((l.product_id || l.system_id) as string)).filter(Boolean) as string[]
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3} more` : names.join(', ')
  }

  // ---- Editor ------------------------------------------------------------------
  const editorSeq = useRef(0)
  async function openEditor(doc: DocumentRow | null) {
    const seq = ++editorSeq.current
    setFormError(null)
    setProductSearch('')
    setAnnounce(null)
    setVersions([])
    setVersionsLoaded(!doc)
    if (!doc) { setEditing(null); setDraft(emptyDraft()); return }
    setEditing(doc)
    const ls = links.filter(l => l.document_id === doc.id)
    setDraft({
      id: doc.id, title: doc.title, slug: doc.slug, slugTouched: true, doc_type: doc.doc_type, visibility: doc.visibility,
      version: doc.version || '', issue_date: doc.issue_date || '', description: doc.description || '',
      productIds: ls.filter(l => l.product_id).map(l => l.product_id as string),
      systemIds: ls.filter(l => l.system_id).map(l => l.system_id as string),
      file: null,
    })
    const { data, error } = await supabase.from('document_versions')
      .select('id, version, issue_date, file_path, file_name, file_size, replaced_at')
      .eq('document_id', doc.id).order('replaced_at', { ascending: false })
    if (seq !== editorSeq.current) return // another document was opened meanwhile
    setVersions((data as VersionRow[]) || [])
    setVersionsLoaded(!error)
  }

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(d => {
      if (!d) return d
      const next = { ...d, [key]: value }
      if (key === 'title' && !d.slugTouched) next.slug = slugify(String(value))
      return next
    })
  }

  function pickFile(f: File | null) {
    setFormError(null)
    if (!f) return
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
    const isDocx = f.type === MIME_DOCX || /\.docx$/i.test(f.name)
    if (!isPdf && !isDocx) { setFormError('Please choose a PDF or a Word (.docx) file.'); return }
    if (f.size > MAX_BYTES) { setFormError(`That file is ${fileSizeLabel(f.size)}. The limit is 25 MB.`); return }
    set('file', f)
  }

  function toggleId(key: 'productIds' | 'systemIds', id: string) {
    setDraft(d => d && ({ ...d, [key]: d[key].includes(id) ? d[key].filter(x => x !== id) : [...d[key], id] }))
  }

  async function save() {
    if (!draft) return
    const title = draft.title.trim()
    const slug = slugify(draft.slug || title)
    if (!title) { setFormError('Give the document a title.'); return }
    if (!slug) { setFormError('The web address needs at least one letter or number.'); return }
    if (docs?.some(d => d.slug === slug && d.id !== draft.id)) { setFormError('Another document already uses that web address. Change it slightly.'); return }
    setSaving(true)
    setFormError(null)
    let uploadedPath: string | null = null
    try {
      // 1. Upload a new PDF first (stored under its own folder, named as people will see it)
      if (draft.file) {
        const docx = /\.docx$/i.test(draft.file.name)
        uploadedPath = `${crypto.randomUUID()}/${downloadName({ title, version: draft.version.trim() || null }, docx ? 'docx' : 'pdf')}`
        const up = await supabase.storage.from(DOC_BUCKET).upload(uploadedPath, draft.file, { contentType: docx ? MIME_DOCX : 'application/pdf', upsert: false })
        if (up.error) { uploadedPath = null; throw up.error }
      }
      // 2. Save the details, the file and the links in one step (all or nothing)
      const { data, error } = await supabase.rpc('save_document', {
        p: {
          id: draft.id, title, slug, doc_type: draft.doc_type, visibility: draft.visibility,
          version: draft.version.trim(), issue_date: draft.issue_date, description: draft.description.trim(),
          product_ids: draft.productIds, system_ids: draft.systemIds,
          ...(uploadedPath && draft.file ? { file_path: uploadedPath, file_name: draft.file.name, file_size: draft.file.size } : {}),
        },
      })
      if (error) throw error
      const doc = data as DocumentRow
      if (uploadedPath && editing && hasFile(editing) && doc.doc_type === 'sds' && doc.visibility === 'public') setAnnounce(doc)
      uploadedPath = null
      clearDocumentCache()
      await load()
      setDraft(null)
      setEditing(null)
    } catch (e) {
      // Don't leave an unused upload behind
      if (uploadedPath) await supabase.storage.from(DOC_BUCKET).remove([uploadedPath])
      const msg = (e as Error).message || ''
      setFormError(/duplicate key|documents_slug_key/.test(msg)
        ? 'Another document already uses that web address. Change it slightly.'
        : `Could not save: ${msg || 'please try again'}`)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing || !versionsLoaded) return
    if (!window.confirm(`Delete "${editing.title}" and all its versions?\n\nIts web address will stop working. To replace a PDF, upload a new one instead.`)) return
    setSaving(true)
    setFormError(null)
    const { data, error } = await supabase.rpc('delete_document', { p_id: editing.id })
    if (error) { setFormError(`Could not delete: ${error.message}`); setSaving(false); return }
    const paths = (data as string[]) || []
    if (paths.length) {
      const rm = await supabase.storage.from(DOC_BUCKET).remove(paths)
      // The document is gone either way; leftover files can no longer be opened by anyone but admins
      if (rm.error) console.warn('Some files could not be removed from storage', rm.error.message)
    }
    clearDocumentCache()
    await load()
    setSaving(false)
    setDraft(null)
    setEditing(null)
  }

  async function openFile(path: string) {
    const tab = window.open('about:blank', '_blank')
    const { data } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(path, 600)
    if (data?.signedUrl && tab) tab.location.href = data.signedUrl
    else { tab?.close(); setFormError('Could not open that file.') }
  }

  async function copy(text: string, key: string) {
    try { await navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 2000) } catch { /* ignore */ }
  }

  function tellInstallers(d: DocumentRow) {
    const params = new URLSearchParams({
      title: `Updated Safety Data Sheet: ${d.title}`.slice(0, 80),
      body: `A new version of the ${d.title}${d.version ? ` (${d.version})` : ''} is available. Tap to open it.`.slice(0, 200),
      category: 'products',
      link: 'url',
      url: permanentLink(d.slug),
    })
    navigate(`/admin/notifications?${params}`)
  }

  // ---- Render ------------------------------------------------------------------
  if (docs === null) return <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>

  if (setupMissing) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-medium text-basalt flex items-center gap-2 mb-6"><FolderOpen className="w-6 h-6" /> Documents</h1>
        <div className="bg-bone border border-line rounded-xl p-6 text-sm text-ink">
          The document library isn't set up in the database yet. Run <code className="px-1 bg-line-soft rounded">sql/documents.sql</code> in the Supabase SQL Editor, then reload this page.
        </div>
      </div>
    )
  }

  const shown = docs.filter(d => filter === 'all' || d.doc_type === filter)
  const productList = products.filter(p => !productSearch.trim() || p.name.toLowerCase().includes(productSearch.trim().toLowerCase()))

  const openedLabel = (id: string) => {
    const st = stats[id]
    return st ? `${st.opens} by ${st.people} ${st.people === 1 ? 'person' : 'people'}` : '0'
  }
  const docTitle = (d: DocumentRow) => (
    <p className="font-medium text-basalt">
      {d.title}
      {d.visibility === 'public'
        ? <Globe className="w-3.5 h-3.5 text-stone inline-block align-[-2px] ml-1.5" aria-label="Public" />
        : <Lock className="w-3.5 h-3.5 text-stone inline-block align-[-2px] ml-1.5" aria-label="Installers only" />}
    </p>
  )
  const linkButton = (d: DocumentRow) => (
    <button type="button" onClick={() => copy(permanentLink(d.slug), d.id)}
      className="text-xs text-molten-ink hover:underline mt-1 flex items-start gap-1 min-h-[28px] text-left"
      aria-label={`Copy link /docs/${d.slug}`}>
      {copied === d.id ? <Check className="w-3.5 h-3.5 shrink-0 mt-px" /> : <Copy className="w-3.5 h-3.5 shrink-0 mt-px" />}
      <span className="[overflow-wrap:anywhere]">{copied === d.id ? 'Link copied' : `/docs/${d.slug}`}</span>
    </button>
  )

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-medium text-basalt flex items-center gap-2"><FolderOpen className="w-6 h-6" /> Documents</h1>
        <Button onClick={() => openEditor(null)} className="gap-2"><Plus className="w-4 h-4" /> Add document</Button>
      </div>
      <p className="text-sm text-stone mb-5">
        Each document has a permanent web address that always opens its latest PDF, so links in emails and on the website never go out of date.
      </p>

      {announce && (
        <div className="mb-4 bg-molten-tint text-molten-ink rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <Bell className="w-4 h-4" />
          <span className="text-sm flex-1">New version of <strong>{announce.title}</strong> uploaded. Tell installers?</span>
          <Button size="sm" onClick={() => tellInstallers(announce)}>Write a notification</Button>
          <button aria-label="Dismiss" onClick={() => setAnnounce(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Show">
        {(['all', ...DOC_TYPE_ORDER] as (DocType | 'all')[]).map(t => (
          <button key={t} type="button" aria-pressed={filter === t} onClick={() => setFilter(t)} className={pill(filter === t)}>
            {t === 'all' ? 'All' : DOC_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="bg-bone border border-line rounded-xl">
        {shown.length === 0 ? (
          <p className="p-6 text-sm text-stone">No documents yet. Use <strong>Add document</strong> to upload a PDF, or create an entry now and add its PDF later (it shows as Coming soon).</p>
        ) : (
          <>
            {/* Computer: table */}
            <table className="hidden lg:table w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-stone uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Document</th>
                  <th className="px-3 py-3 font-medium">For</th>
                  <th className="px-3 py-3 font-medium">Version</th>
                  <th className="px-3 py-3 font-medium">Opened</th>
                  <th className="px-5 py-3 font-medium"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(d => (
                  <tr key={d.id} className="border-t border-line-soft align-top">
                    <td className="px-5 py-3 [overflow-wrap:anywhere]">
                      {docTitle(d)}
                      <p className="text-stone">{DOC_TYPE_LABELS[d.doc_type]}{hasFile(d) ? '' : ' · Coming soon (no PDF yet)'}</p>
                      {linkButton(d)}
                    </td>
                    <td className="px-3 py-3 text-ink">{linkedLabel(d.id)}</td>
                    <td className="px-3 py-3 text-ink">{issueLabel(d) || <span className="text-stone">–</span>}</td>
                    <td className="px-3 py-3 text-ink whitespace-nowrap">{openedLabel(d.id)}</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {hasFile(d) && (
                        <Button size="sm" variant="ghost" onClick={() => d.file_path && openFile(d.file_path)} className="gap-1"><ExternalLink className="w-4 h-4" /> View</Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => openEditor(d)}>Edit</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Tablet and phone: one card per document */}
            <ul className="lg:hidden divide-y divide-line-soft">
              {shown.map(d => (
                <li key={d.id} className="p-4 text-sm [overflow-wrap:anywhere]">
                  {docTitle(d)}
                  <p className="text-stone">{DOC_TYPE_LABELS[d.doc_type]}{hasFile(d) ? '' : ' · Coming soon (no PDF yet)'}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-ink">
                    <dt className="text-stone">For</dt><dd>{linkedLabel(d.id)}</dd>
                    <dt className="text-stone">Version</dt><dd>{issueLabel(d) || '–'}</dd>
                    <dt className="text-stone">Opened</dt><dd>{openedLabel(d.id)}</dd>
                  </dl>
                  {linkButton(d)}
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hasFile(d) && (
                      <Button size="sm" variant="outline" onClick={() => d.file_path && openFile(d.file_path)} className="gap-1"><ExternalLink className="w-4 h-4" /> View</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openEditor(d)}>Edit</Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {draft && (
        <div className="fixed inset-0 z-[70] bg-basalt/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={editing ? 'Edit document' : 'Add document'}>
          <div className="bg-bone w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-basalt">{editing ? 'Edit document' : 'Add document'}</h2>
              <button aria-label="Close" onClick={() => { setDraft(null); setEditing(null) }} className="min-w-[44px] min-h-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
            </div>

            <div>
              <label htmlFor="doc-title" className="block text-sm font-medium text-ink mb-1">Title</label>
              <input id="doc-title" className={inputCls} maxLength={120} value={draft.title} placeholder="e.g. Primer 180 Safety Data Sheet"
                onChange={e => set('title', e.target.value)} />
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-2">Type</p>
              <div className="flex flex-wrap gap-2">
                {DOC_TYPE_ORDER.map(t => (
                  <button key={t} type="button" aria-pressed={draft.doc_type === t} className={pill(draft.doc_type === t)}
                    onClick={() => setDraft(d => d && ({ ...d, doc_type: t, visibility: editing ? d.visibility : (t === 'install' ? 'installers' : 'public') }))}>
                    {DOC_TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-2">Who can open it</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={draft.visibility === 'public'} className={pill(draft.visibility === 'public')} onClick={() => set('visibility', 'public')}>
                  Public: anyone with the link
                </button>
                <button type="button" aria-pressed={draft.visibility === 'installers'} className={pill(draft.visibility === 'installers')} onClick={() => set('visibility', 'installers')}>
                  Installers only (login)
                </button>
              </div>
              <p className="text-xs text-stone mt-1.5">Public suits data sheets and care guides; links keep working for clients and on the website.</p>
            </div>

            <div>
              <label htmlFor="doc-slug" className="block text-sm font-medium text-ink mb-1">Web address</label>
              <div className="flex items-center gap-1 text-sm">
                <span className="text-stone shrink-0">/docs/</span>
                <input id="doc-slug" className={inputCls} maxLength={80} value={draft.slug}
                  onChange={e => setDraft(d => d && ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'), slugTouched: true }))}
                  onBlur={() => setDraft(d => d && ({ ...d, slug: slugify(d.slug) }))} />
              </div>
              {editing && draft.slug !== editing.slug && (
                <p className="text-xs text-danger mt-1.5">Changing this breaks links already sent out or on the website.</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-version" className="block text-sm font-medium text-ink mb-1">Version</label>
                <input id="doc-version" className={inputCls} maxLength={30} value={draft.version} placeholder="e.g. 1.2" onChange={e => set('version', e.target.value)} />
              </div>
              <div>
                <label htmlFor="doc-date" className="block text-sm font-medium text-ink mb-1">Issue date</label>
                <input id="doc-date" type="date" className={inputCls} value={draft.issue_date} onChange={e => set('issue_date', e.target.value)} />
              </div>
            </div>

            <div>
              <label htmlFor="doc-desc" className="block text-sm font-medium text-ink mb-1">Short description <span className="font-normal text-stone">(optional)</span></label>
              <textarea id="doc-desc" rows={2} maxLength={300} className={`${inputCls} py-2.5`} value={draft.description} onChange={e => set('description', e.target.value)} />
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-2">File <span className="font-normal text-stone">(PDF, or Word .docx)</span></p>
              <input ref={fileInput} type="file" accept={`application/pdf,.pdf,${MIME_DOCX},.docx`} className="hidden" onChange={e => { pickFile(e.target.files?.[0] || null); e.target.value = '' }} />
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} className="gap-2">
                  <Upload className="w-4 h-4" /> {editing && hasFile(editing) ? 'Upload a new version' : 'Choose file'}
                </Button>
                <span className="text-sm text-ink [overflow-wrap:anywhere]">
                  {draft.file ? `${draft.file.name} (${fileSizeLabel(draft.file.size)}), uploads when you save`
                    : editing && hasFile(editing) ? `Current: ${editing.file_name || 'PDF'}${editing.file_size ? ` (${fileSizeLabel(editing.file_size)})` : ''}`
                    : 'No file yet: shown to installers as Coming soon'}
                </span>
              </div>
              {draft.file && editing && hasFile(editing) && (
                <p className="text-xs text-stone mt-1.5">The current file will be kept below as a past version. Remember to update the version and issue date.</p>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-1">Products it covers</p>
              <p className="text-xs text-stone mb-2">Shown beside these products in the calculator and on quotes. Leave everything unticked for a general document that applies to every job.</p>
              <input className={`${inputCls} mb-2`} placeholder="Search products" value={productSearch} onChange={e => setProductSearch(e.target.value)} aria-label="Search products" />
              <div className="max-h-48 overflow-y-auto border border-line rounded-lg divide-y divide-line-soft">
                {productList.map(p => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px] cursor-pointer hover:bg-limestone">
                    <input type="checkbox" checked={draft.productIds.includes(p.id)} onChange={() => toggleId('productIds', p.id)} className="w-4 h-4 accent-molten" />
                    <span className="text-sm text-basalt">{p.name}</span>
                  </label>
                ))}
                {productList.length === 0 && <p className="px-3 py-2 text-sm text-stone">No products match.</p>}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-ink mb-1">Systems it covers</p>
              <p className="text-xs text-stone mb-2">Installation and care guides usually belong to a system. Shown under the chosen system in the calculator.</p>
              <div className="border border-line rounded-lg divide-y divide-line-soft">
                {systems.map(s => (
                  <label key={s.id} className="flex items-center gap-3 px-3 py-2 min-h-[44px] cursor-pointer hover:bg-limestone">
                    <input type="checkbox" checked={draft.systemIds.includes(s.id)} onChange={() => toggleId('systemIds', s.id)} className="w-4 h-4 accent-molten" />
                    <span className="text-sm text-basalt">{s.name}{s.group ? <span className="text-stone"> · {s.group}</span> : null}</span>
                  </label>
                ))}
              </div>
            </div>

            {versions.length > 0 && (
              <div>
                <p className="text-sm font-medium text-ink mb-2">Past versions</p>
                <ul className="border border-line rounded-lg divide-y divide-line-soft">
                  {versions.map(v => (
                    <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="text-ink">
                        {issueLabel(v) || 'Unversioned'}
                        <span className="text-stone"> · replaced {new Date(v.replaced_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      </span>
                      <Button size="sm" variant="ghost" onClick={() => openFile(v.file_path)}>View</Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {formError && <p className="text-sm text-danger" role="alert">{formError}</p>}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line">
              {editing ? (
                <Button variant="ghost" onClick={remove} disabled={saving || !versionsLoaded} className="gap-1.5 text-danger"><Trash2 className="w-4 h-4" /> Delete</Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setDraft(null); setEditing(null) }} disabled={saving}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
