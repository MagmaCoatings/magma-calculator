// Installers: every Magma document in one place
import { useEffect, useMemo, useState } from 'react'
import { Search, FolderOpen } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDocumentIndex } from '@/hooks/useDocumentIndex'
import { DocumentItem } from '@/components/documents/DocumentItem'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import { DOC_TYPE_ORDER, type DocType, type DocumentRow } from '@/lib/documents'

type Filter = 'all' | 'sheets' | 'install' | 'care'
const FILTERS: [Filter, string][] = [['all', 'All'], ['sheets', 'Data sheets'], ['install', 'Installation'], ['care', 'Care']]
const GROUP_TITLES: Record<DocType, string> = {
  tds: 'Technical Data Sheets',
  sds: 'Safety Data Sheets',
  install: 'Installation guides',
  care: 'Care and maintenance',
}

export function DocumentsPage() {
  const { index, loading } = useDocumentIndex()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})

  // Product and system names, to say what each document is for
  useEffect(() => {
    Promise.all([
      supabase.from('products').select('id, name'),
      supabase.from('systems').select('id, name'),
    ]).then(([p, s]) => {
      const map: Record<string, string> = {}
      for (const r of (p.data as { id: string; name: string }[]) || []) map[r.id] = r.name
      for (const r of (s.data as { id: string; name: string }[]) || []) map[r.id] = r.name
      setNames(map)
    })
  }, [])

  const forLabel = useMemo(() => {
    const m = new Map<string, string>()
    for (const d of index.docs) {
      const ls = index.links.filter(l => l.document_id === d.id)
      const items = ls.map(l => names[(l.product_id || l.system_id) as string]).filter(Boolean)
      m.set(d.id, ls.length === 0 ? 'For all jobs' : items.length ? `For ${items.join(', ')}` : '')
    }
    return m
  }, [index, names])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return index.docs.filter(d => {
      if (filter === 'sheets' && d.doc_type !== 'tds' && d.doc_type !== 'sds') return false
      if (filter === 'install' && d.doc_type !== 'install') return false
      if (filter === 'care' && d.doc_type !== 'care') return false
      if (!q) return true
      return `${d.title} ${d.description || ''} ${forLabel.get(d.id) || ''}`.toLowerCase().includes(q)
    })
  }, [index, filter, query, forLabel])

  const groups = DOC_TYPE_ORDER
    .map(t => [t, visible.filter(d => d.doc_type === t)] as [DocType, DocumentRow[]])
    .filter(([, list]) => list.length > 0)

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-28 lg:pb-8">
      <h1 className="text-xl font-medium text-basalt">Documents</h1>
      <p className="text-sm text-stone mt-1">Data sheets, safety sheets, installation and care guides for every Magma product.</p>

      <div className="mt-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Search documents</span>
          <Search className="w-4 h-4 text-stone absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search, e.g. Primer 180 or sealer"
            className="w-full min-h-[44px] pl-9 pr-3 rounded-lg border border-line bg-bone text-basalt focus:outline-none focus:ring-2 focus:ring-molten/30"
          />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)}
              className={`min-h-[40px] px-3.5 rounded-full text-sm ${filter === id ? 'bg-basalt text-bone font-medium border border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><MagmaSpinner size={40} /></div>
      ) : !index.ready || index.docs.length === 0 ? (
        <div className="bg-bone border border-line rounded-xl p-8 text-center mt-6">
          <FolderOpen className="w-8 h-8 text-ash mx-auto mb-3" aria-hidden="true" />
          <p className="font-medium text-basalt">Documents are on their way</p>
          <p className="text-sm text-stone mt-1">Data sheets and guides will appear here shortly.</p>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-stone mt-6">Nothing matches “{query}”.</p>
      ) : (
        groups.map(([type, list]) => (
          <section key={type} className="mt-6" aria-labelledby={`docs-${type}`}>
            <h2 id={`docs-${type}`} className="text-xs font-semibold text-stone uppercase tracking-wide mb-1">{GROUP_TITLES[type]}</h2>
            <div className="bg-bone border border-line rounded-xl px-4 divide-y divide-line-soft">
              {list.map(d => <DocumentItem key={d.id} doc={d} urls={index.urls[d.id]} detail={forLabel.get(d.id)} />)}
            </div>
          </section>
        ))
      )}
    </div>
  )
}
