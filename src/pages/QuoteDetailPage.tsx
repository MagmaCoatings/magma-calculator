import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { ArrowLeft, Pencil, Save, Copy, Trash2, FileText, Send, CheckCircle, XCircle, Plus, Minus, History, X, Search, Package } from 'lucide-react'

interface Product {
  id: string
  code: string
  name: string
  price: number
  pack_size: number
  pack_unit: string
  is_active: boolean
}

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
  created_by: string | null
  created_at: string
  updated_at: string
  creator_name?: string
  creator_email?: string
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

interface HistoryEntry {
  id: string
  change_type: string
  field_name: string | null
  old_value: string | null
  new_value: string | null
  description: string | null
  changed_at: string
  changed_by_name?: string
}

export function QuoteDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [items, setItems] = useState<QuoteItem[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editingItems, setEditingItems] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [availableProducts, setAvailableProducts] = useState<Product[]>([])
  const [productSearch, setProductSearch] = useState('')
  const [editForm, setEditForm] = useState({
    client_name: '',
    project_name: '',
    notes: '',
  })
  const [editedItems, setEditedItems] = useState<QuoteItem[]>([])

  useEffect(() => {
    if (id) fetchQuote()
    fetchProducts()
  }, [id])

  async function fetchProducts() {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('name')
    setAvailableProducts(data || [])
  }

  async function fetchQuote() {
    // Fetch quote with creator info
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

    // Get creator info if exists
    if (quoteData.created_by) {
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', quoteData.created_by)
        .single()
      
      if (creatorData) {
        quoteData.creator_name = creatorData.full_name
        quoteData.creator_email = creatorData.email
      }
    }

    setQuote(quoteData)
    setEditForm({
      client_name: quoteData.client_name || '',
      project_name: quoteData.project_name || '',
      notes: quoteData.notes || '',
    })

    // Fetch items
    const { data: itemsData } = await supabase
      .from('quote_items')
      .select('*')
      .eq('quote_id', id)
      .order('display_order')

    setItems(itemsData || [])
    setEditedItems(itemsData || [])

    // Fetch history
    await fetchHistory()
    
    setLoading(false)
  }

  async function fetchHistory() {
    const { data: historyData } = await supabase
      .from('quote_history')
      .select('*')
      .eq('quote_id', id)
      .order('changed_at', { ascending: false })

    // Get names for changed_by
    if (historyData) {
      for (const entry of historyData) {
        if (entry.changed_by) {
          const { data: userData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', entry.changed_by)
            .single()
          entry.changed_by_name = userData?.full_name || 'Unknown'
        }
      }
    }

    setHistory(historyData || [])
  }

  async function logChange(changeType: string, fieldName: string | null, oldValue: string | null, newValue: string | null, description: string) {
    await supabase.from('quote_history').insert({
      quote_id: id,
      changed_by: user?.id,
      change_type: changeType,
      field_name: fieldName,
      old_value: oldValue,
      new_value: newValue,
      description,
    })
  }

  async function saveEdit() {
    if (!quote) return

    const changes: string[] = []
    
    if (editForm.client_name !== (quote.client_name || '')) {
      await logChange('update', 'client_name', quote.client_name, editForm.client_name, `Client changed from "${quote.client_name || 'empty'}" to "${editForm.client_name || 'empty'}"`)
      changes.push('client_name')
    }
    if (editForm.project_name !== (quote.project_name || '')) {
      await logChange('update', 'project_name', quote.project_name, editForm.project_name, `Project changed from "${quote.project_name || 'empty'}" to "${editForm.project_name || 'empty'}"`)
      changes.push('project_name')
    }
    if (editForm.notes !== (quote.notes || '')) {
      await logChange('update', 'notes', quote.notes, editForm.notes, 'Notes updated')
      changes.push('notes')
    }

    const { error } = await supabase
      .from('quotes')
      .update({
        client_name: editForm.client_name || null,
        project_name: editForm.project_name || null,
        notes: editForm.notes || null,
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
      fetchHistory()
    }
  }

  const [saving, setSaving] = useState(false)

  async function saveItemChanges() {
    if (!quote || saving) return
    setSaving(true)

    try {
      // Calculate new totals
      const newSubtotal = editedItems.reduce((sum, item) => sum + item.line_total, 0)
      const newVat = newSubtotal * 0.2
      const newTotal = newSubtotal + newVat

      // Collect all changes first, then log them once
      const changes: { type: string, field: string | null, old: string | null, newVal: string | null, desc: string }[] = []

      // Check for new items
      for (const editedItem of editedItems) {
        if (editedItem.id.startsWith('new_')) {
          changes.push({
            type: 'item_added',
            field: null,
            old: null,
            newVal: null,
            desc: `Added: ${editedItem.quantity}x ${editedItem.product_name}`
          })
        } else {
          const originalItem = items.find(i => i.id === editedItem.id)
          if (originalItem && originalItem.quantity !== editedItem.quantity) {
            changes.push({
              type: 'item_update',
              field: 'quantity',
              old: originalItem.quantity.toString(),
              newVal: editedItem.quantity.toString(),
              desc: `${editedItem.product_name}: quantity changed from ${originalItem.quantity} to ${editedItem.quantity}`
            })
          }
        }
      }

      // Check for removed items
      for (const originalItem of items) {
        if (!editedItems.find(i => i.id === originalItem.id)) {
          changes.push({
            type: 'item_removed',
            field: null,
            old: null,
            newVal: null,
            desc: `Removed: ${originalItem.quantity}x ${originalItem.product_name}`
          })
        }
      }

      // Log totals change if significant
      if (Math.abs(newTotal - quote.total) > 0.01) {
        changes.push({
          type: 'totals_update',
          field: 'total',
          old: quote.total.toFixed(2),
          newVal: newTotal.toFixed(2),
          desc: `Total changed from £${formatCurrency(quote.total)} to £${formatCurrency(newTotal)}`
        })
      }

      // Log all changes
      for (const change of changes) {
        await logChange(change.type, change.field, change.old, change.newVal, change.desc)
      }

      // Insert new items
      const newItems = editedItems.filter(i => i.id.startsWith('new_'))
      if (newItems.length > 0) {
        const insertItems = newItems.map(item => ({
          quote_id: id,
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
          display_order: item.display_order,
        }))
        await supabase.from('quote_items').insert(insertItems)
      }

      // Update existing items
      const existingItems = editedItems.filter(i => !i.id.startsWith('new_'))
      for (const item of existingItems) {
        await supabase
          .from('quote_items')
          .update({
            quantity: item.quantity,
            line_total: item.line_total,
          })
          .eq('id', item.id)
      }

      // Delete removed items
      const removedIds = items.filter(i => !editedItems.find(e => e.id === i.id)).map(i => i.id)
      if (removedIds.length > 0) {
        await supabase
          .from('quote_items')
          .delete()
          .in('id', removedIds)
      }

      // Update quote totals
      await supabase
        .from('quotes')
        .update({
          subtotal: newSubtotal,
          vat: newVat,
          total: newTotal,
        })
        .eq('id', quote.id)

      setQuote({
        ...quote,
        subtotal: newSubtotal,
        vat: newVat,
        total: newTotal,
      })
      setItems(editedItems)
      setEditingItems(false)
      fetchHistory()
    } finally {
      setSaving(false)
    }
  }

  function updateItemQuantity(itemId: string, delta: number) {
    setEditedItems(prev => prev.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(1, item.quantity + delta)
        return {
          ...item,
          quantity: newQty,
          line_total: newQty * item.unit_price,
        }
      }
      return item
    }))
  }

  function removeItem(itemId: string) {
    setEditedItems(prev => prev.filter(item => item.id !== itemId))
  }

  function addProduct(product: Product) {
    // Check if product already in list
    const existing = editedItems.find(i => i.product_code === product.code)
    if (existing) {
      // Increase quantity
      updateItemQuantity(existing.id, 1)
    } else {
      // Add new item
      const newItem: QuoteItem = {
        id: `new_${Date.now()}`,
        product_code: product.code,
        product_name: product.name,
        quantity: 1,
        unit_price: product.price,
        line_total: product.price,
        display_order: editedItems.length,
      }
      setEditedItems(prev => [...prev, newItem])
    }
    setShowAddProduct(false)
    setProductSearch('')
  }

  async function updateStatus(newStatus: string) {
    if (!quote) return

    await logChange('status_update', 'status', quote.status, newStatus, `Status changed from ${quote.status} to ${newStatus}`)

    const { error } = await supabase
      .from('quotes')
      .update({ status: newStatus })
      .eq('id', quote.id)

    if (error) {
      alert('Error updating status: ' + error.message)
    } else {
      setQuote({ ...quote, status: newStatus })
      fetchHistory()
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

    const { data: refData } = await supabase.rpc('generate_quote_reference')
    const newRef = refData || `MQ-${Date.now()}`

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
        created_by: user?.id,
      })
      .select()
      .single()

    if (quoteError) {
      alert('Error duplicating: ' + quoteError.message)
      return
    }

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

  function formatHistoryDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Calculate edited totals
  const editedSubtotal = editedItems.reduce((sum, item) => sum + item.line_total, 0)
  const editedVat = editedSubtotal * 0.2
  const editedTotal = editedSubtotal + editedVat

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
          {quote.updated_at !== quote.created_at && (
            <p className="text-orange-600 text-sm">Last updated {formatDate(quote.updated_at)}</p>
          )}
          {quote.creator_name && profile?.role === 'admin' && (
            <p className="text-gray-400 text-xs mt-1">Created by: {quote.creator_name} ({quote.creator_email})</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            <History className="w-4 h-4 mr-1" /> History
          </Button>
          <Button variant="outline" size="sm" onClick={copyShoppingList}>
            <Copy className="w-4 h-4 mr-1" /> Copy
          </Button>
          <Button variant="outline" size="sm" onClick={duplicateQuote}>
            <FileText className="w-4 h-4 mr-1" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" onClick={deleteQuote} className="text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <Card className="mb-6 border-orange-200 bg-orange-50/50">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base">Change History</CardTitle>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </CardHeader>
          <CardContent className="py-0 pb-4">
            {history.length === 0 ? (
              <p className="text-gray-500 text-sm py-2">No changes recorded yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {history.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3 text-sm py-2 border-b border-orange-100 last:border-0">
                    <span className="text-gray-400 text-xs whitespace-nowrap">{formatHistoryDate(entry.changed_at)}</span>
                    <span className="text-gray-700 flex-1">{entry.description}</span>
                    {entry.changed_by_name && (
                      <span className="text-gray-400 text-xs">by {entry.changed_by_name}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <span className="font-medium">£{formatCurrency(editingItems ? editedSubtotal : quote.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VAT (20%)</span>
                <span className="font-medium">£{formatCurrency(editingItems ? editedVat : quote.vat)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl font-bold text-magma">£{formatCurrency(editingItems ? editedTotal : quote.total)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Materials ({editingItems ? editedItems.length : items.length} items)</CardTitle>
          {!editingItems ? (
            <Button variant="ghost" size="sm" onClick={() => { setEditedItems([...items]); setEditingItems(true) }}>
              <Pencil className="w-4 h-4 mr-1" /> Edit Items
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddProduct(true)}>
                <Plus className="w-4 h-4 mr-1" /> Add Product
              </Button>
              <Button size="sm" onClick={saveItemChanges}>
                <Save className="w-4 h-4 mr-1" /> Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setEditedItems([...items]); setEditingItems(false) }}>
                Cancel
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Unit Price</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                {editingItems && <th className="px-4 py-3 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(editingItems ? editedItems : items).map(item => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{item.product_name}</span>
                    <span className="text-gray-400 text-sm ml-2">({item.product_code})</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingItems ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => updateItemQuantity(item.id, -1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateItemQuantity(item.id, 1)}
                          className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600">{item.quantity}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">£{formatCurrency(item.unit_price)}</td>
                  <td className="px-4 py-3 text-right font-medium">£{formatCurrency(item.line_total)}</td>
                  {editingItems && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Product Modal */}
      {showAddProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => { setShowAddProduct(false); setProductSearch('') }} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Add Product</h2>
              <button onClick={() => { setShowAddProduct(false); setProductSearch('') }} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            <div className="overflow-y-auto max-h-[50vh]">
              {availableProducts
                .filter(p => 
                  p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                  p.code.toLowerCase().includes(productSearch.toLowerCase())
                )
                .map(product => (
                  <button
                    key={product.id}
                    onClick={() => addProduct(product)}
                    className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition border-b border-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-600" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">{product.pack_size}{product.pack_unit} pack</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">£{formatCurrency(product.price)}</p>
                      <p className="text-xs text-gray-400">{product.code}</p>
                    </div>
                  </button>
                ))}
              {availableProducts.filter(p => 
                p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                p.code.toLowerCase().includes(productSearch.toLowerCase())
              ).length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  No products found
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
