import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  FileText, 
  Layers, 
  Settings,
  LogOut,
  Calculator,
  Activity,
  LogIn
} from 'lucide-react'

interface AdminLayoutProps {
  children: React.ReactNode
}

const navItems = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/admin/products', label: 'Products', icon: Package },
  { path: '/admin/systems', label: 'Systems', icon: Layers },
  { path: '/admin/stages', label: 'Stages', icon: FileText },
  { path: '/admin/users', label: 'Users', icon: Users },
  { path: '/admin/logs', label: 'Login Logs', icon: LogIn },
  { path: '/admin/activity', label: 'Activity Log', icon: Activity },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Magma Admin</h1>
              <p className="text-xs text-gray-500">Calculator Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-orange-50 text-orange-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-orange-600' : 'text-gray-400'}`} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
