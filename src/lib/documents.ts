// Document library: Technical Data Sheets, Safety Data Sheets, installation and care guides
import { supabase } from '@/lib/supabase'

export type DocType = 'tds' | 'sds' | 'install' | 'care'
export type DocVisibility = 'public' | 'installers'

export const DOC_BUCKET = 'documents'
const URL_LIFETIME_S = 60 * 60 // signed links last an hour; the library refreshes before then
const REFRESH_AFTER_MS = 45 * 60 * 1000

export interface DocumentRow {
  id: string
  slug: string
  title: string
  doc_type: DocType
  visibility: DocVisibility
  description: string | null
  version: string | null
  issue_date: string | null
  file_path: string | null
  file_name: string | null
  file_size: number | null
  is_active: boolean
  display_order: number
  updated_at: string
}

export interface DocumentLink {
  document_id: string
  product_id: string | null
  system_id: string | null
}

export interface DocUrls { view: string; download: string }

export interface DocumentIndex {
  docs: DocumentRow[]
  links: DocumentLink[]
  urls: Record<string, DocUrls> // by document id: ready-made links to open or download its current PDF
  ready: boolean // false when the library isn't set up yet (SQL not run) or couldn't load
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  tds: 'Technical Data Sheet',
  sds: 'Safety Data Sheet',
  install: 'Installation guide',
  care: 'Care and maintenance',
}
export const DOC_TYPE_SHORT: Record<DocType, string> = { tds: 'TDS', sds: 'SDS', install: 'Install', care: 'Care' }
export const DOC_TYPE_ORDER: DocType[] = ['tds', 'sds', 'install', 'care']

export const DOC_COLUMNS = 'id, slug, title, doc_type, visibility, description, version, issue_date, file_path, file_name, file_size, is_active, display_order, updated_at'

/** The permanent address of a document, e.g. https://calculator.magmacoatings.com/docs/primer-180-sds */
export function permanentLink(slug: string): string {
  return `${window.location.origin}/docs/${slug}`
}

export function hasFile(d: Pick<DocumentRow, 'file_path'>): boolean {
  return !!d.file_path
}

export function fileSizeLabel(bytes: number | null): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function issueLabel(d: Pick<DocumentRow, 'version' | 'issue_date'>): string {
  const parts: string[] = []
  if (d.version) parts.push(/^v/i.test(d.version) ? d.version : `Version ${d.version}`)
  if (d.issue_date) parts.push(`issued ${new Date(d.issue_date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`)
  return parts.join(', ')
}

export function slugify(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '')
}

/** The stored file name, which is also the name people see when they download it */
export function downloadName(d: Pick<DocumentRow, 'title' | 'version'>): string {
  const base = `Magma ${d.title}${d.version ? ` ${d.version}` : ''}`.replace(/[^A-Za-z0-9 ._()&+-]+/g, '-').replace(/\s+/g, ' ').trim()
  return `${base.slice(0, 120)}.pdf`
}

/** Short-lived links to view and download files (one request each, however many files) */
export async function signFiles(paths: string[], lifetime = URL_LIFETIME_S): Promise<Record<string, DocUrls>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return {}
  const bucket = supabase.storage.from(DOC_BUCKET)
  const [view, download] = await Promise.all([
    bucket.createSignedUrls(unique, lifetime),
    bucket.createSignedUrls(unique, lifetime, { download: true }),
  ])
  const out: Record<string, DocUrls> = {}
  for (const v of view.data || []) {
    if (!v.path || !v.signedUrl) continue
    const dl = (download.data || []).find(x => x.path === v.path)?.signedUrl
    out[v.path] = { view: v.signedUrl, download: dl || v.signedUrl }
  }
  return out
}

/** Record an open or download (signed-in users only; never blocks the user) */
export function logDocumentEvent(documentId: string, event: 'open' | 'download') {
  supabase.auth.getSession().then(({ data }) => {
    if (!data.session) return
    supabase.from('document_events').insert({ document_id: documentId, event }).then(() => undefined)
  })
}

// ---- The library, loaded once per signed-in user and shared ----------------------
let cache: { key: string; at: number; promise: Promise<DocumentIndex> } | null = null

export function loadDocumentIndex(userKey: string, force = false): Promise<DocumentIndex> {
  const fresh = cache && cache.key === userKey && Date.now() - cache.at < REFRESH_AFTER_MS
  if (fresh && !force) return cache!.promise
  const promise = (async (): Promise<DocumentIndex> => {
    const [docsRes, linksRes] = await Promise.all([
      supabase.from('documents').select(DOC_COLUMNS).eq('is_active', true).order('display_order').order('title'),
      supabase.from('document_links').select('document_id, product_id, system_id'),
    ])
    if (docsRes.error || linksRes.error) throw new Error('Document library unavailable')
    const docs = (docsRes.data as DocumentRow[]) || []
    const byPath = await signFiles(docs.map(d => d.file_path || ''))
    const urls: Record<string, DocUrls> = {}
    for (const d of docs) if (d.file_path && byPath[d.file_path]) urls[d.id] = byPath[d.file_path]
    return { docs, links: (linksRes.data as DocumentLink[]) || [], urls, ready: true }
  })()
  cache = { key: userKey, at: Date.now(), promise }
  // Never keep a failure: the next visit tries again
  promise.catch(() => { if (cache?.promise === promise) cache = null })
  return promise.catch(() => ({ docs: [], links: [], urls: {}, ready: false }))
}

export function clearDocumentCache() {
  cache = null
}
const byTypeThenOrder = (a: DocumentRow, b: DocumentRow) =>
  DOC_TYPE_ORDER.indexOf(a.doc_type) - DOC_TYPE_ORDER.indexOf(b.doc_type) || a.display_order - b.display_order || a.title.localeCompare(b.title)

export function docsForProduct(index: DocumentIndex, productId: string | null | undefined): DocumentRow[] {
  if (!productId) return []
  const ids = new Set(index.links.filter(l => l.product_id === productId).map(l => l.document_id))
  return index.docs.filter(d => ids.has(d.id)).sort(byTypeThenOrder)
}

export function docsForSystems(index: DocumentIndex, systemIds: (string | null | undefined)[]): DocumentRow[] {
  const want = new Set(systemIds.filter(Boolean) as string[])
  if (want.size === 0) return []
  const ids = new Set(index.links.filter(l => l.system_id && want.has(l.system_id)).map(l => l.document_id))
  return index.docs.filter(d => ids.has(d.id)).sort(byTypeThenOrder)
}

/** Documents linked to nothing: general guides that apply to every job */
export function generalDocs(index: DocumentIndex): DocumentRow[] {
  const linked = new Set(index.links.map(l => l.document_id))
  return index.docs.filter(d => !linked.has(d.id)).sort(byTypeThenOrder)
}

/** Everything relevant to a quote: its products, its systems and general care guides */
export function docsForQuote(index: DocumentIndex, productIds: string[], systemIds: string[]): DocumentRow[] {
  const want = new Set(productIds)
  const sys = new Set(systemIds)
  const ids = new Set(index.links
    .filter(l => (l.product_id && want.has(l.product_id)) || (l.system_id && sys.has(l.system_id)))
    .map(l => l.document_id))
  const general = generalDocs(index).filter(d => d.doc_type === 'care')
  general.forEach(d => ids.add(d.id))
  return index.docs.filter(d => ids.has(d.id)).sort(byTypeThenOrder)
}
