import { Calculator } from '@/components/calculator/Calculator'
import { PushPrompt } from '@/components/notifications/PushPrompt'

export function CalculatorPage() {
  return (
    <>
      <div className="max-w-4xl mx-auto px-4 empty:hidden pt-4 -mb-4">
        <PushPrompt dismissible />
      </div>
      <Calculator />
    </>
  )
}
