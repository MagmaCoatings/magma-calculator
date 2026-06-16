interface MagmaMarkProps {
  size?: number
  withLetter?: boolean
  className?: string
}

export function MagmaMark({ size = 28, withLetter = true, className = '' }: MagmaMarkProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 40 40" 
      aria-label="Magma" 
      role="img"
      className={className}
    >
      {/* Left arc - brand orange */}
      <path 
        d="M18.5 3.4 A 16.6 16.6 0 0 0 18.5 36.6" 
        fill="none" 
        stroke="var(--color-molten, #F58E25)" 
        strokeWidth="3.4" 
        strokeLinecap="round"
      />
      {/* Right arc - ash grey */}
      <path 
        d="M21.5 3.4 A 16.6 16.6 0 0 1 21.5 36.6" 
        fill="none" 
        stroke="var(--color-ash, #A8A39B)" 
        strokeWidth="3.4" 
        strokeLinecap="round"
      />
      {withLetter && (
        <text 
          x="20" 
          y="27" 
          textAnchor="middle" 
          fontSize="18" 
          fontWeight="500" 
          fill="var(--color-stone, #6F6B64)"
        >
          M
        </text>
      )}
    </svg>
  )
}

interface MagmaSpinnerProps {
  size?: number
  className?: string
}

export function MagmaSpinner({ size = 28, className = '' }: MagmaSpinnerProps) {
  return (
    <div className={`animate-spin ${className}`}>
      <MagmaMark size={size} withLetter={false} />
    </div>
  )
}

// Larger spinner for page loading states
export function MagmaSpinnerLarge({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center p-12 ${className}`}>
      <MagmaSpinner size={48} />
    </div>
  )
}
