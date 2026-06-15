import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
    })
  }

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

    const { error } = await supabase
      .from('products')
      .update({
        name: editForm.name,
        code: editForm.code,
        price,
        pack_size,
        pack_unit: editForm.pack_unit,
        category_id: editForm.category_id || null,
      })
      .eq('id', id)

    if (error) {
      alert('Error updating product: ' + error.message)
    } else {
      setProducts(products.map(p => p.id === id ? {
        ...p,
        name: editForm.name,
        code: editForm.code,
        price,
        pack_size,
        pack_unit: editForm.pack_unit,
        category_id: editForm.category_id || null,
      } : p))
      setEditingId(null)
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !currentStatus })
      .eq('id', id)

    if (error) {
      alert('Error updating product: ' + error.message)
    } else {
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
        category: { id: '', name: 'Uncategorized', display_order: 999 },
        products: filteredProducts.filter(p => !p.category_id),
      }]).filter(g => g.products.length > 0)
    : [{ category: null, products: filteredProducts }]

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex gap-2">
          <Button
            variant={groupByCategory ? 'default' : 'outline'}
            size="sm"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  className="w-full h-10 px-3 rounded-lg border border-gray-200"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border border-gray-200"
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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Products by Category */}
      {groupedProducts.map(group => (
        <div key={group.category?.id || 'uncategorized'} className="mb-6">
          {group.category && (
            <h2 className="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-6 bg-magma rounded"></span>
              {group.category.name}
              <span className="text-sm font-normal text-gray-400">({group.products.length})</span>
            </h2>
          )}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10"></th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pack</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {group.products.map((product, index) => (
                    <tr key={product.id} className={!product.is_active ? 'bg-gray-50 opacity-60' : ''}>
                      {/* Reorder buttons */}
                      <td className="px-2 py-3">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveProduct(product.id, 'up')}
                            disabled={index === 0}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => moveProduct(product.id, 'down')}
                            disabled={index === group.products.length - 1}
                            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
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
                              className="w-full px-2 py-1 rounded border border-gray-300 text-sm font-mono"
                              value={editForm.code}
                              onChange={e => setEditForm({ ...editForm, code: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="text"
                              className="w-full px-2 py-1 rounded border border-gray-300 text-sm"
                              value={editForm.name}
                              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <input
                                type="number"
                                className="w-16 px-2 py-1 rounded border border-gray-300 text-sm"
                                value={editForm.pack_size}
                                onChange={e => setEditForm({ ...editForm, pack_size: e.target.value })}
                              />
                              <select
                                className="w-16 px-1 py-1 rounded border border-gray-300 text-sm"
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
                              <span className="text-gray-500">£</span>
                              <input
                                type="number"
                                step="0.01"
                                className="w-20 px-2 py-1 rounded border border-gray-300 text-sm"
                                value={editForm.price}
                                onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                              />
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              className="px-2 py-1 rounded border border-gray-200 text-sm"
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
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600">{product.code}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{product.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{product.pack_size}{product.pack_unit}</td>
                          <td className="px-4 py-3 text-sm font-medium">£{formatCurrency(product.price)}</td>
                          <td className="px-4 py-3 text-sm">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              product.is_active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}>
                              {product.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => startEdit(product)}
                                className="p-1 text-gray-400 hover:text-magma hover:bg-orange-50 rounded"
                                title="Edit product"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => toggleActive(product.id, product.is_active)}
                                className={`relative w-10 h-6 rounded-full transition-colors ${
                                  product.is_active ? 'bg-green-500' : 'bg-gray-300'
                                }`}
                                title={product.is_active ? 'Click to disable' : 'Click to enable'}
                              >
                                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                  product.is_active ? 'left-5' : 'left-1'
                                }`} />
                              </button>
                              <button
                                onClick={() => deleteProduct(product.id, product.name)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                title="Delete product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
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
