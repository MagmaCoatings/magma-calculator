// The permanent address of a document: /docs/<slug>
// Opens the current version of the PDF. Works without a login for public documents,
// so links in emails, on the website or forwarded to clients never stop working.
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { MagmaMark, MagmaSpinner } from '@/components/brand/MagmaMark'
import { DOC_BUCKET, DOC_COLUMNS, hasFile, type DocumentRow } from '@/lib/documents'

type State = { kind: 'loading' } | { kind: 'missing'; signedIn: boolean } | { kind: 'soon'; doc: DocumentRow } | { kind: 'error' }

export function DocumentLinkPage() {
  const { slug = '' } = useParams()
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let live = true
    ;(async () => {
      const [{ data: session }, { data, error }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from('documents').select(DOC_COLUMNS).eq('slug', slug.toLowerCase()).eq('is_active', true).maybeSingle(),
      ])
      if (!live) return
      if (error) { setState({ kind: 'error' }); return }
      if (!data) { setState({ kind: 'missing', signedIn: !!session.session }); return }
      const doc = data as DocumentRow
      if (!hasFile(doc)) { setState({ kind: 'soon', doc }); return }
      const { data: signed } = await supabase.storage.from(DOC_BUCKET).createSignedUrl(doc.file_path as string, 300)
      const url = signed?.signedUrl
      if (!live) return
      if (!url) { setState({ kind: 'error' }); return }
      if (session.session) {
        // Record the open before leaving the page (never wait more than a moment)
        await Promise.race([
          supabase.from('document_events').insert({ document_id: doc.id, event: 'open' }).then(() => undefined),
          new Promise(resolve => setTimeout(resolve, 800)),
        ])
      }
      window.location.replace(url)
    })()
    return () => { live = false }
  }, [slug])

  return (
    <div className="min-h-screen bg-limestone flex items-center justify-center p-6">
      <div className="bg-bone border border-line rounded-xl p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-4"><MagmaMark size={40} /></div>
        {state.kind === 'loading' && (
          <>
            <div className="flex justify-center"><MagmaSpinner size={32} /></div>
            <p className="text-sm text-stone mt-3">Opening document…</p>
          </>
        )}
        {state.kind === 'soon' && (
          <>
            <p className="font-medium text-basalt">{state.doc.title}</p>
            <p className="text-sm text-stone mt-1">This document is coming soon. Please check back shortly.</p>
          </>
        )}
        {state.kind === 'missing' && (
          <>
            <p className="font-medium text-basalt">This document isn't available</p>
            <p className="text-sm text-stone mt-1">
              {state.signedIn
                ? 'It may have been withdrawn. Find the current documents in the Documents tab.'
                : 'It may be for Magma installers only, or it may have been withdrawn.'}
            </p>
            <Link to={state.signedIn ? '/documents' : `/login?next=${encodeURIComponent(`/docs/${slug}`)}`} className="inline-block mt-4 text-sm font-medium text-molten-ink underline">
              {state.signedIn ? 'Go to Documents' : 'Installer login'}
            </Link>
          </>
        )}
        {state.kind === 'error' && (
          <>
            <p className="font-medium text-basalt">Something went wrong</p>
            <p className="text-sm text-stone mt-1">Please try again in a moment.</p>
          </>
        )}
        <p className="text-xs text-stone mt-6">Magma Coatings Ltd · magmacoatings.com</p>
      </div>
    </div>
  )
}
