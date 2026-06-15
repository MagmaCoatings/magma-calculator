import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { formatDateTime } from '@/lib/formatters'
import type { LoginLog, Profile } from '@/lib/types'
import { Search, AlertTriangle, Monitor, Smartphone, Tablet } from 'lucide-react'

interface LoginLogWithUser extends LoginLog {
  profiles?: Profile
}

export function LoginLogsPage() {
  const [logs, setLogs] = useState<LoginLogWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'suspicious'>('all')

  useEffect(() => {
    fetchLogs()
  }, [])

  async function fetchLogs() {
    const { data, error } = await supabase
      .from('login_logs')
      .select('*, profiles(full_name, email, company_name)')
      .order('logged_in_at', { ascending: false })
      .limit(200)

    if (error) {
      console.error('Error fetching logs:', error)
    } else {
      setLogs(data || [])
    }
    setLoading(false)
  }

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
      log.city?.toLowerCase().includes(search.toLowerCase()) ||
      log.country?.toLowerCase().includes(search.toLowerCase()) ||
      log.ip_address?.includes(search)

    const matchesFilter = filter === 'all' || (filter === 'suspicious' && log.is_suspicious)

    return matchesSearch && matchesFilter
  })

  const suspiciousCount = logs.filter(l => l.is_suspicious).length

  function getDeviceIcon(deviceType?: string) {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="w-4 h-4" />
      case 'tablet':
        return <Tablet className="w-4 h-4" />
      default:
        return <Monitor className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Login Logs</h1>
        {suspiciousCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4" />
            {suspiciousCount} suspicious login{suspiciousCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, location, IP..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-charcoal text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('all')}
          >
            All Logins
          </button>
          <button
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'suspicious'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={() => setFilter('suspicious')}
          >
            Suspicious Only
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Device</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Browser</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No login logs found
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className={log.is_suspicious ? 'bg-red-50' : ''}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{log.profiles?.full_name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{log.profiles?.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatDateTime(log.logged_in_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {log.city && log.country ? `${log.city}, ${log.country}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-500">
                      {log.ip_address || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(log.device_type || undefined)}
                        <span className="capitalize">{log.device_type || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>
                        <p>{log.browser || '-'}</p>
                        <p className="text-xs text-gray-400">{log.os}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.is_suspicious ? (
                        <div className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span className="text-xs font-medium">Suspicious</span>
                        </div>
                      ) : (
                        <span className="text-xs text-green-600 font-medium">Normal</span>
                      )}
                      {log.suspicious_reason && (
                        <p className="text-xs text-red-500 mt-1">{log.suspicious_reason}</p>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-sm text-gray-500 mt-4">
        Showing last 200 login events
      </p>
    </div>
  )
}
