import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { ArrowLeft, Pencil, Save, Copy, Trash2, FileText, Send, CheckCircle, XCircle } from 'lucide-react'

interface Quote {
  id: string
  reference: string
  client_name: string | null
  project_name: string | null
  surface_type: string
  floor_area: number
  wall_area: number
  notes: string | null
  subtotal: number
  vat: number
  total: number
  status: string
  created_at: string
  updated_at: string
}

interface QuoteItem {
  id: string
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  display_order: number
}

export function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    client_name: '',
    project_name: '',
    notes: '',
  })

  useEffect(() => {
    if (id) fetchQuote()
  }, [id])

  async function fetchQuote() {
    if (!id) return
    
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('*')
      .eq('id', id)
      .single()

    if (quoteError) {
      console.error('Error fetching quote:', quoteError)
      navigate('/quotes')
      return
    }

    setQuote(quoteData)
    setEditForm({
      client_name: quoteData.client_name || '',
      project_name: quoteData.project_name || '',
      notes: quoteData.notes || '',
    })

    const { data: itemsData } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)
      .order('display_order')

    setItems(itemsData || [])
    setLoading(false)
  }

  async function saveEdit() {
    if (!quote) return

    const { error } = await supabase
      .from('quotes')
      .update({
        client_name: editForm.client_name || null,
        project_name: editForm.project_name || null,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quote.id)

    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setQuote({
        ...quote,
        client_name: editForm.client_name || null,
        project_name: editForm.project_name || null,
        notes: editForm.notes || null,
      })
      setEditing(false)
    }
  }

  async function updateStatus(newStatus: string) {
    if (!quote) return

    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', quote.id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      setQuote({ ...quote, status: newStatus })
    }
  }

  async function deleteQuote() {
    if (!quote) return
    if (!confirm(`Delete quote ${quote.reference}? This cannot be undone.`)) return

    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quote.id)

    if (error) {
      alert('Error deleting: ' + error.message)
    } else {
      navigate('/quotes')
    }
  }

  async function duplicateQuote() {
    if (!quote) return

    // Get new reference
    const { data: refData } = await supabase.rpc('generate_quote_reference')
    const newRef = refData || `MQ-${Date.now()}`

    // Create new quote
    const { data: newQuote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        reference: newRef,
        client_name: quote.client_name,
        project_name: quote.project_name ? `${quote.project_name} (Copy)` : null,
        surface_type: quote.surface_type,
        floor_area: quote.floor_area,
        wall_area: quote.wall_area,
        notes: quote.notes,
        subtotal: quote.subtotal,
        vat: quote.vat,
        total: quote.total,
        status: 'draft',
      })
      .select()
      .single()

    if (quoteError) {
      alert('Error duplicating: ' + quoteError.message)
      return
    }

    // Copy items
    if (items.length > 0) {
      const newItems = items.map(item => ({
        quote_id: newQuote.id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: item.line_total,
        display_order: item.display_order,
      }))

      await supabase.from('quote_items').insert(newItems)
    }

    navigate(`/quotes/${newQuote.id}`)
  }

  function copyShoppingList() {
    const list = items.map(item => 
      `${item.quantity} x ${item.product_name} @ £${formatCurrency(item.unit_price)} = £${formatCurrency(item.line_total)}`
    ).join('\n')

    const text = `${quote?.reference} - Shopping List\n` +
      `${quote?.client_name ? `Client: ${quote.client_name}\n` : ''}` +
      `${quote?.project_name ? `Project: ${quote.project_name}\n` : ''}` +
      `\n${list}\n\n` +
      `Subtotal: £${formatCurrency(quote?.subtotal || 0)}\n` +
      `VAT (20%): £${formatCurrency(quote?.vat || 0)}\n` +
      `Total: £${formatCurrency(quote?.total || 0)}`

    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Quote not found</p>
        <Button onClick={() => navigate('/quotes')} className="mt-4">Back to Quotes</Button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button
            onClick={() => navigate('/quotes')}
            className="flex items-center gap-1 text-gray-500 hover:text-gray-700 text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quotes
          </button>
          <h1 className="text-2xl font-bold text-gray-900 font-mono">{quote.reference}</h1>
          <p className="text-gray-500 text-sm mt-1">Created {formatDate(quote.created_at)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={copyShoppingList}>
            <Copy className="w-4 h-4 mr-1" /> Copy List
          </Button>
          <Button variant="outline" size="sm" onClick={duplicateQuote}>
            <FileText className="w-4 h-4 mr-1" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={deleteQuote} className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Status:</span>
            <div className="flex gap-2">
              {[
                { key: 'draft', label: 'Draft', icon: FileText, color: 'gray' },
                { key: 'sent', label: 'Sent', icon: Send, color: 'blue' },
                { key: 'accepted', label: 'Accepted', icon: CheckCircle, color: 'green' },
                { key: 'declined', label: 'Declined', icon: XCircle, color: 'red' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => updateStatus(s.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    quote.status === s.key
                      ? s.color === 'gray' ? 'bg-gray-200 text-gray-700'
                      : s.color === 'blue' ? 'bg-blue-100 text-blue-700'
                      : s.color === 'green' ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                      : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                  }`}
                >
                  <s.icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Client Details */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Details</CardTitle>
            {!editing && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-4">
                <Input
                  label="Client Name"
                  value={editForm.client_name}
                  onChange={e => setEditForm({ ...editForm, client_name: e.target.value })}
                  placeholder="e.g. John Smith"
                />
                <Input
                  label="Project Name"
                  value={editForm.project_name}
                  onChange={e => setEditForm({ ...editForm, project_name: e.target.value })}
                  placeholder="e.g. Kitchen Floor"
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 resize-none"
                    rows={3}
                    value={editForm.notes}
                    onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    placeholder="Any additional notes..."
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveEdit}>
                    <Save className="w-4 h-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <span className="text-sm text-gray-500">Client</span>
                  <p className="font-medium">{quote.client_name || <span className="text-gray-400 italic">Not specified</span>}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Project</span>
                  <p className="font-medium">{quote.project_name || <span className="text-gray-400 italic">Not specified</span>}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Surface Type</span>
                  <p className="font-medium">{quote.surface_type}</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Area</span>
                  <p className="font-medium">
                    {quote.floor_area > 0 && `${quote.floor_area}m² floor`}
                    {quote.floor_area > 0 && quote.wall_area > 0 && ' + '}
                    {quote.wall_area > 0 && `${quote.wall_area}m² wall`}
                  </p>
                </div>
                {quote.notes && (
                  <div>
                    <span className="text-sm text-gray-500">Notes</span>
                    <p className="font-medium whitespace-pre-wrap">{quote.notes}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals */}
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">£{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VAT (20%)</span>
                <span className="font-medium">£{formatCurrency(quote.vat)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-magma">£{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Materials ({items.length} items)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{item.product_name}</span>
                    <span className="text-gray-400 text-sm ml-2">({item.product_code})</span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-600">£{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium">£{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
