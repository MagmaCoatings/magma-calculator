import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { loadDocumentIndex, type DocumentIndex } from '@/lib/documents'

const EMPTY: DocumentIndex = { docs: [], links: [], urls: {}, ready: false }

/** The document library (shared, loaded once per signed-in user, refreshed before its links expire). */
export function useDocumentIndex(): { index: DocumentIndex; loading: boolean } {
  const { user } = useAuth()
  const userKey = user?.id || 'anon'
  const [index, setIndex] = useState<DocumentIndex>(EMPTY)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let live = true
    const load = () => loadDocumentIndex(userKey).then(i => { if (live) { setIndex(i); setLoading(false) } })
    load()
    // Keep the ready-made links fresh while the page stays open
    const timer = window.setInterval(load, 10 * 60 * 1000)
    return () => { live = false; window.clearInterval(timer) }
  }, [userKey])
  return { index, loading }
}
