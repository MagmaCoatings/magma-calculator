// One document in a list: what it is, which version, and View / Download
import { FileText, Download, ExternalLink, Lock, Clock } from 'lucide-react'
import { DOC_TYPE_LABELS, fileSizeLabel, hasFile, issueLabel, logDocumentEvent, type DocUrls, type DocumentRow } from '@/lib/documents'

const actionCls = 'inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-line bg-bone text-sm font-medium text-ink hover:border-stone'

export function DocumentItem({ doc, urls, detail }: { doc: DocumentRow; urls?: DocUrls; detail?: string }) {
  const ready = hasFile(doc)
  const meta = [DOC_TYPE_LABELS[doc.doc_type], issueLabel(doc), fileSizeLabel(doc.file_size)].filter(Boolean).join(' · ')

  return (
    <div className="flex gap-3 py-3">
      <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ready ? 'bg-molten-tint' : 'bg-limestone'}`}>
        {ready ? <FileText className="w-5 h-5 text-molten-ink" aria-hidden="true" /> : <Clock className="w-5 h-5 text-stone" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        <p className="font-medium text-basalt">
          {doc.title}
          {doc.visibility === 'installers' && <Lock className="w-3.5 h-3.5 text-stone inline-block align-[-2px] ml-1.5" aria-label="Installers only" />}
        </p>
        <p className="text-xs text-stone mt-0.5">{meta}</p>
        {detail && <p className="text-xs text-stone mt-0.5">{detail}</p>}
        {doc.description && <p className="text-sm text-ink mt-1">{doc.description}</p>}
        {!ready ? (
          <p className="text-xs font-medium text-stone mt-2 inline-block bg-limestone rounded-full px-2.5 py-1">Coming soon</p>
        ) : urls ? (
          <div className="flex flex-wrap gap-2 mt-2">
            <a className={actionCls} href={urls.view} target="_blank" rel="noopener noreferrer" onClick={() => logDocumentEvent(doc.id, 'open')}>
              <ExternalLink className="w-4 h-4" aria-hidden="true" /> View
            </a>
            <a className={actionCls} href={urls.download} rel="noopener noreferrer" onClick={() => logDocumentEvent(doc.id, 'download')}>
              <Download className="w-4 h-4" aria-hidden="true" /> Download
            </a>
          </div>
        ) : (
          <p className="text-xs text-stone mt-2">Unavailable just now. Please reload the page.</p>
        )}
      </div>
    </div>
  )
}
