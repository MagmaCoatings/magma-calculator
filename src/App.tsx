import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { LoginPage } from '@/pages/LoginPage'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { QuoteDetailPage } from '@/pages/QuoteDetailPage'
import { AdminDashboard as Dashboard } from '@/pages/admin/Dashboard'
import { ProductsPage } from '@/pages/admin/Products'
import { UsersPage } from '@/pages/admin/Users'
import { LoginLogsPage } from '@/pages/admin/LoginLogs'
import { StagesPage } from '@/pages/admin/StagesPage'
import { SystemsPage } from '@/pages/admin/SystemsPage'
import { Layout } from '@/components/Layout'

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <CalculatorPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/quotes" element={
        <ProtectedRoute>
          <Layout>
            <QuotesPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/quotes/:id" element={
        <ProtectedRoute>
          <Layout>
            <QuoteDetailPage />
          </Layout>
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/products" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <ProductsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <UsersPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/logs" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <LoginLogsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/stages" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <StagesPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="/admin/systems" element={
        <ProtectedRoute adminOnly>
          <Layout>
            <SystemsPage />
          </Layout>
        </ProtectedRoute>
      } />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
