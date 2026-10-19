import { useEffect, useState } from 'react'
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
  LogIn,
  Bell,
  FolderOpen,
  Menu,
  X,
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
  { path: '/admin/notifications', label: 'Notifications', icon: Bell },
  { path: '/admin/documents', label: 'Documents', icon: FolderOpen },
  { path: '/admin/logs', label: 'Login Logs', icon: LogIn },
  { path: '/admin/activity', label: 'Activity Log', icon: Activity },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
]

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="p-4 space-y-1">
      {navItems.map(item => {
        const Icon = item.icon
        const isActive = pathname === item.path
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={isActive ? 'page' : undefined}
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
  )
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const { signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const current = navItems.find(i => i.path === location.pathname)

  // Close the phone/tablet menu whenever a page is chosen
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  // Close with the Escape key
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const btnCls = 'flex items-center gap-2 px-3 py-2 text-sm text-ink hover:text-basalt hover:bg-line-soft rounded-lg transition min-h-[44px]'

  return (
    <div className="min-h-screen bg-limestone">
      {/* Top header */}
      <header className="bg-bone border-b border-line px-4 lg:px-6 py-3 lg:py-4 sticky top-0 z-30 lg:static">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 lg:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(o => !o)}
              className="lg:hidden flex items-center gap-2 -ml-1 px-2 py-2 rounded-lg text-basalt hover:bg-line-soft min-h-[44px]"
              aria-expanded={menuOpen}
              aria-controls="admin-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <span className="hidden lg:block"><MagmaMark size={40} /></span>
            <span className="lg:hidden"><MagmaMark size={32} /></span>
            <div className="min-w-0">
              <h1 className="font-medium text-basalt truncate">
                <span className="hidden sm:inline">Magma Admin</span>
                <span className="sm:hidden">{current ? current.label : 'Admin'}</span>
              </h1>
              <p className="text-xs text-stone hidden sm:block">Calculator Management</p>
            </div>
          </div>
          <div className="flex items-center gap-1 lg:gap-3 shrink-0">
            <Link to="/" className={btnCls} aria-label="Calculator">
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">Calculator</span>
            </Link>
            <button onClick={() => signOut()} className={btnCls} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Phone and tablet menu */}
      {menuOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-20 bg-basalt/30" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div id="admin-menu" className="lg:hidden fixed left-0 right-0 top-[69px] z-30 bg-bone border-b border-line shadow-lg max-h-[calc(100vh-69px)] overflow-y-auto">
            <NavLinks pathname={location.pathname} />
          </div>
        </>
      )}

      <div className="flex">
        {/* Sidebar (computer only) */}
        <aside className="hidden lg:block w-64 shrink-0 bg-bone border-r border-line min-h-[calc(100vh-73px)]">
          <NavLinks pathname={location.pathname} />
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
