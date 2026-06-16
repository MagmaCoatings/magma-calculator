import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, MapPin, Monitor, Smartphone, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'

const ITEMS_PER_PAGE = 50

interface LoginLog {
  id: string
  user_id: string
  email: string
  ip_address: string | null
  city: string | null
  region: string | null
  country: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  success: boolean
  failure_reason: string | null
  created_at: string
  user_name?: string
}

export function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [successFilter, setSuccessFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    setCurrentPage(1)
  }, [search, successFilter])

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('login_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.error('Error fetching logs:', error)
    } else {
      // Get user names
      const logsWithNames = await Promise.all((data || []).map(async (log) => {
        if (log.user_id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', log.user_id)
            .single()
          log.user_name = profile?.full_name || null
        }
        return log
      }))
      setLogs(logsWithNames)
    }
    setLoading(false)
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.email?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.ip_address?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.city?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.country?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (log.user_name?.toLowerCase() || '').includes(search.toLowerCase())
    const matchesSuccess = 
      successFilter === 'all' || 
      (successFilter === 'success' && log.success) ||
      (successFilter === 'failed' && !log.success)
    return matchesSearch && matchesSuccess
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
      minute: '2-digit',
      second: '2-digit'
    })
  }

  function getDeviceIcon(deviceType: string | null) {
    if (deviceType === 'mobile') return <Smartphone className="w-4 h-4" />
    return <Monitor className="w-4 h-4" />
  }

  function getLocation(log: LoginLog) {
    const parts = [log.city, log.region, log.country].filter(Boolean)
    return parts.length > 0 ? parts.join(', ') : 'Unknown'
  }

  // Detect suspicious logins (multiple failed attempts, unusual locations, etc.)
  function isSuspicious(log: LoginLog) {
    // Simple heuristic: failed login or unusual country
    if (!log.success) return true
    // Add more checks here as needed
    return false
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const failedCount = logs.filter(l => !l.success).length
  const successCount = logs.filter(l => l.success).length

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Login Logs</h1>
          <p className="text-gray-500 text-sm mt-1">
            {successCount} successful, {failedCount} failed (last 1000 entries)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, name, IP, city, or country..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'All' },
            { value: 'success', label: 'Successful' },
            { value: 'failed', label: 'Failed' },
          ].map(option => (
            <button
              key={option.value}
              onClick={() => setSuccessFilter(option.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                successFilter === option.value
                  ? 'bg-charcoal text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <Card className="p-12 text-center">
          <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No logs found</h3>
          <p className="text-gray-500">Try adjusting your search or filters</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {paginatedLogs.map(log => (
            <Card key={log.id} className={`p-3 ${isSuspicious(log) ? 'border-l-4 border-l-red-500' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={`w-2 h-2 rounded-full ${log.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium text-gray-900">
                      {log.user_name || log.email}
                    </span>
                    {!log.success && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        <AlertTriangle className="w-3 h-3" />
                        Failed
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      {getDeviceIcon(log.device_type)}
                      {log.browser || 'Unknown browser'} / {log.os || 'Unknown OS'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {getLocation(log)}
                    </span>
                    {log.ip_address && (
                      <span className="font-mono text-gray-400">{log.ip_address}</span>
                    )}
                  </div>
                  {log.failure_reason && (
                    <p className="text-xs text-red-600 mt-1">{log.failure_reason}</p>
                  )}
                </div>
                <div className="text-right text-xs text-gray-400">
                  {formatDate(log.created_at)}
                </div>
              </div>
            </Card>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {startIndex + 1}-{Math.min(endIndex, filteredLogs.length)} of {filteredLogs.length} logs
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
