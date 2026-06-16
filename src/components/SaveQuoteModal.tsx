import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Save, Check } from 'lucide-react'

interface ShoppingItem {
  code: string
  name: string
  quantity: number
  unitPrice: number
  total: number
}

interface SaveQuoteModalProps {
  isOpen: boolean
  onClose: () => void
  surfaceType: string
  floorArea: number
  wallArea: number
  items: ShoppingItem[]
  subtotal: number
  vat: number
  total: number
}

export function SaveQuoteModal({
  isOpen,
  onClose,
  surfaceType,
  floorArea,
  wallArea,
  items,
  subtotal,
  vat,
  total,
}: SaveQuoteModalProps) {
  const navigate = useNavigate()
  const [clientName, setClientName] = useState('')
  const [projectName, setProjectName] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedRef, setSavedRef] = useState('')

  if (!isOpen) return null

  async function handleSave() {
    setSaving(true)

    try {
      // Generate reference
      const { data: refData, error: refError } = await supabase.rpc('generate_quote_reference')
      
      if (refError) {
        console.error('Error generating reference:', refError)
        alert('Error generating quote reference')
        setSaving(false)
        return
      }

      const reference = refData || `MQ-${Date.now()}`

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      // Create quote
      const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .insert({
          reference,
          client_name: clientName || null,
          project_name: projectName || null,
          surface_type: surfaceType,
          floor_area: floorArea,
          wall_area: wallArea,
          notes: notes || null,
          subtotal,
          vat,
          total,
          status: 'draft',
          created_by: user?.id || null,
        })
        .select()
        .single()

      if (quoteError) {
        console.error('Error creating quote:', quoteError)
        alert('Error saving quote: ' + quoteError.message)
        setSaving(false)
        return
      }

      // Create line items
      if (items.length > 0) {
        const quoteItems = items.map((item, index) => ({
          quote_id: quote.id,
          product_code: item.code,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          line_total: item.total,
          display_order: index,
        }))

        const { error: itemsError } = await supabase
          .from('quote_items')
          .insert(quoteItems)

        if (itemsError) {
          console.error('Error saving items:', itemsError)
        }
      }

      setSavedRef(reference)
      setSaved(true)
      setSaving(false)
    } catch (err) {
      console.error('Error:', err)
      alert('Error saving quote')
      setSaving(false)
    }
  }

  function handleViewQuote() {
    onClose()
    navigate('/quotes')
  }

  function handleClose() {
    setClientName('')
    setProjectName('')
    setNotes('')
    setSaved(false)
    setSavedRef('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />
      
      {/* Modal */}
      <div className="relative bg-bone rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <h2 className="text-lg font-medium text-basalt">
            {saved ? 'Quote Saved!' : 'Save Quote'}
          </h2>
          <button onClick={handleClose} className="p-1 text-ash hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {saved ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-sage-tint rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-sage" />
              </div>
              <p className="text-ink mb-2">Quote saved as</p>
              <p className="text-2xl font-mono font-bold text-molten-ink mb-6">{savedRef}</p>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={handleClose}>
                  Continue Editing
                </Button>
                <Button className="flex-1" onClick={handleViewQuote}>
                  View All Quotes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <Input
                  label="Client Name"
                  placeholder="e.g. John Smith"
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                />
                <Input
                  label="Project Name"
                  placeholder="e.g. Kitchen Floor"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Notes (optional)</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-line resize-none"
                    rows={3}
                    placeholder="Any additional notes..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="mt-4 p-3 bg-limestone rounded-lg">
                <div className="flex justify-between text-sm text-ink mb-1">
                  <span className="capitalize">{surfaceType}</span>
                  <span>
                    {surfaceType === 'floor' && `${floorArea}m²`}
                    {surfaceType === 'wall' && `${wallArea}m²`}
                    {surfaceType === 'both' && `${floorArea}m² floor + ${wallArea}m² wall`}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-ink">
                  <span>{items.length} items</span>
                  <span className="font-medium text-basalt">Total: £{total.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!saved && (
          <div className="px-6 py-4 bg-limestone border-t border-line-soft">
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Quote
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
