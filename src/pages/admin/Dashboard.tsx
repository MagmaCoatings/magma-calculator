import { Spinner } from '@/components/ui/spinner'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { FileText, Users, Package, Activity } from 'lucide-react'

interface DashboardStats {
  totalQuotes: number
  totalUsers: number
  totalProducts: number
  recentLogins: number
}

export function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalQuotes: 0,
    totalUsers: 0,
    totalProducts: 0,
    recentLogins: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  async function fetchStats() {
    const [quotesRes, usersRes, productsRes, loginsRes] = await Promise.all([
      supabase.from('quotes').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('login_logs').select('id', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ])

    setStats({
      totalQuotes: quotesRes.count || 0,
      totalUsers: usersRes.count || 0,
      totalProducts: productsRes.count || 0,
      recentLogins: loginsRes.count || 0
    })
    setLoading(false)
  }

  const statCards = [
    { label: 'Total Quotes', value: stats.totalQuotes, icon: FileText, href: '/quotes', color: 'text-molten-ink bg-molten-tint' },
    { label: 'Users', value: stats.totalUsers, icon: Users, href: '/admin/users', color: 'text-sage bg-sage-tint' },
    { label: 'Products', value: stats.totalProducts, icon: Package, href: '/admin/products', color: 'text-stone bg-track' },
    { label: 'Logins (7d)', value: stats.recentLogins, icon: Activity, href: '/admin/logs', color: 'text-molten-ink bg-molten-tint' },
  ]

  if (loading) {
    return (
      <Spinner />
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-basalt">Dashboard</h1>
        <p className="text-stone text-sm mt-1">System overview</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(stat => (
          <Link key={stat.label} to={stat.href}>
            <Card className="p-6 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-basalt">{stat.value}</p>
                  <p className="text-sm text-stone">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
