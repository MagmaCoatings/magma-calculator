import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, ChevronLeft, ChevronRight, FileText, Package, Users, Settings, Layers, Palette } from 'lucide-react'

const ITEMS_PER_PAGE = 50

interface ActivityLogEntry {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_name: string | null
  details: Record<string, unknown> | null
  created_at: string
  user_email?: string
  user_name?: string
}

export function ActivityLogPage() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [entityFilter, setEntityFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, actionFilter, entityFilter])

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching activity logs:', error)
    } else {
      // Get user info
      const logsWithUsers = await Promise.all((data || []).map(async (log) => {
        if (log.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', log.user_id)
            .single()
          log.user_name = profile?.full_name || null
          log.user_email = profile?.email || null
        }
        return log
      }))
      setLogs(logsWithUsers)
    }
    setLoading(false)
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.entity_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.user_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.user_email?.toLowerCase() || '').includes(search.toLowerCase())
    const matchesAction = actionFilter === 'all' || log.action === actionFilter
    const matchesEntity = entityFilter === 'all' || log.entity_type === entityFilter
    return matchesSearch && matchesAction && matchesEntity
  })

  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const endIndex = startIndex + ITEMS_PER_PAGE
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex)

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  function getEntityIcon(entityType: string) {
    switch (entityType) {
      case 'quote': return <FileText className="w-4 h-4" />
      case 'product': return <Package className="w-4 h-4" />
      case 'user': return <Users className="w-4 h-4" />
      case 'settings': return <Settings className="w-4 h-4" />
      case 'stage': return <Layers className="w-4 h-4" />
      case 'colour': return <Palette className="w-4 h-4" />
      default: return <Activity className="w-4 h-4" />
    }
  }

  function getActionColor(action: string) {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-700'
      case 'update': return 'bg-blue-100 text-blue-700'
      case 'delete': return 'bg-red-100 text-red-700'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const actions = [...new Set(logs.map(l => l.action))]
  const entities = [...new Set(logs.map(l => l.entity_type))]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-gray-500 text-sm mt-1">Audit trail of all system changes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, user, or email..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
        >
          <option value="all">All Actions</option>
          {actions.map(a => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
          ))}
        </select>
        <select
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm"
          value={entityFilter}
          onChange={e => setEntityFilter(e.target.value)}
        >
          <option value="all">All Types</option>
          {entities.map(e => (
            <option key={e} value={e}>{e.charAt(0).toUpperCase() + e.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No activity found</h3>
          <p className="text-gray-500">Activity will appear here as users make changes</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginatedLogs.map(log => (
            <Card key={log.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500">
                    {getEntityIcon(log.entity_type)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                      <span className="text-sm font-medium text-gray-900">
                        {log.entity_type}: {log.entity_name || log.entity_id || 'Unknown'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      by {log.user_name || log.user_email || 'Unknown user'}
                    </p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-400">
                  {formatDate(log.created_at)}
                </div>
              </div>
              {log.details && Object.keys(log.details).length > 0 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600 font-mono">
                  {JSON.stringify(log.details, null, 2)}
                </div>
              )}
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
