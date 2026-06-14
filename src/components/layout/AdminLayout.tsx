import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { 
  LogOut, 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Calculator,
  ChevronLeft
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/products', label: 'Products', icon: Package },
    { path: '/admin/users', label: 'Users', icon: Users },
    { path: '/admin/logs', label: 'Login Logs', icon: FileText },
  ]

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-charcoal text-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-magma">MAGMA</span>
              <span className="text-sm text-gray-400">Admin Panel</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">{profile?.full_name}</span>
              <Button variant="ghost" size="sm" onClick={signOut} className="text-gray-300 hover:text-white hover:bg-white/10">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sub navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
                    isActive(item.path)
                      ? 'border-magma text-magma'
                      : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 hover:text-magma"
            >
              <ChevronLeft className="w-4 h-4" />
              <Calculator className="w-4 h-4" />
              Back to Calculator
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main>
        {children}
      </main>
    </div>
  )
}
