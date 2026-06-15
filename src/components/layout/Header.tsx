import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, Calculator, FileText } from 'lucide-react'

export function Header() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const isAdmin = profile?.role === 'admin'
  const isActive = (path: string) => location.pathname === path

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span className="text-2xl font-bold text-magma">MAGMA</span>
            <span className="text-sm text-gray-500 hidden sm:block">Calculator</span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link to="/">
              <Button
                variant={isActive('/') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <Calculator className="w-4 h-4" />
                <span className="hidden sm:inline">Calculator</span>
              </Button>
            </Link>

            <Link to="/quotes">
              <Button
                variant={isActive('/quotes') ? 'default' : 'ghost'}
                size="sm"
                className="gap-2"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Quotes</span>
              </Button>
            </Link>

            {isAdmin && (
              <Link to="/admin">
                <Button
                  variant={location.pathname.startsWith('/admin') ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-2"
                >
                  <Settings className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </Button>
              </Link>
            )}

            <div className="w-px h-6 bg-gray-200 mx-2" />

            {/* User menu */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-gray-900">{profile?.full_name}</p>
                <p className="text-xs text-gray-500">{profile?.company_name}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  )
}
