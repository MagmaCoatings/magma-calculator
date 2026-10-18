// The client's page: /share/<token>. No login. Lists the public documents for one quote.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Download, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MagmaMark, MagmaSpinner } from '@/components/brand/MagmaMark'
import { DOC_TYPE_LABELS, issueLabel, signFiles, type DocType, type DocUrls } from '@/lib/documents'

interface SharedDoc {
  slug: string
  title: string
  doc_type: DocType
  version: string | null
  issue_date: string | null
  file_path: string
  file_name: string | null
}
interface Shared {
  project_name: string | null
  company_name: string | null
  installer_name: string | null
  documents: SharedDoc[]
}

const actionCls = 'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone'

export function SharedDocumentsPage() {
  const { token = '' } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [urls, setUrls] = useState<Record<string, DocUrls>>({})

  useEffect(() => {
    supabase.rpc('get_quote_share', { p_token: token }).then(async ({ data, error }) => {
      const shared = error ? null : ((data as Shared) || null)
      if (shared) setUrls(await signFiles(shared.documents.map(d => d.file_path)))
      setData(shared)
    })
  }, [token])

  const from = data?.company_name || data?.installer_name

  return (
    <div className="min-h-screen bg-limestone">
      <header className="bg-bone border-b border-line">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-2">
          <MagmaMark size={32} />
          <span className="text-xl font-medium text-basalt">MAGMA</span>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-4 py-8">
        {data === undefined ? (
          <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>
        ) : data === null ? (
          <div className="bg-bone border border-line rounded-xl p-8 text-center">
            <p className="font-medium text-basalt">This link has expired</p>
            <p className="text-sm text-stone mt-1">Please ask your installer for a new link.</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-medium text-basalt">Product documents{data.project_name ? `: ${data.project_name}` : ''}</h1>
            <p className="text-sm text-stone mt-1">
              {from ? `Shared by ${from}. ` : ''}The data sheets and care guidance for the Magma products used on your project.
            </p>
            {data.documents.length === 0 ? (
              <p className="text-sm text-stone mt-6">No documents are available for this project yet.</p>
            ) : (
              <div className="bg-bone border border-line rounded-xl px-4 mt-6 divide-y divide-line-soft">
                {data.documents.filter(d => urls[d.file_path]).map(d => {
                  const meta = [DOC_TYPE_LABELS[d.doc_type], issueLabel(d)].filter(Boolean).join(' · ')
                  return (
                    <div key={d.slug} className="flex gap-3 py-3">
                      <span className="w-10 h-10 rounded-lg bg-molten-tint flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-molten-ink" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                        <p className="font-medium text-basalt">{d.title}</p>
                        <p className="text-xs text-stone mt-0.5">{meta}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <a className={actionCls} href={urls[d.file_path].view} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" aria-hidden="true" /> View
                          </a>
                          <a className={actionCls} href={urls[d.file_path].download} rel="noopener noreferrer">
                            <Download className="w-4 h-4" aria-hidden="true" /> Download
                          </a>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-xs text-stone mt-8">
              Magma Coatings Ltd, microcement and specialist coatings. Questions about these documents: sales@magmacoatings.com
            </p>
          </>
        )}
      </main>
    </div>
  )
}
