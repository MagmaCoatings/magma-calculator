// Media pack: social images, videos, architect material, logos and whole packs for installers
import * as tus from 'tus-js-client'
import { supabase } from '@/lib/supabase'

export type MediaSection = 'social' | 'videos' | 'architects' | 'logos' | 'pack'
export type MediaFormat = 'square' | 'portrait' | 'story' | 'landscape'
export type MediaKind = 'image' | 'video' | 'document' | 'zip'
export type MediaEvent = 'view' | 'save' | 'caption' | 'download' | 'share'

export const MEDIA_BUCKET = 'media'
export const NEW_FOR_DAYS = 14
export const CAPTION_MAX = 2200
const URL_LIFETIME_S = 60 * 60

export const SECTION_LABELS: Record<MediaSection, string> = {
  social: 'Social',
  videos: 'Videos',
  architects: 'Architects',
  logos: 'Logos',
  pack: 'Whole pack',
}
export const SECTION_LONG: Record<MediaSection, string> = {
  social: 'Social media posts',
  videos: 'Videos',
  architects: 'Architects and designers',
  logos: 'Logos and badges',
  pack: 'Whole pack',
}
export const SECTION_ORDER: MediaSection[] = ['social', 'videos', 'architects', 'logos', 'pack']
export const FORMAT_LABELS: Record<MediaFormat, string> = {
  square: 'Square',
  portrait: 'Portrait (4:5)',
  story: 'Story or Reel (9:16)',
  landscape: 'Landscape',
}

export const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
// Per-kind limits (the database checks the same)
export const KIND_LIMITS: Record<MediaKind, number> = {
  image: 15 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  zip: 500 * 1024 * 1024,
}

export interface MediaAccess {
  visible: boolean
  admin?: boolean
  enabled?: boolean
  terms_version?: number
  agreed?: boolean
  terms_title?: string | null
  terms_body?: string | null
}

export interface MediaCampaign { id: string; name: string; starts_on: string; display_order: number }

export interface MediaItem {
  id: string
  title: string
  section: MediaSection
  campaign_id: string | null
  description: string | null
  caption: string | null
  hashtags: string | null
  credit: string | null
  format: MediaFormat | null
  status: 'draft' | 'published'
  check_watermark: boolean
  check_permission: boolean
  display_order: number
  pinned: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface MediaFile {
  id: string
  item_id: string
  position: number
  kind: MediaKind
  file_path: string
  file_name: string
  mime_type: string
  file_size: number
  width: number | null
  height: number | null
  duration_s: number | null
  preview_path: string | null
  is_current: boolean
  created_at: string
  replaced_at: string | null
}

export const ITEM_COLUMNS = 'id, title, section, campaign_id, description, caption, hashtags, credit, format, status, check_watermark, check_permission, display_order, pinned, published_at, created_at, updated_at'
export const FILE_COLUMNS = 'id, item_id, position, kind, file_path, file_name, mime_type, file_size, width, height, duration_s, preview_path, is_current, created_at, replaced_at'

// ---- Access ---------------------------------------------------------------------
let accessCache: { key: string; promise: Promise<MediaAccess> } | null = null

/** Whether this person sees the Media tab (and whether they still need to agree the terms) */
export function loadMediaAccess(userKey: string, force = false): Promise<MediaAccess> {
  if (!force && accessCache?.key === userKey) return accessCache.promise
  const promise: Promise<MediaAccess> = (async () => {
    const { data, error } = await supabase.rpc('media_access')
    // Not set up yet (SQL not run) or offline: hidden
    if (error || !data) return { visible: false }
    return data as MediaAccess
  })()
  accessCache = { key: userKey, promise }
  promise.then(a => { if (!a.visible && accessCache?.promise === promise) accessCache = null })
  return promise
}
export function clearMediaAccess() { accessCache = null }

// ---- Display helpers ---------------------------------------------------------------
export function isNew(item: Pick<MediaItem, 'published_at'>, now = Date.now()): boolean {
  if (!item.published_at) return false
  return now - new Date(item.published_at).getTime() < NEW_FOR_DAYS * 24 * 60 * 60 * 1000
}

export function formatFromSize(w?: number | null, h?: number | null): MediaFormat | null {
  if (!w || !h) return null
  const r = w / h
  if (r > 1.15) return 'landscape'
  if (r > 0.9) return 'square'
  if (r > 0.68) return 'portrait'
  return 'story'
}

export function durationLabel(s: number | null | undefined): string {
  if (!s && s !== 0) return ''
  const total = Math.round(Number(s))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function sizeLabel(bytes: number | null | undefined): string {
  if (!bytes) return ''
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/** Caption with the hashtags underneath, as it should be pasted */
export function fullCaption(item: Pick<MediaItem, 'caption' | 'hashtags'>): string {
  return [item.caption?.trim(), item.hashtags?.trim()].filter(Boolean).join('\n\n')
}

export function kindOf(file: File): MediaKind | null {
  const t = file.type, n = file.name.toLowerCase()
  if (['image/jpeg', 'image/png', 'image/webp'].includes(t) || /\.(jpe?g|png|webp)$/.test(n)) return 'image'
  if (t === 'video/mp4' || /\.mp4$/.test(n)) return 'video'
  if (t === 'application/pdf' || t === MIME_DOCX || /\.(pdf|docx)$/.test(n)) return 'document'
  if (t === 'application/zip' || t === 'application/x-zip-compressed' || /\.zip$/.test(n)) return 'zip'
  return null
}

export function mimeOf(file: File): string {
  const n = file.name.toLowerCase()
  if (/\.jpe?g$/.test(n)) return 'image/jpeg'
  if (/\.png$/.test(n)) return 'image/png'
  if (/\.webp$/.test(n)) return 'image/webp'
  if (/\.mp4$/.test(n)) return 'video/mp4'
  if (/\.pdf$/.test(n)) return 'application/pdf'
  if (/\.docx$/.test(n)) return MIME_DOCX
  if (/\.zip$/.test(n)) return 'application/zip'
  return file.type
}

/** Which files a section accepts (file picker filter) */
export const SECTION_ACCEPT: Record<MediaSection, string> = {
  social: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
  videos: 'video/mp4,.mp4',
  architects: `application/pdf,${MIME_DOCX},.pdf,.docx`,
  logos: 'image/png,application/pdf,.png,.pdf',
  pack: 'application/zip,.zip',
}
export const SECTION_MAX_FILES: Record<MediaSection, number> = { social: 10, videos: 1, architects: 2, logos: 2, pack: 1 }

/** Why a file can't go in a section, or null when it can */
export function fileProblem(section: MediaSection, file: File): string | null {
  const kind = kindOf(file)
  const mime = mimeOf(file)
  if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') return 'SVG files are not accepted, because they can carry scripts. Please use PNG or PDF.'
  const allowed: Record<MediaSection, MediaKind[]> = { social: ['image'], videos: ['video'], architects: ['document'], logos: ['image', 'document'], pack: ['zip'] }
  if (!kind || !allowed[section].includes(kind)) {
    return { social: 'Social posts take JPG, PNG or WebP images.', videos: 'Videos must be MP4 files.', architects: 'Architect material must be a Word (.docx) or PDF file.', logos: 'Logos and badges must be PNG or PDF.', pack: 'A whole pack must be a ZIP file.' }[section]
  }
  if (section === 'logos' && mime !== 'image/png' && mime !== 'application/pdf') return 'Logos and badges must be PNG or PDF.'
  if (file.size > KIND_LIMITS[kind]) return `${file.name} is ${sizeLabel(file.size)}. The limit for this kind of file is ${sizeLabel(KIND_LIMITS[kind])}.`
  return null
}

// ---- Signed links ------------------------------------------------------------------
export async function signMedia(paths: string[], download = false, lifetime = URL_LIFETIME_S): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (unique.length === 0) return {}
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrls(unique, lifetime, download ? { download: true } : undefined)
  const out: Record<string, string> = {}
  for (const v of data || []) if (v.path && v.signedUrl) out[v.path] = v.signedUrl
  return out
}

/** Record what someone did (never blocks the user) */
export function logMediaEvent(itemId: string, event: MediaEvent) {
  supabase.from('media_events').insert({ item_id: itemId, event }).then(() => undefined)
}

// ---- Save to phone ---------------------------------------------------------------
export type SaveResult = 'shared' | 'downloaded' | 'cancelled'

/** Fetch files with a progress callback (0 to 1 across all files) */
async function fetchFiles(files: { url: string; name: string; type: string; size?: number }[], onProgress?: (p: number) => void): Promise<File[]> {
  const total = files.reduce((s, f) => s + (f.size || 0), 0)
  let done = 0
  const out: File[] = []
  for (const f of files) {
    const res = await fetch(f.url)
    if (!res.ok || !res.body) throw new Error('Could not fetch the file. Please try again.')
    const reader = res.body.getReader()
    const chunks: BlobPart[] = []
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      chunks.push(value)
      done += value.length
      if (onProgress && total) onProgress(Math.min(1, done / total))
    }
    out.push(new File(chunks, f.name, { type: f.type }))
  }
  return out
}

function downloadViaLink(url: string, name: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** True on phones and tablets, where the share sheet offers Save Image / Save Video */
export function prefersShareSheet(): boolean {
  const touch = typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || /Android|iPhone|iPad/i.test(navigator.userAgent))
  return touch && typeof navigator.canShare === 'function'
}

export interface SaveSource { url: string; downloadUrl: string; name: string; type: string; size?: number }
export type SaveOutcome = { result: SaveResult } | { result: 'needs-tap'; files: File[] }

/**
 * Hand the files to the phone's share sheet (Save Image / Save Video go to the camera roll).
 * On a computer, or where sharing files isn't supported, the files download instead.
 * If the phone refuses to open the share sheet after a long download (it wants a fresh tap),
 * the fetched files come back as 'needs-tap' so the page can offer "Tap to save".
 */
export async function saveToPhone(files: SaveSource[], onProgress?: (p: number) => void): Promise<SaveOutcome> {
  if (prefersShareSheet()) {
    const fetched = await fetchFiles(files, onProgress)
    if (navigator.canShare({ files: fetched })) {
      const r = await shareFetched(fetched)
      if (r !== 'refused') return { result: r }
      return { result: 'needs-tap', files: fetched }
    }
  }
  for (const f of files) downloadViaLink(f.downloadUrl, f.name)
  return { result: 'downloaded' }
}

/** Open the share sheet for files already fetched */
export async function shareFetched(files: File[]): Promise<'shared' | 'cancelled' | 'refused'> {
  try {
    await navigator.share({ files })
    return 'shared'
  } catch (e) {
    const name = (e as DOMException)?.name
    if (name === 'AbortError') return 'cancelled'
    return 'refused'
  }
}

/** Plain download (computer, or "Download" on architect files) */
export function downloadFile(url: string, name: string) {
  downloadViaLink(url, name)
}

// ---- Uploads (admin) -----------------------------------------------------------------
const CHUNK = 6 * 1024 * 1024 // Supabase's resumable uploads need 6 MB chunks

/** Upload a file; anything over 6 MB goes up in resumable chunks so a dropped signal doesn't restart it */
export async function uploadMediaFile(path: string, file: Blob, contentType: string, onProgress?: (p: number) => void): Promise<void> {
  if (file.size <= CHUNK) {
    const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, { contentType, upsert: false, cacheControl: '3600' })
    if (error) throw error
    onProgress?.(1)
    return
  }
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Please sign in again.')
  const projectUrl = (import.meta.env.VITE_SUPABASE_URL as string).replace(/\/$/, '')
  await new Promise<void>((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${projectUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 2000, 5000, 10000, 20000, 30000, 60000],
      headers: { authorization: `Bearer ${session.access_token}`, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: { bucketName: MEDIA_BUCKET, objectName: path, contentType, cacheControl: '3600' },
      chunkSize: CHUNK,
      onError: err => reject(err),
      onProgress: (sent, total) => onProgress?.(total ? sent / total : 0),
      onSuccess: () => resolve(),
    })
    upload.findPreviousUploads().then(prev => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0])
      upload.start()
    })
  })
}

/** A safe stored file name, keeping the extension */
export function storedName(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name)
  const ext = m ? m[1].toLowerCase() : ''
  const base = name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9 ._()&+-]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 100) || 'file'
  return ext ? `${base}.${ext}` : base
}

export interface FileFacts { width?: number; height?: number; duration?: number; preview?: Blob }

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(b => resolve(b), 'image/jpeg', 0.8))
}

function drawPreview(source: CanvasImageSource, w: number, h: number): Promise<Blob | null> {
  const width = Math.min(600, w)
  const height = Math.round(h * (width / w))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(source, 0, 0, width, height)
  return canvasToBlob(canvas)
}

/** Size, length and a small preview (about 600 px wide), made in the browser while uploading */
export async function readFileFacts(file: File, kind: MediaKind): Promise<FileFacts> {
  try {
    if (kind === 'image') {
      const bmp = await createImageBitmap(file)
      const preview = await drawPreview(bmp, bmp.width, bmp.height)
      const out = { width: bmp.width, height: bmp.height, preview: preview || undefined }
      bmp.close()
      return out
    }
    if (kind === 'video') return await videoFacts(file)
  } catch { /* previews are a nicety: the upload still works without one */ }
  return {}
}

function videoFacts(file: Blob, at = 1): Promise<FileFacts> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'auto'
    v.muted = true
    v.playsInline = true
    v.src = url
    const finish = (f: FileFacts) => { URL.revokeObjectURL(url); resolve(f) }
    const timer = window.setTimeout(() => finish({}), 20000)
    v.onloadedmetadata = () => { v.currentTime = Math.min(at, Math.max(0, (v.duration || 0) - 0.1)) }
    v.onseeked = async () => {
      window.clearTimeout(timer)
      const preview = await drawPreview(v, v.videoWidth, v.videoHeight)
      finish({ width: v.videoWidth, height: v.videoHeight, duration: v.duration, preview: preview || undefined })
    }
    v.onerror = () => { window.clearTimeout(timer); finish({}) }
  })
}

/** A cover image uploaded by hand for a video, resized like the automatic one */
export async function coverFromImage(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file)
    const b = await drawPreview(bmp, bmp.width, bmp.height)
    bmp.close()
    return b
  } catch { return null }
}

/** Link to the Media tab for notifications ("Tell installers") */
export function mediaPageUrl(): string {
  return `${window.location.origin}/media`
}

/** No-login share link for an architect file */
export function mediaShareUrl(token: string): string {
  return `${window.location.origin}/m/${token}`
}
