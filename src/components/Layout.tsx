import { Header } from '@/components/layout/Header'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-limestone">
      <Header />
      <main>
        {children}
      </main>
    </div>
  )
}
