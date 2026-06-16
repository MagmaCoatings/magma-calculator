import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { ArrowLeft, Pencil, Save, Copy, Trash2, FileText, Send, CheckCircle, XCircle, Plus, Download, Mail, History, Clock } from 'lucide-react'
import { QuotePDF } from '@/components/QuotePDF'
import { MagmaSpinner } from '@/components/brand/MagmaMark'
import { 
  logQuoteStatusChange, 
  logQuoteUpdated, 
  logQuoteItemAdded, 
  logQuoteItemRemoved, 
  logQuoteItemUpdated,
  logQuoteDuplicated 
} from '@/lib/quoteHistory'

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

interface Product {
  id: string
  name: string
  code: string
  price: number
  pack_size: number
  pack_unit: string
}

interface HistoryEntry {
  id: string
  action: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  details: { productName?: string; quantity?: number; reference?: string; sourceReference?: string; newReference?: string } | null
  created_at: string
  user: { full_name: string | null; email: string } | null
}

export function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editItemQty, setEditItemQty] = useState(0)
  const [editForm, setEditForm] = useState({
    client_name: '',
    project_name: '',
    notes: '',
  })
  
  // Add product state
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [newProductQty, setNewProductQty] = useState(1)
  const [addingProduct, setAddingProduct] = useState(false)
  
  // History state
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

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

  function toggleHistory() {
    if (!showHistory) {
      fetchHistory()
    }
    setShowHistory(!showHistory)
  }

  async function fetchHistory() {
    if (!id) return
    
    const { data } = await supabase
      .from('quote_history')
      .select('*, user:profiles(full_name, email)')
      .eq('quote_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    
    setHistory(data || [])
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
      // Log changes
      if (editForm.client_name !== (quote.client_name || '')) {
        logQuoteUpdated(quote.id, 'client_name', quote.client_name, editForm.client_name || null)
      }
      if (editForm.project_name !== (quote.project_name || '')) {
        logQuoteUpdated(quote.id, 'project_name', quote.project_name, editForm.project_name || null)
      }
      if (editForm.notes !== (quote.notes || '')) {
        logQuoteUpdated(quote.id, 'notes', quote.notes, editForm.notes || null)
      }
      
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
    if (quote.status === newStatus) return // No change

    const oldStatus = quote.status
    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', quote.id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      logQuoteStatusChange(quote.id, oldStatus, newStatus)
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

  function startEditItem(item: QuoteItem) {
    setEditingItemId(item.id)
    setEditItemQty(item.quantity)
  }

  async function saveItemEdit(item: QuoteItem) {
    if (!quote || editItemQty < 1) return
    if (editItemQty === item.quantity) {
      setEditingItemId(null)
      return // No change
    }

    const newLineTotal = editItemQty * item.unit_price
    const oldLineTotal = item.line_total
    const oldQty = item.quantity

    const { error } = await supabase
      .from('quote_items')
      .update({ quantity: editItemQty, line_total: newLineTotal })
      .eq('id', item.id)

    if (error) {
      alert('Error updating item: ' + error.message)
      return
    }

    // Log the change
    logQuoteItemUpdated(quote.id, item.product_name, oldQty, editItemQty)

    // Update local state
    const updatedItems = items.map(i => 
      i.id === item.id ? { ...i, quantity: editItemQty, line_total: newLineTotal } : i
    )
    setItems(updatedItems)

    // Recalculate totals
    const newSubtotal = quote.subtotal - oldLineTotal + newLineTotal
    const newVat = newSubtotal * 0.2
    const newTotal = newSubtotal + newVat

    await supabase
      .from('quotes')
      .update({ subtotal: newSubtotal, vat: newVat, total: newTotal, updated_at: new Date().toISOString() })
      .eq('id', quote.id)

    setQuote({ ...quote, subtotal: newSubtotal, vat: newVat, total: newTotal })
    setEditingItemId(null)
  }

  async function deleteItem(item: QuoteItem) {
    if (!quote) return
    if (!confirm(`Remove ${item.product_name} from quote?`)) return

    const { error } = await supabase
      .from('quote_items')
      .delete()
      .eq('id', item.id)

    if (error) {
      alert('Error removing item: ' + error.message)
      return
    }

    // Log the removal
    logQuoteItemRemoved(quote.id, item.product_name)

    // Update local state
    const updatedItems = items.filter(i => i.id !== item.id)
    setItems(updatedItems)

    // Recalculate totals
    const newSubtotal = quote.subtotal - item.line_total
    const newVat = newSubtotal * 0.2
    const newTotal = newSubtotal + newVat

    await supabase
      .from('quotes')
      .update({ subtotal: newSubtotal, vat: newVat, total: newTotal, updated_at: new Date().toISOString() })
      .eq('id', quote.id)

    setQuote({ ...quote, subtotal: newSubtotal, vat: newVat, total: newTotal })
  }

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('id, name, code, price, pack_size, pack_unit')
      .eq('is_active', true)
      .order('name')
    
    setProducts(data || [])
  }

  function openAddProduct() {
    fetchProducts()
    setSelectedProductId('')
    setNewProductQty(1)
    setShowAddProduct(true)
  }

  async function addProductToQuote() {
    if (!quote || !selectedProductId) return
    
    const product = products.find(p => p.id === selectedProductId)
    if (!product) return

    setAddingProduct(true)

    const lineTotal = newProductQty * product.price
    const maxOrder = Math.max(...items.map(i => i.display_order || 0), 0)

    const { data: newItem, error } = await supabase
      .from('quote_items')
      .insert({
        quote_id: quote.id,
        product_code: product.code,
        product_name: product.name,
        quantity: newProductQty,
        unit_price: product.price,
        line_total: lineTotal,
        display_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) {
      alert('Error adding product: ' + error.message)
      setAddingProduct(false)
      return
    }

    // Log the addition
    logQuoteItemAdded(quote.id, product.name, newProductQty)

    // Update local state
    setItems([...items, newItem])

    // Recalculate totals
    const newSubtotal = quote.subtotal + lineTotal
    const newVat = newSubtotal * 0.2
    const newTotal = newSubtotal + newVat

    await supabase
      .from('quotes')
      .update({ subtotal: newSubtotal, vat: newVat, total: newTotal, updated_at: new Date().toISOString() })
      .eq('id', quote.id)

    setQuote({ ...quote, subtotal: newSubtotal, vat: newVat, total: newTotal })
    setShowAddProduct(false)
    setAddingProduct(false)
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

    // Log duplication on the new quote
    logQuoteDuplicated(newQuote.id, quote.reference, newRef)

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

  function sendQuoteEmail() {
    if (!quote) return

    const getAreaDisplay = () => {
      if (quote.surface_type === 'floor') return `${quote.floor_area}m² floor`
      if (quote.surface_type === 'wall') return `${quote.wall_area}m² wall`
      return `${quote.floor_area}m² floor + ${quote.wall_area}m² wall`
    }

    const materialsList = items.map(item => 
      `${item.quantity} × ${item.product_name} @ £${formatCurrency(item.unit_price)} each = £${formatCurrency(item.line_total)}`
    ).join('\n')

    const subject = `Quote ${quote.reference}${quote.project_name ? ` - ${quote.project_name}` : ''}`
    
    const body = `Could I please place the order for the following materials:

QUOTE REFERENCE: ${quote.reference}
${quote.client_name ? `\nClient: ${quote.client_name}` : ''}
Surface: ${quote.surface_type.charAt(0).toUpperCase() + quote.surface_type.slice(1)}
Area: ${getAreaDisplay()}

MATERIALS
${materialsList}

TOTALS
Subtotal: £${formatCurrency(quote.subtotal)}
VAT (20%): £${formatCurrency(quote.vat)}
Total: £${formatCurrency(quote.total)}

PALLET / DELIVERY COSTS: TBC
(Quoted at time of order)

Thank you...`

    const mailtoLink = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailtoLink
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
        <MagmaSpinner size={48} />
      </div>
    )
  }

  if (!quote) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-stone">Quote not found</p>
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
            className="flex items-center gap-1 text-stone hover:text-ink text-sm mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Quotes
          </button>
          <h1 className="text-2xl font-bold text-basalt font-mono">{quote.reference}</h1>
          <p className="text-stone text-sm mt-1">Created {formatDate(quote.created_at)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <PDFDownloadLink
            document={
              <QuotePDF
                reference={quote.reference}
                clientName={quote.client_name}
                projectName={quote.project_name}
                surfaceType={quote.surface_type}
                floorArea={quote.floor_area}
                wallArea={quote.wall_area}
                notes={quote.notes}
                items={items}
                subtotal={quote.subtotal}
                vat={quote.vat}
                total={quote.total}
                createdAt={quote.created_at}
              />
            }
            fileName={`${quote.reference}.pdf`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md border border-line bg-bone hover:bg-limestone"
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <>
                  <MagmaSpinner size={16} />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  PDF
                </>
              )
            }
          </PDFDownloadLink>
          <Button variant="outline" size="sm" onClick={sendQuoteEmail}>
            <Mail className="w-4 h-4 mr-1" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={copyShoppingList}>
            <Copy className="w-4 h-4 mr-1" /> Copy List
          </Button>
          <Button variant="outline" size="sm" onClick={duplicateQuote}>
            <FileText className="w-4 h-4 mr-1" /> Duplicate
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={toggleHistory}
          >
            <History className="w-4 h-4 mr-1" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={deleteQuote} className="text-danger hover:bg-danger-tint">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink">Status:</span>
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
                      ? s.color === 'gray' ? 'bg-track text-ink'
                      : s.color === 'blue' ? 'bg-molten-tint text-molten-ink'
                      : s.color === 'green' ? 'bg-sage-tint text-sage'
                      : 'bg-danger-tint text-danger'
                      : 'bg-limestone text-ash hover:bg-line-soft'
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
                  <label className="block text-sm font-medium text-ink mb-1">Notes</label>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-line resize-none"
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
                  <span className="text-sm text-stone">Client</span>
                  <p className="font-medium">{quote.client_name || <span className="text-ash italic">Not specified</span>}</p>
                </div>
                <div>
                  <span className="text-sm text-stone">Project</span>
                  <p className="font-medium">{quote.project_name || <span className="text-ash italic">Not specified</span>}</p>
                </div>
                <div>
                  <span className="text-sm text-stone">Surface Type</span>
                  <p className="font-medium">{quote.surface_type}</p>
                </div>
                <div>
                  <span className="text-sm text-stone">Area</span>
                  <p className="font-medium">
                    {quote.surface_type === 'floor' && `${quote.floor_area}m²`}
                    {quote.surface_type === 'wall' && `${quote.wall_area}m²`}
                    {quote.surface_type === 'both' && `${quote.floor_area}m² floor + ${quote.wall_area}m² wall`}
                  </p>
                </div>
                {quote.notes && (
                  <div>
                    <span className="text-sm text-stone">Notes</span>
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
                <span className="text-stone">Subtotal</span>
                <span className="font-medium">£{formatCurrency(quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone">VAT (20%)</span>
                <span className="font-medium">£{formatCurrency(quote.vat)}</span>
              </div>
              <div className="border-t border-line-soft pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-medium">Total</span>
                  <span className="text-xl font-bold text-molten-ink">£{formatCurrency(quote.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Materials ({items.length} items)</CardTitle>
          <Button variant="outline" size="sm" onClick={openAddProduct}>
            <Plus className="w-4 h-4 mr-1" /> Add Product
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {/* Smart calculation explanation */}
          {items.some(item => item.product_name.includes('✦')) && (
            <div className="mx-4 mt-4 bg-molten-tint border border-line rounded-lg px-3 py-2">
              <p className="text-xs text-stone">
                <span className="font-medium">✦ Smart calculation:</span> These materials were calculated once for the combined floor + wall area — no need to buy separately for each surface.
              </p>
            </div>
          )}
          
          {/* Add product form */}
          {showAddProduct && (
            <div className="mx-4 mt-4 p-4 bg-limestone rounded-lg border border-line">
              <h4 className="font-medium text-basalt mb-3">Add Product</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm text-ink mb-1">Product</label>
                  <select
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg bg-bone"
                  >
                    <option value="">Select a product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — £{formatCurrency(p.price)} / {p.pack_size}{p.pack_unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-ink mb-1">Quantity</label>
                  <Input
                    type="number"
                    min="1"
                    value={newProductQty}
                    onChange={e => setNewProductQty(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button 
                  onClick={addProductToQuote} 
                  disabled={!selectedProductId || addingProduct}
                  size="sm"
                >
                  {addingProduct ? 'Adding...' : 'Add to Quote'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowAddProduct(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
          
          <table className="w-full">
            <thead className="bg-track border-b border-line">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-stone uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-stone uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-stone uppercase">Total</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-basalt">{item.product_name}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-ink">
                    {editingItemId === item.id ? (
                      <input
                        type="number"
                        min="1"
                        value={editItemQty}
                        onChange={e => setEditItemQty(parseInt(e.target.value) || 1)}
                        className="w-16 px-2 py-1 text-right border border-stone rounded"
                        autoFocus
                      />
                    ) : (
                      item.quantity
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-ink">£{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium">
                    £{formatCurrency(editingItemId === item.id ? editItemQty * item.unit_price : item.line_total)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingItemId === item.id ? (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => saveItemEdit(item)}
                          className="p-1 text-sage hover:bg-sage-tint rounded"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingItemId(null)}
                          className="p-1 text-ash hover:bg-line-soft rounded"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-end">
                        <button
                          onClick={() => startEditItem(item)}
                          className="p-1 text-ash hover:text-molten-ink hover:bg-molten-tint rounded"
                          title="Edit quantity"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="p-1 text-ash hover:text-danger hover:bg-danger-tint rounded"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* History Panel */}
      {showHistory && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Quote History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length === 0 ? (
              <p className="text-stone text-sm">No history recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {history.map(entry => (
                  <div key={entry.id} className="flex gap-3 text-sm border-b border-line-soft pb-3 last:border-0">
                    <div className="flex-shrink-0 w-24 text-ash">
                      {new Date(entry.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      <br />
                      <span className="text-xs">
                        {new Date(entry.created_at).toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div className="flex-1">
                      {entry.action === 'created' && (
                        <span className="text-sage">Quote created</span>
                      )}
                      {entry.action === 'status_changed' && (
                        <span>
                          Status changed from <span className="font-medium">{entry.old_value}</span> to{' '}
                          <span className="font-medium">{entry.new_value}</span>
                        </span>
                      )}
                      {entry.action === 'updated' && (
                        <span>
                          Updated <span className="font-medium">{entry.field_name?.replace('_', ' ')}</span>
                          {entry.old_value && entry.new_value && (
                            <>
                              {' '}from "{entry.old_value}" to "{entry.new_value}"
                            </>
                          )}
                        </span>
                      )}
                      {entry.action === 'item_added' && (
                        <span className="text-sage">
                          Added <span className="font-medium">{entry.details?.productName}</span> × {entry.details?.quantity}
                        </span>
                      )}
                      {entry.action === 'item_removed' && (
                        <span className="text-danger">
                          Removed <span className="font-medium">{entry.details?.productName}</span>
                        </span>
                      )}
                      {entry.action === 'item_updated' && (
                        <span>
                          Changed <span className="font-medium">{entry.details?.productName}</span> quantity: {entry.old_value} → {entry.new_value}
                        </span>
                      )}
                      {entry.action === 'duplicated' && (
                        <span className="text-molten-ink">
                          Duplicated from <span className="font-medium">{entry.details?.sourceReference}</span>
                        </span>
                      )}
                      {entry.user && (
                        <span className="text-ash ml-2">
                          by {entry.user.full_name || entry.user.email}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
