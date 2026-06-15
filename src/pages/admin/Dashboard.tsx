import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Users, Package, LogIn, AlertTriangle, FileText, ChevronRight } from 'lucide-react'

interface Stats {
  totalUsers: number
  activeUsers: number
  totalProducts: number
  totalQuotes: number
  recentLogins: number
  suspiciousLogins: number
}

export function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeUsers: 0,
    totalProducts: 0,
    totalQuotes: 0,
    recentLogins: 0,
    suspiciousLogins: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    // Fetch users count
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    const { count: activeUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Fetch products count
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Fetch quotes count
    const { count: totalQuotes } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true })

    // Fetch recent logins (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: recentLogins } = await supabase
      .from('login_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    const { count: suspiciousLogins } = await supabase
      .from('login_logs')
      .select('*', { count: 'exact', head: true })
      .eq('is_suspicious', true)
      .gte('created_at', sevenDaysAgo.toISOString())

    setStats({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      totalProducts: totalProducts || 0,
      totalQuotes: totalQuotes || 0,
      recentLogins: recentLogins || 0,
      suspiciousLogins: suspiciousLogins || 0,
    })
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                <p className="text-xs text-gray-400">{stats.activeUsers} active</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Products</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
                <p className="text-xs text-gray-400">active items</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Quotes</p>
                <p className="text-3xl font-bold text-gray-900">{stats.totalQuotes}</p>
                <p className="text-xs text-gray-400">total created</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Logins (7 days)</p>
                <p className="text-3xl font-bold text-gray-900">{stats.recentLogins}</p>
                <p className="text-xs text-gray-400">recent sessions</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <LogIn className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/admin/users" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">Manage Users</p>
                <p className="text-sm text-gray-500">Add installers, change roles, suspend accounts</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/admin/products" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">Manage Products</p>
                <p className="text-sm text-gray-500">Update prices, add new products</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/admin/logs" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">View Login Logs</p>
                <p className="text-sm text-gray-500">See who logged in and from where</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/admin/systems" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">Manage Systems</p>
                <p className="text-sm text-gray-500">Create and edit product systems</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/admin/stages" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">Manage Stages</p>
                <p className="text-sm text-gray-500">DPM, Primer, Base Coat, etc.</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/quotes" className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
              <div>
                <p className="font-medium">View All Quotes</p>
                <p className="text-sm text-gray-500">See quotes from all installers</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
          </CardContent>
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.suspiciousLogins > 0 ? (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Suspicious Logins Detected</p>
                  <p className="text-sm text-red-600">{stats.suspiciousLogins} suspicious login attempts in the last 7 days</p>
                  <Link to="/admin/logs" className="text-sm text-red-700 underline mt-1 inline-block">
                    View details →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                  <span className="text-white text-xs">✓</span>
                </div>
                <div>
                  <p className="font-medium text-green-800">All Clear</p>
                  <p className="text-sm text-green-600">No suspicious activity detected</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
