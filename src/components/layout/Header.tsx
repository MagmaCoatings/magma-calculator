import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, Calculator, FileText, User } from 'lucide-react'
import { MagmaMark } from '@/components/brand/MagmaMark'

export function Header() {
  const { profile, signOut } = useAuth()
  const location = useLocation()

  const isAdmin = profile?.role === 'admin'
  const isActive = (path: string) => location.pathname === path
  const isAdminActive = location.pathname.startsWith('/admin')

  return (
    <>
      {/* Desktop/Tablet Header */}
      <header className="bg-bone border-b border-line sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <MagmaMark size={32} />
              <span className="text-xl font-medium text-basalt">MAGMA</span>
              <span className="text-sm text-stone hidden sm:block">Calculator</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              <Link to="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 ${isActive('/') ? 'bg-molten-tint text-basalt' : ''}`}
                >
                  <Calculator className={`w-4 h-4 ${isActive('/') ? 'text-molten' : 'text-ash'}`} />
                  Calculator
                </Button>
              </Link>

              <Link to="/quotes">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`gap-2 ${isActive('/quotes') || location.pathname.startsWith('/quotes/') ? 'bg-molten-tint text-basalt' : ''}`}
                >
                  <FileText className={`w-4 h-4 ${isActive('/quotes') || location.pathname.startsWith('/quotes/') ? 'text-molten' : 'text-ash'}`} />
                  Quotes
                </Button>
              </Link>

              {isAdmin && (
                <Link to="/admin">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`gap-2 ${isAdminActive ? 'bg-molten-tint text-basalt' : ''}`}
                  >
                    <Settings className={`w-4 h-4 ${isAdminActive ? 'text-molten' : 'text-ash'}`} />
                    Admin
                  </Button>
                </Link>
              )}

              <div className="w-px h-6 bg-line mx-2" />

              {/* User menu */}
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-medium text-basalt">{profile?.full_name}</p>
                  <p className="text-xs text-stone">{profile?.company_name}</p>
                </div>
                <Link to="/profile">
                  <Button variant="ghost" size="icon" title="Your profile">
                    <User className="w-4 h-4" />
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </nav>

            {/* Mobile: just profile/logout icons */}
            <div className="flex lg:hidden items-center gap-1">
              {isAdmin && (
                <Link to="/admin">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={isAdminActive ? 'bg-molten-tint' : ''}
                  >
                    <Settings className={`w-5 h-5 ${isAdminActive ? 'text-molten' : 'text-ash'}`} />
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
                <LogOut className="w-5 h-5 text-ash" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-bone border-t border-line lg:hidden z-40 safe-bottom">
        <div className="flex items-center justify-around h-16">
          <Link to="/" className="flex-1">
            <div className={`flex flex-col items-center py-2 ${isActive('/') ? 'text-basalt' : 'text-ash'}`}>
              <div className={`p-1 rounded-lg ${isActive('/') ? 'bg-molten-tint' : ''}`}>
                <Calculator className={`w-6 h-6 ${isActive('/') ? 'text-molten' : ''}`} />
              </div>
              <span className="text-xs mt-1 font-medium">Calculator</span>
            </div>
          </Link>
          
          <Link to="/quotes" className="flex-1">
            <div className={`flex flex-col items-center py-2 ${isActive('/quotes') || location.pathname.startsWith('/quotes/') ? 'text-basalt' : 'text-ash'}`}>
              <div className={`p-1 rounded-lg ${isActive('/quotes') || location.pathname.startsWith('/quotes/') ? 'bg-molten-tint' : ''}`}>
                <FileText className={`w-6 h-6 ${isActive('/quotes') || location.pathname.startsWith('/quotes/') ? 'text-molten' : ''}`} />
              </div>
              <span className="text-xs mt-1 font-medium">Quotes</span>
            </div>
          </Link>
          
          <Link to="/profile" className="flex-1">
            <div className={`flex flex-col items-center py-2 ${isActive('/profile') ? 'text-basalt' : 'text-ash'}`}>
              <div className={`p-1 rounded-lg ${isActive('/profile') ? 'bg-molten-tint' : ''}`}>
                <User className={`w-6 h-6 ${isActive('/profile') ? 'text-molten' : ''}`} />
              </div>
              <span className="text-xs mt-1 font-medium">Profile</span>
            </div>
          </Link>
        </div>
      </nav>
    </>
  )
}
