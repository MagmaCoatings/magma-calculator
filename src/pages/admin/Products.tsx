import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logCreate, logUpdate, logDelete } from '@/lib/activityLog'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import type { Product, ProductCategory } from '@/lib/types'
import { Plus, Pencil, X, Check, Search, ChevronUp, ChevronDown, Trash2 } from 'lucide-react'

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    code: '',
    price: '',
    pack_size: '',
    pack_unit: '',
    category_id: '',
    description: '',
    coverage_sqm: '',
    coverage_sqm_over_mesh: '',
    default_coats: '',
    min_coats: '',
    max_coats: '',
    coverage_note: '',
    is_consumable: false,
  })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newProduct, setNewProduct] = useState({
    code: '',
    name: '',
    pack_size: '',
    pack_unit: 'kg',
    price: '',
    coverage_rate: '',
    coverage_unit: 'g/m²',
    category_id: '',
  })
  const [groupByCategory, setGroupByCategory] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    // Fetch categories
    const { data: catData } = await supabase
      .from('product_categories')
      .select('*')
      .order('display_order')

    setCategories(catData || [])

    // Fetch products
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('display_order')

    if (error) {
      console.error('Error fetching products:', error)
    } else {
      setProducts(data || [])
    }
    setLoading(false)
  }

  function startEdit(product: Product) {
    setEditingId(product.id)
    setEditForm({
      name: product.name,
      code: product.code,
      price: product.price.toString(),
      pack_size: product.pack_size.toString(),
      pack_unit: product.pack_unit,
      category_id: product.category_id || '',
      description: product.description || '',
      coverage_sqm: product.coverage_sqm != null ? String(product.coverage_sqm) : '',
      coverage_sqm_over_mesh: product.coverage_sqm_over_mesh != null ? String(product.coverage_sqm_over_mesh) : '',
      default_coats: product.default_coats != null ? String(product.default_coats) : '',
      min_coats: product.min_coats != null ? String(product.min_coats) : '',
      max_coats: product.max_coats != null ? String(product.max_coats) : '',
      coverage_note: product.coverage_note || '',
      is_consumable: !!product.is_consumable,
    })
  }

  const [savedId, setSavedId] = useState<string | null>(null)

  async function saveEdit(id: string) {
    const price = parseFloat(editForm.price)
    const pack_size = parseFloat(editForm.pack_size)
    
    if (isNaN(price) || price < 0) {
      alert('Please enter a valid price')
      return
    }
    if (isNaN(pack_size) || pack_size <= 0) {
      alert('Please enter a valid pack size')
      return
    }

    const num = (s: string) => { const v = parseFloat(s); return s.trim() === '' || isNaN(v) ? null : v }
    const intNum = (s: string) => { const v = parseInt(s); return s.trim() === '' || isNaN(v) ? null : v }
    const coverageFields = {
      coverage_sqm: num(editForm.coverage_sqm),
      coverage_sqm_over_mesh: num(editForm.coverage_sqm_over_mesh),
      default_coats: intNum(editForm.default_coats),
      min_coats: intNum(editForm.min_coats),
      max_coats: intNum(editForm.max_coats),
      coverage_note: editForm.coverage_note.trim() || null,
      is_consumable: editForm.is_consumable,
    }

    const { error } = await supabase
      .from('products')
      .update({
        name: editForm.name,
        code: editForm.code,
        price,
        pack_size,
        pack_unit: editForm.pack_unit,
        category_id: editForm.category_id || null,
        description: editForm.description || null,
        ...coverageFields,
      })
      .eq('id', id)

    if (error) {
      alert('Error updating product: ' + error.message)
    } else {
      // Log activity
      logUpdate('product', id, editForm.name, { price, pack_size })

      setProducts(products.map(p => p.id === id ? {
        ...p,
        name: editForm.name,
        code: editForm.code,
        price,
        pack_size,
        pack_unit: editForm.pack_unit,
        category_id: editForm.category_id || null,
        description: editForm.description || null,
        ...coverageFields,
      } : p))
      setEditingId(null)
      // Show saved feedback
      setSavedId(id)
      setTimeout(() => setSavedId(null), 2000)
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    const product = products.find(p => p.id === id)
    const { error } = await supabase
      .from('products')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      alert('Error updating product: ' + error.message)
    } else {
      // Log activity
      logUpdate('product', id, product?.name || 'Unknown', { is_active: !currentStatus })
      
      setProducts(products.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p))
    }
  }

  async function deleteProduct(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) {
      return
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)

    if (error) {
      alert('Error deleting product: ' + error.message)
    } else {
      // Log activity
      logDelete('product', id, name)
      
      setProducts(products.filter(p => p.id !== id))
    }
  }

  async function moveProduct(id: string, direction: 'up' | 'down') {
    const currentIndex = products.findIndex(p => p.id === id)
    if (currentIndex === -1) return
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= products.length) return

    const newProducts = [...products]
    const temp = newProducts[currentIndex]
    newProducts[currentIndex] = newProducts[newIndex]
    newProducts[newIndex] = temp

    // Update display_order for both products
    const updates = newProducts.map((p, i) => ({
      id: p.id,
      display_order: i,
    }))

    setProducts(newProducts)

    // Save to database
    for (const update of updates) {
      await supabase
        .from('products')
        .update({ display_order: update.display_order })
        .eq('id', update.id)
    }
  }

  async function addProduct() {
    if (!newProduct.code || !newProduct.name || !newProduct.price) {
      alert('Please fill in code, name, and price')
      return
    }

    const maxOrder = Math.max(...products.map(p => p.display_order || 0), 0)

    const { data, error } = await supabase
      .from('products')
      .insert({
        code: newProduct.code,
        name: newProduct.name,
        pack_size: parseFloat(newProduct.pack_size) || 1,
        pack_unit: newProduct.pack_unit,
        price: parseFloat(newProduct.price),
        coverage_rate: newProduct.coverage_rate ? parseFloat(newProduct.coverage_rate) : null,
        coverage_unit: newProduct.coverage_rate ? newProduct.coverage_unit : null,
        category_id: newProduct.category_id || null,
        display_order: maxOrder + 1,
        is_active: true,
      })
      .select()
      .single()

    if (error) {
      alert('Error adding product: ' + error.message)
    } else {
      // Log activity
      logCreate('product', data.id, data.name, { code: data.code, price: data.price })
      
      setProducts([...products, data])
      setShowAddForm(false)
      setNewProduct({
        code: '',
        name: '',
        pack_size: '',
        pack_unit: 'kg',
        price: '',
        coverage_rate: '',
        coverage_unit: 'g/m²',
        category_id: '',
      })
    }
  }

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  )

  // Group products by category if enabled
  const groupedProducts = groupByCategory
    ? categories.map(cat => ({
        category: cat,
        products: filteredProducts.filter(p => p.category_id === cat.id),
      })).concat([{
        category: { id: '', name: 'Uncategorized', display_order: 999, created_at: '' },
        products: filteredProducts.filter(p => !p.category_id),
      }]).filter(g => g.products.length > 0)
    : [{ category: null, products: filteredProducts }]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-molten border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-basalt">Products</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setGroupByCategory(!groupByCategory)}
          >
            {groupByCategory ? 'Grouped' : 'Flat List'}
          </Button>
          <Button onClick={() => setShowAddForm(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Product
          </Button>
        </div>
      </div>

      {/* Add Product Form */}
      {showAddForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Add New Product</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Input
                label="Code"
                placeholder="e.g. magma_800"
                value={newProduct.code}
                onChange={e => setNewProduct({ ...newProduct, code: e.target.value })}
              />
              <Input
                label="Name"
                placeholder="e.g. Magma 800 Ultra"
                value={newProduct.name}
                onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Category</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-line"
                  value={newProduct.category_id}
                  onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Price (£)"
                type="number"
                step="0.01"
                placeholder="153.80"
                value={newProduct.price}
                onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
              />
              <div className="flex gap-2">
                <Input
                  label="Pack Size"
                  type="number"
                  placeholder="20"
                  value={newProduct.pack_size}
                  onChange={e => setNewProduct({ ...newProduct, pack_size: e.target.value })}
                />
                <div className="w-24">
                  <label className="block text-sm font-medium text-ink mb-1">Unit</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-line"
                    value={newProduct.pack_unit}
                    onChange={e => setNewProduct({ ...newProduct, pack_unit: e.target.value })}
                  >
                    <option value="kg">kg</option>
                    <option value="L">L</option>
                    <option value="m">m</option>
                    <option value="pot">pot</option>
                    <option value="set">set</option>
                  </select>
                </div>
              </div>
              <Input
                label="Coverage Rate (optional)"
                type="number"
                placeholder="600"
                value={newProduct.coverage_rate}
                onChange={e => setNewProduct({ ...newProduct, coverage_rate: e.target.value })}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <Button onClick={addProduct}>Add Product</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ash" />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-line bg-track text-base"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Products by Category */}
      {groupedProducts.map(group => (
        <div key={group.category?.id || 'uncategorized'} className="mb-6">
          {group.category && (
            <h2 className="text-lg font-medium text-ink mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-molten rounded"></span>
              {group.category.name}
              <span className="text-sm font-normal text-ash">({group.products.length})</span>
            </h2>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-track border-b border-line">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-stone uppercase w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Pack</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-stone uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.products.map((product, index) => (
                    <React.Fragment key={product.id}>
                    <tr className={`transition-colors ${
                      savedId === product.id 
                        ? 'bg-sage-tint' 
                        : !product.is_active 
                          ? 'bg-limestone opacity-60' 
                          : ''
                    }`}>
                      {/* Reorder buttons */}
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveProduct(product.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-ash hover:text-ink disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveProduct(product.id, 'down')}
                            disabled={index === group.products.length - 1}
                            className="p-0.5 text-ash hover:text-ink disabled:opacity-30"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Editable fields */}
                      {editingId === product.id ? (
                        <>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-stone text-sm font-mono"
                              value={editForm.code}
                              onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-stone text-sm"
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <input
                                type="number"
                                className="w-16 px-2 py-1 rounded border border-stone text-sm"
                                value={editForm.pack_size}
                                onChange={e => setEditForm({ ...editForm, pack_size: e.target.value })}
                              />
                              <select
                                className="w-16 px-1 py-1 rounded border border-stone text-sm"
                                value={editForm.pack_unit}
                                onChange={e => setEditForm({ ...editForm, pack_unit: e.target.value })}
                              >
                                <option value="kg">kg</option>
                                <option value="L">L</option>
                                <option value="m">m</option>
                                <option value="pot">pot</option>
                                <option value="set">set</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-stone">£</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-20 px-2 py-1 rounded border border-stone text-sm"
                                value={editForm.price}
                                onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="px-2 py-1 rounded border border-line text-sm"
                              value={editForm.category_id}
                              onChange={e => setEditForm({ ...editForm, category_id: e.target.value })}
                            >
                              <option value="">Uncategorized</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => saveEdit(product.id)}
                                className="p-1.5 text-sage hover:bg-sage-tint rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-ash hover:bg-line-soft rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-mono text-ink">{product.code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-basalt">
                            <span className="flex items-center gap-2">
                              {product.name}
                              {savedId === product.id && (
                                <span className="px-2 py-0.5 bg-sage-tint text-sage text-xs rounded-full font-medium">
                                  Saved ✓
                                </span>
                              )}
                            </span>
                            {product.description && (
                              <p className="text-xs text-stone font-normal mt-0.5 truncate max-w-xs" title={product.description}>
                                {product.description}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-ink">{product.pack_size}{product.pack_unit}</td>
                          <td className="px-4 py-3 text-sm font-medium">£{formatCurrency(product.price)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.is_active
                                ? 'bg-sage-tint text-sage'
                                : 'bg-line-soft text-stone'
                            }`}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => startEdit(product)}
                                className="p-1 text-ash hover:text-molten-ink hover:bg-molten-tint rounded"
                                title="Edit product"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleActive(product.id, product.is_active)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${
                                  product.is_active ? 'bg-sage' : 'bg-ash'
                                }`}
                                title={product.is_active ? 'Click to disable' : 'Click to enable'}
                              >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-bone shadow transition-transform ${
                                  product.is_active ? 'left-5' : 'left-1'
                                }`} />
                              </button>
                              <button
                                onClick={() => deleteProduct(product.id, product.name)}
                                className="p-1 text-ash hover:text-danger hover:bg-danger-tint rounded"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                    {/* Description row when editing */}
                    {editingId === product.id && (
                      <tr className="bg-molten-tint">
                        <td colSpan={7} className="px-4 py-3 space-y-4">
                          <div className="flex items-start gap-3">
                            <label className="text-sm font-medium text-ink pt-2 whitespace-nowrap">
                              Tooltip info:
                            </label>
                            <textarea
                              className="flex-1 px-3 py-2 rounded-lg border border-stone text-sm resize-none"
                              rows={2}
                              placeholder="Brief product description shown in calculator tooltip (e.g. 'High-build base coat for floors. Apply with trowel.')"
                              value={editForm.description}
                              onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                            />
                          </div>

                          {/* Coverage & coats defaults — inherited by every system unless overridden */}
                          <div>
                            <p className="text-xs font-medium text-stone uppercase tracking-wide mb-2">
                              Coverage &amp; coats defaults
                              <span className="ml-2 normal-case font-normal text-ash">Used by all systems unless a system overrides it</span>
                            </p>
                            <div className="flex flex-wrap gap-4">
                              <div>
                                <label className="block text-xs text-stone mb-1">Coverage (m²/pack)</label>
                                <Input type="number" className="w-32" placeholder="e.g. 20"
                                  value={editForm.coverage_sqm}
                                  onChange={e => setEditForm({ ...editForm, coverage_sqm: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs text-stone mb-1">Over-mesh coverage (m²/pack)</label>
                                <Input type="number" className="w-40" placeholder="optional — DPM only"
                                  value={editForm.coverage_sqm_over_mesh}
                                  onChange={e => setEditForm({ ...editForm, coverage_sqm_over_mesh: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs text-stone mb-1">Default coats</label>
                                <Input type="number" className="w-24" placeholder="1"
                                  value={editForm.default_coats}
                                  onChange={e => setEditForm({ ...editForm, default_coats: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs text-stone mb-1">Min coats</label>
                                <Input type="number" className="w-24" placeholder="1"
                                  value={editForm.min_coats}
                                  onChange={e => setEditForm({ ...editForm, min_coats: e.target.value })} />
                              </div>
                              <div>
                                <label className="block text-xs text-stone mb-1">Max coats</label>
                                <Input type="number" className="w-24" placeholder="1"
                                  value={editForm.max_coats}
                                  onChange={e => setEditForm({ ...editForm, max_coats: e.target.value })} />
                              </div>
                            </div>
                            <div className="mt-3">
                              <label className="block text-xs text-stone mb-1">Coverage note (shown under the product in the calculator)</label>
                              <Input className="w-full" placeholder="e.g. 1kg/m² = 20m² per 20kg pack"
                                value={editForm.coverage_note}
                                onChange={e => setEditForm({ ...editForm, coverage_note: e.target.value })} />
                            </div>
                            <label className="mt-4 flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox" className="w-4 h-4 accent-molten"
                                checked={editForm.is_consumable}
                                onChange={e => setEditForm({ ...editForm, is_consumable: e.target.checked })} />
                              <span className="text-sm text-ink">Consumable</span>
                              <span className="text-xs text-ash">— shows in the calculator's "Consumables / Extras" list (added by quantity, not area)</span>
                            </label>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ))}
    </div>
  )
}
