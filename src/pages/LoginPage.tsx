import { LoginForm } from '@/components/auth/LoginForm'

export function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">
            <span className="text-magma">MAGMA</span>{' '}
            <span className="text-charcoal">Calculator</span>
          </h1>
          <p className="text-gray-500 mt-2">Sign in to access the material calculator</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
