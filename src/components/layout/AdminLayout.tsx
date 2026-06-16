import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { MagmaMark } from '@/components/brand/MagmaMark'
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
    <div className="min-h-screen bg-limestone">
      {/* Top header */}
      <header className="bg-bone border-b border-line px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MagmaMark size={40} />
            <div>
              <h1 className="font-medium text-basalt">Magma Admin</h1>
              <p className="text-xs text-stone">Calculator Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link 
              to="/"
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:text-basalt hover:bg-line-soft rounded-lg transition min-h-[44px]"
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:text-basalt hover:bg-line-soft rounded-lg transition min-h-[44px]"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-bone border-r border-line min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition min-h-[44px] ${
                    isActive
                      ? 'bg-molten-tint text-basalt'
                      : 'text-ink hover:bg-line-soft hover:text-basalt'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-molten' : 'text-ash'}`} />
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
