// Quote page: the documents for this quote's products and system, plus sharing with the client
import { useEffect, useMemo, useState } from 'react'
import { FileText, Link2, Copy, Check, Mail, MessageCircle, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useDocumentIndex } from '@/hooks/useDocumentIndex'
import { DocumentItem } from '@/components/documents/DocumentItem'
import { DOC_TYPE_LABELS, docsForQuote, hasFile, permanentLink } from '@/lib/documents'

interface Props {
  quoteId: string
  reference: string | null
  projectName: string | null
  productCodes: string[]
  systemIds: string[]
}

interface Share { token: string; expires_at: string }

export function QuoteDocuments({ quoteId, reference, projectName, productCodes, systemIds }: Props) {
  const { index, loading } = useDocumentIndex()
  const [productIds, setProductIds] = useState<string[]>([])
  const [share, setShare] = useState<Share | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const codesKey = productCodes.slice().sort().join('|')
  useEffect(() => {
    const codes = codesKey ? codesKey.split('|') : []
    if (codes.length === 0) { setProductIds([]); return }
    supabase.from('products').select('id').in('code', codes)
      .then(({ data }) => setProductIds(((data as { id: string }[]) || []).map(p => p.id)))
  }, [codesKey])

  // An existing, still-live share link for this quote
  useEffect(() => {
    supabase.from('quote_shares').select('token, expires_at').eq('quote_id', quoteId)
      .is('revoked_at', null).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => setShare(((data as Share[]) || [])[0] || null))
  }, [quoteId])

  const docs = useMemo(() => docsForQuote(index, productIds, systemIds), [index, productIds, systemIds])
  const shareable = docs.filter(d => d.visibility === 'public' && hasFile(d))

  if (loading || !index.ready || docs.length === 0) return null

  const shareUrl = share ? `${window.location.origin}/share/${share.token}` : ''
  const label = projectName || reference || 'your project'
  const shareMessage = `Here are the Magma product documents for ${label}: data sheets, safety data sheets and care guidance.\n\n${shareUrl}`

  async function createShare() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.from('quote_shares').insert({ quote_id: quoteId }).select('token, expires_at').single()
    setBusy(false)
    if (error || !data) { setError('Could not create the link. Please try again.'); return }
    setShare(data as Share)
  }

  async function revokeShare() {
    if (!share) return
    setBusy(true)
    setError(null)
    const { data, error } = await supabase.from('quote_shares').update({ revoked_at: new Date().toISOString() })
      .eq('token', share.token).select('token')
    setBusy(false)
    if (error || !data || data.length === 0) { setError('Could not turn off the link. Please try again.'); return }
    setShare(null)
  }

  async function copyShare() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Press and hold the link to copy it.')
    }
  }

  // A plain email of every public document with its permanent link (no login needed to open them)
  function emailLinks() {
    const lines = shareable.map(d => `${d.title} (${DOC_TYPE_LABELS[d.doc_type]})\n${permanentLink(d.slug)}`)
    const subject = `Magma product documents${projectName ? ` - ${projectName}` : reference ? ` - ${reference}` : ''}`
    const body = `Here are the Magma product documents for ${label}. Each link always opens the latest version.\n\n${lines.join('\n\n')}\n`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5" /> Documents ({docs.length})</CardTitle>
        {shareable.length > 0 && (
          <Button variant="outline" size="sm" onClick={emailLinks} className="gap-1.5">
            <Mail className="w-4 h-4" /> Email these links
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-line-soft -mt-2">
          {docs.map(d => <DocumentItem key={d.id} doc={d} urls={index.urls[d.id]} />)}
        </div>

        {shareable.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line">
            <p className="font-medium text-basalt flex items-center gap-2"><Link2 className="w-4 h-4" /> Share with your client</p>
            <p className="text-sm text-stone mt-1">
              A simple page with the data sheets and care guidance for this job. No login needed. Installers-only documents are not included.
            </p>
            {share ? (
              <div className="mt-3 space-y-2">
                <div className="flex gap-2">
                  <input readOnly value={shareUrl} aria-label="Client link" onFocus={e => e.currentTarget.select()}
                    className="flex-1 min-w-0 min-h-[40px] px-3 rounded-lg border border-line bg-limestone text-sm text-ink" />
                  <Button variant="outline" size="sm" onClick={copyShare} className="gap-1.5 shrink-0">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone"
                    href={`https://wa.me/?text=${encodeURIComponent(shareMessage)}`} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </a>
                  <a className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone"
                    href={`mailto:?subject=${encodeURIComponent(`Product documents for ${label}`)}&body=${encodeURIComponent(shareMessage)}`}>
                    <Mail className="w-4 h-4" /> Email
                  </a>
                  <button type="button" onClick={revokeShare} disabled={busy}
                    className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg text-sm font-medium text-stone hover:text-danger">
                    <X className="w-4 h-4" /> Turn off link
                  </button>
                </div>
                <p className="text-xs text-stone">
                  Works until {new Date(share.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              </div>
            ) : (
              <Button size="sm" className="mt-3 gap-1.5" onClick={createShare} disabled={busy}>
                <Link2 className="w-4 h-4" /> {busy ? 'Creating link…' : 'Create client link'}
              </Button>
            )}
            {error && <p className="text-sm text-danger mt-2">{error}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
