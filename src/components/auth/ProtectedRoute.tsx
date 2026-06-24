import { Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-limestone">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-molten border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-stone">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile?.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-limestone px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-basalt mb-2">Account Suspended</h1>
          <p className="text-stone mb-4">
            Your account has been suspended. Please contact Magma Coatings for assistance.
          </p>
          <a
            href="mailto:info@magmacoatings.com"
            className="text-molten-ink hover:underline"
          >
            info@magmacoatings.com
          </a>
        </div>
      </div>
    )
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
