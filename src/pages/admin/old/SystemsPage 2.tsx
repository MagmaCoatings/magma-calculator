import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, ChevronRight, Layers, ArrowLeft, Check, Eye, GitBranch } from 'lucide-react'

interface System {
  id: string
  name: string
  description: string | null
  surface_type: 'floor' | 'wall' | 'both'
  is_active: boolean
  display_order: number
}

interface Stage {
  id: string
  name: string
  display_order: number
}

interface Product {
  id: string
  name: string
  price: number
  pack_size: number
  pack_unit: string
  default_coverage_sqm: number | null
}

interface SystemProduct {
  id: string
  system_id: string
  product_id: string
  stage_id: string | null
  coverage_sqm: number
  coverage_kg_per_sqm: number | null
  coverage_sqm_per_pack: number | null
  applications: number
  is_optional: boolean
  option_group: string | null
  is_default_option: boolean
  coverage_note: string | null
  has_pigment: boolean
  min_coats: number
  max_coats: number
  display_order: number
  notes: string | null
  product?: Product
  stage?: Stage
}

export function SystemsPage() {
  const [systems, setSystems] = useState<System[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([])
  const [showAddSystem, setShowAddSystem] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [newSystem, setNewSystem] = useState({ name: '', description: '', surface_type: 'floor' as const })
  const [editingSystem, setEditingSystem] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [systemsRes, stagesRes, productsRes] = await Promise.all([
      supabase.from('systems').select('*').order('display_order'),
      supabase.from('stages').select('*').order('display_order'),
      supabase.from('products').select('*').eq('is_active', true).order('name'),
    ])
    setSystems(systemsRes.data || [])
    setStages(stagesRes.data || [])
    setProducts(productsRes.data || [])
    setLoading(false)
  }

  async function fetchSystemProducts(systemId: string) {
    const { data } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')
    setSystemProducts(data || [])
  }

  async function createSystem() {
    if (!newSystem.name.trim()) return
    const maxOrder = Math.max(...systems.map(s => s.display_order), 0)
    const { data } = await supabase
      .from('systems')
      .insert({
        name: newSystem.name.trim(),
        description: newSystem.description.trim() || null,
        surface_type: newSystem.surface_type,
        display_order: maxOrder + 1,
      })
      .select()
      .single()
    
    if (data) {
      setNewSystem({ name: '', description: '', surface_type: 'floor' })
      setShowAddSystem(false)
      fetchData()
      setSelectedSystem(data)
      setView('edit')
    }
  }

  async function updateSystem() {
    if (!selectedSystem) return
    await supabase
      .from('systems')
      .update({
        name: selectedSystem.name,
        description: selectedSystem.description,
        surface_type: selectedSystem.surface_type,
      })
      .eq('id', selectedSystem.id)
    setEditingSystem(false)
    fetchData()
  }

  async function toggleSystem(system: System) {
    await supabase
      .from('systems')
      .update({ is_active: !system.is_active })
      .eq('id', system.id)
    fetchData()
  }

  async function deleteSystem(system: System) {
    if (!confirm(`Delete "${system.name}"? This will remove all products from this system.`)) return
    await supabase.from('systems').delete().eq('id', system.id)
    fetchData()
  }

  function openSystem(system: System) {
    setSelectedSystem(system)
    setView('edit')
    fetchSystemProducts(system.id)
  }

  // System products management
  const [addProductForm, setAddProductForm] = useState({
    product_id: '',
    stage_id: '',
    coverage_sqm: 10,
    coverage_kg_per_sqm: '',
    applications: 1,
    is_optional: false,
    option_group: '',
    is_default_option: false,
    coverage_note: '',
    has_pigment: false,
    notes: '',
  })

  async function addProductToSystem() {
    if (!selectedSystem || !addProductForm.product_id) return
    
    const maxOrder = Math.max(...systemProducts.map(sp => sp.display_order), 0)
    await supabase.from('system_products').insert({
      system_id: selectedSystem.id,
      product_id: addProductForm.product_id,
      stage_id: addProductForm.stage_id || null,
      coverage_sqm: addProductForm.coverage_sqm,
      coverage_kg_per_sqm: addProductForm.coverage_kg_per_sqm ? parseFloat(addProductForm.coverage_kg_per_sqm) : null,
      coverage_sqm_per_pack: addProductForm.coverage_sqm,
      applications: addProductForm.applications,
      is_optional: addProductForm.is_optional,
      option_group: addProductForm.option_group || null,
      is_default_option: addProductForm.is_default_option,
      coverage_note: addProductForm.coverage_note || null,
      has_pigment: addProductForm.has_pigment,
      notes: addProductForm.notes || null,
      display_order: maxOrder + 1,
    })
    
    setAddProductForm({
      product_id: '',
      stage_id: '',
      coverage_sqm: 10,
      coverage_kg_per_sqm: '',
      applications: 1,
      is_optional: false,
      option_group: '',
      is_default_option: false,
      coverage_note: '',
      has_pigment: false,
      notes: '',
    })
    setShowAddProduct(false)
    fetchSystemProducts(selectedSystem.id)
  }

  async function removeProductFromSystem(spId: string) {
    if (!confirm('Remove this product from the system?')) return
    await supabase.from('system_products').delete().eq('id', spId)
    if (selectedSystem) fetchSystemProducts(selectedSystem.id)
  }

  async function updateProductInSystem(sp: SystemProduct, updates: Partial<SystemProduct>) {
    await supabase.from('system_products').update(updates).eq('id', sp.id)
    if (selectedSystem) fetchSystemProducts(selectedSystem.id)
  }

  async function setAsDefault(sp: SystemProduct) {
    if (!sp.option_group) return
    const sameGroup = systemProducts.filter(p => p.option_group === sp.option_group)
    for (const p of sameGroup) {
      await supabase.from('system_products').update({ is_default_option: p.id === sp.id }).eq('id', p.id)
    }
    if (selectedSystem) fetchSystemProducts(selectedSystem.id)
  }

  // Get unique option groups with their products
  const optionGroups: { [key: string]: SystemProduct[] } = {}
  systemProducts.forEach(sp => {
    if (sp.option_group) {
      if (!optionGroups[sp.option_group]) optionGroups[sp.option_group] = []
      optionGroups[sp.option_group].push(sp)
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Edit system view
  if (view === 'edit' && selectedSystem) {
    // Group products by stage
    const groupedProducts: { [key: string]: SystemProduct[] } = {}
    systemProducts.forEach(sp => {
      const stageName = sp.stage?.name || 'No Stage'
      if (!groupedProducts[stageName]) groupedProducts[stageName] = []
      groupedProducts[stageName].push(sp)
    })

    // Sort stages by their display_order
    const sortedStageNames = Object.keys(groupedProducts).sort((a, b) => {
      const stageA = stages.find(s => s.name === a)
      const stageB = stages.find(s => s.name === b)
      return (stageA?.display_order || 999) - (stageB?.display_order || 999)
    })

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => { setView('list'); setSelectedSystem(null); setSystemProducts([]) }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Systems
        </button>

        {/* System Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Layers className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">{selectedSystem.name}</h1>
                <span className={`px-2 py-0.5 text-xs rounded-full ${selectedSystem.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                  {selectedSystem.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {selectedSystem.description && (
                <p className="text-gray-500 text-sm">{selectedSystem.description}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditingSystem(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
        </div>

        {/* Edit System Modal */}
        {editingSystem && (
          <Card className="mb-6 border-orange-200 bg-orange-50">
            <CardContent className="pt-4 space-y-4">
              <Input
                label="System Name"
                value={selectedSystem.name}
                onChange={e => setSelectedSystem({ ...selectedSystem, name: e.target.value })}
              />
              <Input
                label="Description"
                value={selectedSystem.description || ''}
                onChange={e => setSelectedSystem({ ...selectedSystem, description: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type</label>
                <select
                  value={selectedSystem.surface_type}
                  onChange={e => setSelectedSystem({ ...selectedSystem, surface_type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                >
                  <option value="floor">Floor</option>
                  <option value="wall">Wall</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={updateSystem}>Save Changes</Button>
                <Button variant="outline" onClick={() => setEditingSystem(false)}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calculator Preview */}
        {Object.keys(optionGroups).length > 0 && (
          <div className="mb-6 p-5 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4 text-orange-600" />
              <span className="font-medium text-orange-900">Calculator preview</span>
              <span className="text-xs text-orange-600">What users will see</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {Object.entries(optionGroups).map(([groupName, prods]) => {
                const defaultProd = prods.find(p => p.is_default_option)
                return (
                  <div key={groupName} className="bg-white rounded-lg p-3 min-w-[160px]">
                    <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">
                      {groupName.replace(/_/g, ' ')}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {prods.map(p => (
                        <span
                          key={p.id}
                          className={`px-2 py-1 rounded text-xs ${
                            p.is_default_option
                              ? 'bg-orange-500 text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {p.product?.name?.replace('DPM Epoxy Primer ', '').replace('Magma ', '').replace('PU Seal ', '')}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Build-up Stages */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between border-b">
            <CardTitle>Build-up stages</CardTitle>
            <Button onClick={() => setShowAddProduct(true)} disabled={showAddProduct}>
              <Plus className="w-4 h-4 mr-2" /> Add product
            </Button>
          </CardHeader>

          {/* Add Product Form */}
          {showAddProduct && (
            <div className="p-4 bg-orange-50 border-b border-orange-100 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                  <select
                    value={addProductForm.product_id}
                    onChange={e => {
                      const prod = products.find(p => p.id === e.target.value)
                      setAddProductForm({ 
                        ...addProductForm, 
                        product_id: e.target.value,
                        coverage_sqm: prod?.default_coverage_sqm || 10
                      })
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <option value="">Select product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.pack_size}{p.pack_unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage</label>
                  <select
                    value={addProductForm.stage_id}
                    onChange={e => setAddProductForm({ ...addProductForm, stage_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <option value="">Select stage...</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">m² per pack</label>
                  <Input
                    type="number"
                    min={0.1}
                    step={0.1}
                    value={addProductForm.coverage_sqm}
                    onChange={e => setAddProductForm({ ...addProductForm, coverage_sqm: parseFloat(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coats</label>
                  <Input
                    type="number"
                    min={1}
                    value={addProductForm.applications}
                    onChange={e => setAddProductForm({ ...addProductForm, applications: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Option group</label>
                  <select
                    value={addProductForm.option_group}
                    onChange={e => setAddProductForm({ ...addProductForm, option_group: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200"
                  >
                    <option value="">Always included</option>
                    {Object.keys(optionGroups).map(og => (
                      <option key={og} value={og}>{og}</option>
                    ))}
                    <option value="__new__">+ New group...</option>
                  </select>
                </div>
                {addProductForm.option_group === '__new__' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New group name</label>
                    <Input
                      placeholder="e.g. primer_type"
                      onChange={e => setAddProductForm({ ...addProductForm, option_group: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addProductForm.is_default_option}
                    onChange={e => setAddProductForm({ ...addProductForm, is_default_option: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Default choice</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addProductForm.is_optional}
                    onChange={e => setAddProductForm({ ...addProductForm, is_optional: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Optional (can toggle off)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addProductForm.has_pigment}
                    onChange={e => setAddProductForm({ ...addProductForm, has_pigment: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                  />
                  <span className="text-sm text-gray-700">Pigmented</span>
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={addProductToSystem} disabled={!addProductForm.product_id || !addProductForm.stage_id}>
                  Add to system
                </Button>
                <Button variant="outline" onClick={() => setShowAddProduct(false)}>Cancel</Button>
              </div>
            </div>
          )}

          <CardContent className="p-0">
            {systemProducts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No products in this system yet. Add products to build your system.
              </div>
            ) : (
              <div>
                {sortedStageNames.map((stageName, stageIndex) => {
                  const prods = groupedProducts[stageName]
                  return (
                    <div key={stageName} className="border-b border-gray-100 last:border-b-0">
                      {/* Stage Header */}
                      <div className="px-4 py-2 bg-gray-50 font-medium text-sm text-gray-600 flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-200 rounded text-xs flex items-center justify-center text-gray-500">
                          {stageIndex + 1}
                        </span>
                        {stageName}
                      </div>
                      
                      {/* Products in this stage */}
                      {prods.map((sp) => (
                        <div
                          key={sp.id}
                          className={`px-4 py-3 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-50 last:border-b-0 ${
                            sp.option_group ? 'bg-blue-50/30' : ''
                          }`}
                        >
                          {/* OR indicator or spacer */}
                          <div className="w-6 flex-shrink-0">
                            {sp.option_group && (
                              <span className="w-6 h-6 bg-blue-100 rounded text-[10px] font-medium text-blue-700 flex items-center justify-center">
                                OR
                              </span>
                            )}
                          </div>

                          {/* Product name and badges */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900">{sp.product?.name}</span>
                              {sp.is_default_option && sp.option_group && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-green-100 text-green-700 rounded flex items-center gap-0.5">
                                  <Check className="w-2.5 h-2.5" /> Default
                                </span>
                              )}
                              {sp.has_pigment && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-purple-100 text-purple-700 rounded">
                                  Pigmented
                                </span>
                              )}
                              {sp.is_optional && (
                                <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">
                                  Optional
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              {sp.coverage_note || `${sp.coverage_sqm}m² per pack`}
                              {sp.applications > 1 && ` · ${sp.applications} coats`}
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div className="flex items-center gap-1">
                            {sp.option_group && !sp.is_default_option && (
                              <button
                                onClick={() => setAsDefault(sp)}
                                className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50"
                                title="Set as default"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => updateProductInSystem(sp, { has_pigment: !sp.has_pigment })}
                              className={`px-2 py-1 rounded text-xs ${
                                sp.has_pigment ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-400'
                              }`}
                              title="Toggle pigmented"
                            >
                              Pig
                            </button>
                            <button
                              onClick={() => updateProductInSystem(sp, { is_optional: !sp.is_optional })}
                              className={`px-2 py-1 rounded text-xs ${
                                sp.is_optional ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-400'
                              }`}
                              title="Toggle optional"
                            >
                              Opt
                            </button>
                            <button
                              onClick={() => removeProductFromSystem(sp.id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 bg-blue-100 rounded text-[9px] font-medium text-blue-700 flex items-center justify-center">OR</span>
            <span>Option group (user picks one)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px]">Default</span>
            <span>Pre-selected choice</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">Pigmented</span>
            <span>Needs colour added</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px]">Optional</span>
            <span>Can toggle off</span>
          </div>
        </div>
      </div>
    )
  }

  // List view
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Systems</h1>
          <p className="text-gray-500 text-sm">Define product systems for the calculator</p>
        </div>
        <Button onClick={() => setShowAddSystem(true)} disabled={showAddSystem}>
          <Plus className="w-4 h-4 mr-2" /> New System
        </Button>
      </div>

      {/* Add System Form */}
      {showAddSystem && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle>Create New System</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="System Name"
              value={newSystem.name}
              onChange={e => setNewSystem({ ...newSystem, name: e.target.value })}
              placeholder="e.g., Terrazzo Floor Standard"
            />
            <Input
              label="Description"
              value={newSystem.description}
              onChange={e => setNewSystem({ ...newSystem, description: e.target.value })}
              placeholder="Brief description of this system"
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Surface Type</label>
              <select
                value={newSystem.surface_type}
                onChange={e => setNewSystem({ ...newSystem, surface_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createSystem} disabled={!newSystem.name.trim()}>Create System</Button>
              <Button variant="outline" onClick={() => { setShowAddSystem(false); setNewSystem({ name: '', description: '', surface_type: 'floor' }) }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Systems List */}
      <Card>
        <CardContent className="p-0">
          {systems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No systems defined yet. Create your first system to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {systems.map(system => (
                <div
                  key={system.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openSystem(system)}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${system.is_active ? 'bg-orange-100' : 'bg-gray-100'}`}>
                    <Layers className={`w-6 h-6 ${system.is_active ? 'text-orange-600' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{system.name}</span>
                      <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-600">
                        {system.surface_type === 'both' ? 'Floor & Wall' : system.surface_type}
                      </span>
                      {!system.is_active && (
                        <span className="px-2 py-0.5 text-xs rounded bg-red-100 text-red-600">Inactive</span>
                      )}
                    </div>
                    {system.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{system.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleSystem(system)}
                      className={`px-3 py-1.5 text-sm rounded-full ${system.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {system.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => deleteSystem(system)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
