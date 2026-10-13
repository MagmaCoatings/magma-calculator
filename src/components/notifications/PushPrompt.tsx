// "Get updates from Magma": asks to turn on phone alerts for this device.
// On iPhone/iPad in Safari it explains Add to Home Screen first (Apple only allows
// web alerts for apps added to the home screen, iOS 16.4 or later).
import { useEffect, useState } from 'react'
import { Bell, Share, PlusSquare, MoreHorizontal, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { enablePush, getPushState, type PushState } from '@/lib/push'

const DISMISS_KEY = 'magma-push-prompt-dismissed'
const ASK_AGAIN_AFTER_DAYS = 30

// "Not now" hides the card on this device; it comes back after 30 days
function readDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < ASK_AGAIN_AFTER_DAYS * 24 * 60 * 60 * 1000
  } catch { return false }
}
function writeDismissed() {
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch { /* private mode: just hide for now */ }
}

/** Current push state for this device, plus a setter for after enabling/disabling */
export function usePushState(): [PushState | null, (s: PushState) => void] {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => {
    let live = true
    getPushState().then(s => { if (live) setState(s) }).catch(() => { if (live) setState('unsupported') })
    return () => { live = false }
  }, [])
  return [state, setState]
}

export function IosInstallSteps() {
  return (
    <ol className="text-sm text-ink space-y-1.5 mt-2">
      <li className="flex items-start gap-2">
        <span className="w-5 h-5 rounded-full bg-limestone text-xs font-semibold flex items-center justify-center shrink-0 mt-px">1</span>
        <span>In Safari, tap <MoreHorizontal className="w-4 h-4 inline align-[-3px] text-basalt" aria-hidden="true" /> at the bottom, then <Share className="w-4 h-4 inline align-[-3px] text-basalt" aria-hidden="true" /> Share (on older iPhones, just tap Share)</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="w-5 h-5 rounded-full bg-limestone text-xs font-semibold flex items-center justify-center shrink-0 mt-px">2</span>
        <span>Choose <PlusSquare className="w-4 h-4 inline align-[-3px] text-basalt" aria-hidden="true" /> Add to Home Screen (you may need to tap View More first)</span>
      </li>
      <li className="flex items-start gap-2">
        <span className="w-5 h-5 rounded-full bg-limestone text-xs font-semibold flex items-center justify-center shrink-0 mt-px">3</span>
        <span>Open Magma from your home screen and turn alerts on</span>
      </li>
    </ol>
  )
}

/**
 * dismissible: shown on the calculator; "Not now" hides it on this device for 30 days.
 * Not dismissible: shown on the Notifications page whenever alerts are off.
 */
export function PushPrompt({ dismissible = false, className = '' }: { dismissible?: boolean; className?: string }) {
  const [state, setState] = usePushState()
  const [dismissed, setDismissed] = useState(() => dismissible && readDismissed())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justEnabled, setJustEnabled] = useState(false)

  if (dismissed || state === null || state === 'unsupported') return null
  if (state === 'on' && !justEnabled) return null
  if (state === 'denied' && dismissible) return null

  async function turnOn() {
    setBusy(true)
    setError(null)
    try {
      const next = await enablePush()
      setState(next)
      if (next === 'on') setJustEnabled(true)
    } catch {
      setError('Could not turn on alerts. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function notNow() {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div className={`bg-bone border border-line rounded-xl p-4 flex gap-3 ${className}`} role="region" aria-label="Phone alerts">
      <div className="w-9 h-9 rounded-full bg-molten-tint flex items-center justify-center shrink-0">
        <Bell className="w-4 h-4 text-molten-ink" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        {state === 'on' ? (
          <>
            <p className="text-sm font-medium text-basalt">Alerts are on for this device</p>
            <p className="text-sm text-stone mt-0.5">You can change what you receive on your Profile page.</p>
          </>
        ) : state === 'needs-install' ? (
          <>
            <p className="text-sm font-medium text-basalt">Get updates from Magma on your iPhone</p>
            <p className="text-sm text-stone mt-0.5">Add Magma to your home screen to receive price changes, new products and quote reminders.</p>
            <IosInstallSteps />
          </>
        ) : state === 'denied' ? (
          <>
            <p className="text-sm font-medium text-basalt">Alerts are blocked on this device</p>
            <p className="text-sm text-stone mt-0.5">
              To turn them on, allow notifications for this site in your browser or phone settings, then come back here.
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-basalt">Get updates from Magma</p>
            <p className="text-sm text-stone mt-0.5">Price changes, new products and quote reminders, straight to this device.</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Button size="sm" onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on alerts'}</Button>
              {dismissible && <Button size="sm" variant="ghost" onClick={notNow}>Not now</Button>}
            </div>
            {error && <p className="text-sm text-danger mt-2">{error}</p>}
          </>
        )}
      </div>
      {dismissible && state !== 'off' && (
        <button type="button" onClick={notNow} aria-label="Dismiss" className="text-stone hover:text-basalt min-w-[44px] min-h-[44px] -m-2 flex items-start justify-end p-2">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
