// /m/<token>: one architect or designer file forwarded by an installer. No login. Lasts 30 days.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FileText, Download, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { MagmaMark, MagmaSpinner } from '@/components/brand/MagmaMark'
import { signMedia, sizeLabel } from '@/lib/media'

interface Shared {
  title: string
  description: string | null
  file_path: string
  file_name: string
  file_size: number
  mime_type: string
  expires_at: string
  company_name: string | null
  installer_name: string | null
}

const actionCls = 'inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone'

export function MediaSharePage() {
  const { token = '' } = useParams()
  const [data, setData] = useState<Shared | null | undefined>(undefined)
  const [view, setView] = useState<string | null>(null)
  const [dl, setDl] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('get_media_share', { p_token: token }).then(async ({ data, error }) => {
      const shared = error ? null : ((data as Shared) || null)
      if (shared) {
        const [v, d] = await Promise.all([signMedia([shared.file_path]), signMedia([shared.file_path], true)])
        setView(v[shared.file_path] || null)
        setDl(d[shared.file_path] || null)
      }
      setData(shared)
    })
  }, [token])

  const from = data?.company_name || data?.installer_name
  const isPdf = data?.mime_type === 'application/pdf'

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
        ) : data === null || !dl ? (
          <div className="bg-bone border border-line rounded-xl p-8 text-center">
            <p className="font-medium text-basalt">This link is no longer available</p>
            <p className="text-sm text-stone mt-1">Please ask your installer for a new link.</p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-medium text-basalt [overflow-wrap:anywhere]">{data.title}</h1>
            <p className="text-sm text-stone mt-1">
              {from ? `Shared by ${from}, a Magma installer. ` : ''}Specification material for Magma microcement and coatings.
            </p>
            <div className="bg-bone border border-line rounded-xl p-4 mt-6 flex gap-3">
              <span className="w-10 h-10 rounded-lg bg-molten-tint flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-molten-ink" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                <p className="font-medium text-basalt">{data.file_name}</p>
                <p className="text-xs text-stone mt-0.5">{isPdf ? 'PDF' : 'Word document'} · {sizeLabel(data.file_size)}</p>
                {data.description && <p className="text-sm text-ink mt-1">{data.description}</p>}
                <div className="flex flex-wrap gap-2 mt-3">
                  {isPdf && view && (
                    <a className={actionCls} href={view} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" aria-hidden="true" /> View</a>
                  )}
                  <a className={actionCls} href={dl} rel="noopener noreferrer"><Download className="w-4 h-4" aria-hidden="true" /> Download</a>
                </div>
              </div>
            </div>
            <p className="text-xs text-stone mt-4">
              This link works until {new Date(data.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
            <p className="text-xs text-stone mt-8">
              Magma Coatings Ltd, microcement and specialist coatings. Specification enquiries: sales@magmacoatings.com. MAGMA is a trade mark of Magma Coatings Ltd.
            </p>
          </>
        )}
      </main>
    </div>
  )
}
