import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { Header } from '@/components/layout/Header'
import { LoginPage } from '@/pages/LoginPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { CalculatorPage } from '@/pages/CalculatorPage'
import { QuotesPage } from '@/pages/QuotesPage'
import { QuoteDetailPage } from '@/pages/QuoteDetailPage'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { AdminDashboard as Dashboard } from '@/pages/admin/Dashboard'
import { ProductsPage } from '@/pages/admin/Products'
import { UsersPage } from '@/pages/admin/Users'
import { LoginLogsPage } from '@/pages/admin/LoginLogs'
import { SystemsPage } from '@/pages/admin/SystemsPage'
import { StagesPage } from '@/pages/admin/StagesPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
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
  
  // Block suspended users
  if (profile?.status === 'suspended') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-sm max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Account Suspended</h1>
          <p className="text-gray-600 mb-4">Your account has been suspended. Please contact support for assistance.</p>
        </div>
      </div>
    )
  }
  
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
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
  
  // Block suspended users
  if (profile?.status === 'suspended') {
    return <Navigate to="/" replace />
  }
  
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />
  }
  
  return <>{children}</>
}

function AppRoutes() {
  const { user } = useAuth()
  
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      {/* Main App Routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Header />
          <CalculatorPage />
        </ProtectedRoute>
      } />
      
      <Route path="/quotes" element={
        <ProtectedRoute>
          <Header />
          <QuotesPage />
        </ProtectedRoute>
      } />
      
      <Route path="/quotes/:id" element={
        <ProtectedRoute>
          <Header />
          <QuoteDetailPage />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <AdminRoute>
          <AdminLayout>
            <Dashboard />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/products" element={
        <AdminRoute>
          <AdminLayout>
            <ProductsPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/systems" element={
        <AdminRoute>
          <AdminLayout>
            <SystemsPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/stages" element={
        <AdminRoute>
          <AdminLayout>
            <StagesPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/users" element={
        <AdminRoute>
          <AdminLayout>
            <UsersPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/logs" element={
        <AdminRoute>
          <AdminLayout>
            <LoginLogsPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      <Route path="/admin/settings" element={
        <AdminRoute>
          <AdminLayout>
            <SettingsPage />
          </AdminLayout>
        </AdminRoute>
      } />
      
      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes />
      </div>
    </AuthProvider>
  )
}
