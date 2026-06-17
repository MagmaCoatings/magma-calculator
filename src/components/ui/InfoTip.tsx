import { useState, useRef, useEffect } from 'react'
import { Info, X } from 'lucide-react'

interface InfoTipProps {
  content: string
  className?: string
}

export function InfoTip({ content, className = '' }: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on click outside (desktop) and on Escape
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(e: MouseEvent) {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  if (!content) return null

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onMouseEnter={() => { if (window.matchMedia('(min-width: 640px)').matches) setIsOpen(true) }}
        onMouseLeave={() => { if (window.matchMedia('(min-width: 640px)').matches) setIsOpen(false) }}
        className="text-ash hover:text-ink focus:outline-none focus:text-ink transition-colors min-h-[24px] min-w-[24px] inline-flex items-center justify-center"
        aria-label="More information"
        aria-expanded={isOpen}
      >
        <Info className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          {/* Desktop / tablet: hover-style popover above the icon */}
          <div
            ref={tipRef}
            className="hidden sm:block absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72"
            role="tooltip"
          >
            <div className="bg-basalt text-white text-sm rounded-lg shadow-lg p-3 relative">
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-basalt" />
              <p>{content}</p>
            </div>
          </div>

          {/* Mobile: bottom sheet with backdrop */}
          <div className="sm:hidden">
            <div
              className="fixed inset-0 z-[60] bg-basalt/40"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="fixed inset-x-0 bottom-0 z-[60] bg-bone rounded-t-2xl shadow-2xl p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-line" />
              <div className="flex items-start justify-between gap-3">
                <p className="text-ink text-base leading-relaxed">{content}</p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="shrink-0 text-stone hover:text-ink min-h-[44px] min-w-[44px] -mr-2 -mt-2 inline-flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  )
}
