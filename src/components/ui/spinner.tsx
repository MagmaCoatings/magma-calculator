// Single, consistent loading spinner used across the whole app.
// Brand "molten" ring. Use <Spinner /> for in-page loading, <Spinner fullScreen />
// for route/auth-level loading, and the optional label for a caption.

interface SpinnerProps {
  size?: 'sm' | 'md'
  fullScreen?: boolean
  label?: string
  className?: string
}

const SIZES: Record<'sm' | 'md', string> = {
  sm: 'h-6 w-6 border-2',
  md: 'h-8 w-8 border-4',
}

export function Spinner({ size = 'md', fullScreen = false, label, className = '' }: SpinnerProps) {
  const ring = (
    <div
      className={`${SIZES[size]} rounded-full border-molten border-t-transparent animate-spin ${className}`}
      role="status"
      aria-label={label || 'Loading'}
    />
  )

  const content = (
    <div className="flex flex-col items-center justify-center gap-3">
      {ring}
      {label ? <p className="text-stone text-sm">{label}</p> : null}
    </div>
  )

  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center">{content}</div>
  }

  return <div className="flex items-center justify-center p-12">{content}</div>
}
