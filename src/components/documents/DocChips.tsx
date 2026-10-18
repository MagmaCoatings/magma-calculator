// Small "TDS · SDS" style links shown beside products and systems in the calculator
import { FileText } from 'lucide-react'
import { DOC_TYPE_LABELS, DOC_TYPE_SHORT, logDocumentEvent, type DocUrls, type DocumentRow } from '@/lib/documents'

const chipCls = 'inline-flex items-center gap-1 min-h-[28px] px-2 rounded-md border border-line bg-bone text-xs font-medium text-molten-ink hover:border-stone'

export function DocChips({ docs, urls, long = false, className = '' }: {
  docs: DocumentRow[]; urls: Record<string, DocUrls>; long?: boolean; className?: string
}) {
  const ready = docs.filter(d => urls[d.id])
  if (ready.length === 0) return null
  return (
    <span className={`flex flex-wrap gap-1.5 ${className}`}>
      {ready.map(d => (
        <a key={d.id} href={urls[d.id].view} target="_blank" rel="noopener noreferrer" className={chipCls}
          title={`${DOC_TYPE_LABELS[d.doc_type]}: ${d.title}`} onClick={() => logDocumentEvent(d.id, 'open')}>
          <FileText className="w-3.5 h-3.5" aria-hidden="true" />{long ? d.title : DOC_TYPE_SHORT[d.doc_type]}
        </a>
      ))}
    </span>
  )
}
