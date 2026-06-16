import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, Pencil, Trash2, ChevronRight, Layers, ArrowLeft, Check, X, Droplet, ChevronUp, ChevronDown } from 'lucide-react'

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
  pack_size: number
  pack_unit: string
}

interface SystemProduct {
  id: string
  system_id: string
  product_id: string
  stage_id: string | null
  coverage_sqm: number
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
  pigment_default_on: boolean
  is_optional: boolean
  option_group: string | null
  is_default_option: boolean
  coverage_note: string | null
  display_order: number
  depends_on_product_id: string | null
  product?: Product
  stage?: Stage
}

interface FinishPreset {
  id: string
  system_id: string
  name: string
  description: string | null
  is_default: boolean
  is_active: boolean
  display_order: number
  products?: FinishPresetProduct[]
}

interface FinishPresetProduct {
  id: string
  preset_id: string
  product_id: string
  stage_id: string | null
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
  coverage_sqm: number
  coverage_note: string | null
  display_order: number
  product?: Product
}

interface PresetProductForm {
  id?: string
  product_id: string
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
}

// Form for editing a system_product
interface SystemProductForm {
  is_optional: boolean
  is_default_option: boolean
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
  pigment_default_on: boolean
  coverage_sqm: number
  coverage_note: string
  option_group: string
  depends_on_product_id: string | null
}

export function SystemsPage() {
  const [systems, setSystems] = useState<System[]>([])
  const [stages, setStages] = useState<Stage[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'edit'>('list')
  const [selectedSystem, setSelectedSystem] = useState<System | null>(null)
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([])
  const [finishPresets, setFinishPresets] = useState<FinishPreset[]>([])
  const [showAddSystem, setShowAddSystem] = useState(false)
  const [newSystem, setNewSystem] = useState({ name: '', description: '', surface_type: 'floor' as const })

  // System editing state (rename/delete)
  const [editingSystemId, setEditingSystemId] = useState<string | null>(null)
  const [editSystemName, setEditSystemName] = useState('')
  const [editSystemDescription, setEditSystemDescription] = useState('')
  const [deletingSystemId, setDeletingSystemId] = useState<string | null>(null)

  // Preset editing state
  const [editingPreset, setEditingPreset] = useState<FinishPreset | null>(null)
  const [presetForm, setPresetForm] = useState({ name: '', description: '' })
  const [presetProducts, setPresetProducts] = useState<PresetProductForm[]>([])
  const [showPresetModal, setShowPresetModal] = useState(false)

  // NEW: System product editing state
  const [editingProduct, setEditingProduct] = useState<SystemProduct | null>(null)
  const [productForm, setProductForm] = useState<SystemProductForm>({
    is_optional: false,
    is_default_option: false,
    default_coats: 1,
    min_coats: 1,
    max_coats: 1,
    has_pigment: false,
    pigment_default_on: false,
    coverage_sqm: 0,
    coverage_note: '',
    option_group: '',
    depends_on_product_id: null,
  })
  const [showProductModal, setShowProductModal] = useState(false)
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [newProductId, setNewProductId] = useState<string>('')
  const [newProductStageId, setNewProductStageId] = useState<string>('')

  // Stage creation state
  const [showNewStageModal, setShowNewStageModal] = useState(false)
  const [newStageName, setNewStageName] = useState('')

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

  async function fetchSystemDetails(systemId: string) {
    const { data: spData } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')
    setSystemProducts(spData || [])

    const { data: presetsData } = await supabase
      .from('finish_presets')
      .select('*')
      .eq('system_id', systemId)
      .order('display_order')

    if (presetsData) {
      const presetsWithProducts = await Promise.all(
        presetsData.map(async (preset) => {
          const { data: presetProducts } = await supabase
            .from('finish_preset_products')
            .select('*, product:products(*)')
            .eq('preset_id', preset.id)
            .order('display_order')
          return { ...preset, products: presetProducts || [] }
        })
      )
      setFinishPresets(presetsWithProducts)
    }
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
        is_active: true,
        display_order: maxOrder + 1
      })
      .select()
      .single()
    if (data) {
      setSystems([...systems, data])
      setNewSystem({ name: '', description: '', surface_type: 'floor' })
      setShowAddSystem(false)
    }
  }

  async function toggleSystemActive(system: System) {
    const { error } = await supabase
      .from('systems')
      .update({ is_active: !system.is_active })
      .eq('id', system.id)
    if (!error) {
      setSystems(systems.map(s => s.id === system.id ? { ...s, is_active: !s.is_active } : s))
    }
  }

  // Start editing a system's name/description
  function startEditSystem(system: System, e: React.MouseEvent) {
    e.stopPropagation()
    setEditingSystemId(system.id)
    setEditSystemName(system.name)
    setEditSystemDescription(system.description || '')
  }

  // Save system name/description changes
  async function saveSystemEdit() {
    if (!editingSystemId || !editSystemName.trim()) return
    
    const { error } = await supabase
      .from('systems')
      .update({ 
        name: editSystemName.trim(),
        description: editSystemDescription.trim() || null
      })
      .eq('id', editingSystemId)
    
    if (!error) {
      setSystems(systems.map(s => 
        s.id === editingSystemId 
          ? { ...s, name: editSystemName.trim(), description: editSystemDescription.trim() || null }
          : s
      ))
      setEditingSystemId(null)
      setEditSystemName('')
      setEditSystemDescription('')
    }
  }

  // Cancel editing
  function cancelSystemEdit() {
    setEditingSystemId(null)
    setEditSystemName('')
    setEditSystemDescription('')
  }

  // Confirm delete system
  async function confirmDeleteSystem() {
    if (!deletingSystemId) return
    
    // First delete all system_products for this system
    await supabase
      .from('system_products')
      .delete()
      .eq('system_id', deletingSystemId)
    
    // Then delete the system itself
    const { error } = await supabase
      .from('systems')
      .delete()
      .eq('id', deletingSystemId)
    
    if (!error) {
      setSystems(systems.filter(s => s.id !== deletingSystemId))
      setDeletingSystemId(null)
    }
  }

  function openSystem(system: System) {
    setSelectedSystem(system)
    setView('edit')
    fetchSystemDetails(system.id)
  }

  // =========================================
  // PRODUCT EDIT MODAL FUNCTIONS
  // =========================================

  function openAddProduct() {
    if (products.length === 0) {
      alert('No products available')
      return
    }
    
    setIsAddingProduct(true)
    setEditingProduct(null)
    setNewProductId(products[0]?.id || '')
    setNewProductStageId(stages[0]?.id || '')
    setProductForm({
      is_optional: true,
      is_default_option: false,
      default_coats: 1,
      min_coats: 1,
      max_coats: 2,
      has_pigment: false,
      pigment_default_on: true,
      coverage_sqm: 0,
      coverage_note: '',
      option_group: '',
      depends_on_product_id: '',
    })
    setShowProductModal(true)
  }

  function openProductEdit(sp: SystemProduct) {
    setIsAddingProduct(false)
    setEditingProduct(sp)
    setProductForm({
      is_optional: sp.is_optional,
      is_default_option: sp.is_default_option || false,
      default_coats: sp.default_coats || sp.min_coats || 1,
      min_coats: sp.min_coats || 1,
      max_coats: sp.max_coats || 1,
      has_pigment: sp.has_pigment || false,
      pigment_default_on: sp.pigment_default_on !== false,
      coverage_sqm: sp.coverage_sqm || 0,
      coverage_note: sp.coverage_note || '',
      option_group: sp.option_group || '',
      depends_on_product_id: sp.depends_on_product_id || '',
    })
    setShowProductModal(true)
  }

  function closeProductModal() {
    setShowProductModal(false)
    setEditingProduct(null)
    setIsAddingProduct(false)
  }

  async function createNewStage() {
    if (!newStageName.trim()) {
      alert('Please enter a stage name')
      return
    }

    const maxOrder = Math.max(...stages.map(s => s.display_order || 0), 0)
    
    const { data, error } = await supabase
      .from('stages')
      .insert({
        name: newStageName.trim(),
        display_order: maxOrder + 1,
      })
      .select()
      .single()

    if (error) {
      alert(`Error creating stage: ${error.message}`)
    } else if (data) {
      // Refresh stages list
      const { data: newStages } = await supabase
        .from('stages')
        .select('*')
        .order('display_order')
      if (newStages) setStages(newStages)
      
      // Auto-select the new stage
      setNewProductStageId(data.id)
      
      setShowNewStageModal(false)
      setNewStageName('')
    }
  }

  async function saveProductEdit() {
    if (!selectedSystem) {
      alert('No system selected')
      return
    }

    if (isAddingProduct) {
      // Adding new product
      if (!newProductId || !newProductStageId) {
        alert('Please select a product and stage')
        return
      }
      
      const maxOrder = Math.max(...systemProducts.map(sp => sp.display_order || 0), 0)
      
      const { error } = await supabase
        .from('system_products')
        .insert({
          system_id: selectedSystem.id,
          product_id: newProductId,
          stage_id: newProductStageId,
          is_optional: productForm.is_optional,
          is_default_option: productForm.is_default_option,
          min_coats: productForm.min_coats,
          max_coats: productForm.max_coats,
          has_pigment: productForm.has_pigment,
          pigment_default_on: productForm.pigment_default_on,
          coverage_sqm: productForm.coverage_sqm || null,
          coverage_note: productForm.coverage_note.trim() || null,
          option_group: productForm.option_group.trim() || null,
          depends_on_product_id: productForm.depends_on_product_id || null,
          display_order: maxOrder + 1,
        })

      if (error) {
        console.error('Insert error:', error)
        alert(`Error adding product: ${error.message}`)
      } else {
        await fetchSystemDetails(selectedSystem.id)
        closeProductModal()
      }
    } else {
      // Editing existing product
      if (!editingProduct) return

      const { error } = await supabase
        .from('system_products')
        .update({
          is_optional: productForm.is_optional,
          is_default_option: productForm.is_default_option,
          min_coats: productForm.min_coats,
          max_coats: productForm.max_coats,
          has_pigment: productForm.has_pigment,
          pigment_default_on: productForm.pigment_default_on,
          coverage_sqm: productForm.coverage_sqm || null,
          coverage_note: productForm.coverage_note.trim() || null,
          option_group: productForm.option_group.trim() || null,
          depends_on_product_id: productForm.depends_on_product_id || null,
        })
        .eq('id', editingProduct.id)

      if (error) {
        console.error('Update error:', error)
        alert(`Error updating product: ${error.message}`)
      } else {
        await fetchSystemDetails(selectedSystem.id)
        closeProductModal()
      }
    }
  }

  // =========================================
  // PRESET FUNCTIONS
  // =========================================

  function openNewPreset() {
    setEditingPreset(null)
    setPresetForm({ name: '', description: '' })
    setPresetProducts([])
    setShowPresetModal(true)
  }

  function openEditPreset(preset: FinishPreset) {
    setEditingPreset(preset)
    setPresetForm({ name: preset.name, description: preset.description || '' })
    setPresetProducts(
      preset.products?.map(p => ({
        id: p.id,
        product_id: p.product_id,
        default_coats: p.default_coats,
        min_coats: p.min_coats,
        max_coats: p.max_coats,
        has_pigment: p.has_pigment,
      })) || []
    )
    setShowPresetModal(true)
  }

  function closePresetModal() {
    setShowPresetModal(false)
    setEditingPreset(null)
  }

  function addPresetProduct() {
    const microProducts = products.filter(p =>
      p.name.includes('Magma 300') || p.name.includes('Magma 500') || p.name.includes('Magma 700')
    )
    const unused = microProducts.find(mp => !presetProducts.some(pp => pp.product_id === mp.id))
    if (unused) {
      setPresetProducts([...presetProducts, {
        product_id: unused.id,
        default_coats: 1,
        min_coats: 1,
        max_coats: 2,
        has_pigment: true,
      }])
    }
  }

  function removePresetProduct(idx: number) {
    setPresetProducts(presetProducts.filter((_, i) => i !== idx))
  }

  function updatePresetProduct(idx: number, field: keyof PresetProductForm, value: any) {
    setPresetProducts(presetProducts.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function movePresetProduct(idx: number, direction: 'up' | 'down') {
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === presetProducts.length - 1) return
    const newArr = [...presetProducts]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newArr[idx], newArr[swapIdx]] = [newArr[swapIdx], newArr[idx]]
    setPresetProducts(newArr)
  }

  async function savePreset() {
    if (!selectedSystem || !presetForm.name.trim()) return

    if (editingPreset) {
      await supabase
        .from('finish_presets')
        .update({ name: presetForm.name.trim(), description: presetForm.description.trim() || null })
        .eq('id', editingPreset.id)
      await supabase.from('finish_preset_products').delete().eq('preset_id', editingPreset.id)
      const microcementStage = stages.find(s => s.name === 'Microcement')
      if (presetProducts.length > 0) {
        await supabase.from('finish_preset_products').insert(
          presetProducts.map((pp, idx) => ({
            preset_id: editingPreset.id,
            product_id: pp.product_id,
            stage_id: microcementStage?.id || null,
            default_coats: pp.default_coats,
            min_coats: pp.min_coats,
            max_coats: pp.max_coats,
            has_pigment: pp.has_pigment,
            display_order: idx + 1,
          }))
        )
      }
    } else {
      const maxOrder = Math.max(...finishPresets.map(p => p.display_order), 0)
      const { data: newPreset } = await supabase
        .from('finish_presets')
        .insert({
          system_id: selectedSystem.id,
          name: presetForm.name.trim(),
          description: presetForm.description.trim() || null,
          is_default: finishPresets.length === 0,
          is_active: true,
          display_order: maxOrder + 1,
        })
        .select()
        .single()
      if (newPreset && presetProducts.length > 0) {
        const microcementStage = stages.find(s => s.name === 'Microcement')
        await supabase.from('finish_preset_products').insert(
          presetProducts.map((pp, idx) => ({
            preset_id: newPreset.id,
            product_id: pp.product_id,
            stage_id: microcementStage?.id || null,
            default_coats: pp.default_coats,
            min_coats: pp.min_coats,
            max_coats: pp.max_coats,
            has_pigment: pp.has_pigment,
            display_order: idx + 1,
          }))
        )
      }
    }

    await fetchSystemDetails(selectedSystem.id)
    closePresetModal()
  }

  async function deletePreset(preset: FinishPreset) {
    if (!confirm(`Delete "${preset.name}"?`)) return
    await supabase.from('finish_preset_products').delete().eq('preset_id', preset.id)
    await supabase.from('finish_presets').delete().eq('id', preset.id)
    setFinishPresets(finishPresets.filter(p => p.id !== preset.id))
  }

  async function setPresetAsDefault(preset: FinishPreset) {
    if (!selectedSystem) return
    await supabase
      .from('finish_presets')
      .update({ is_default: false })
      .eq('system_id', selectedSystem.id)
    await supabase
      .from('finish_presets')
      .update({ is_default: true })
      .eq('id', preset.id)
    setFinishPresets(finishPresets.map(p => ({ ...p, is_default: p.id === preset.id })))
  }

  const microProducts = products.filter(p =>
    p.name.includes('Magma 300') || p.name.includes('Magma 500') || p.name.includes('Magma 700')
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Edit system view
  if (view === 'edit' && selectedSystem) {
    const stageGroups: { [key: string]: { stage: string; stageOrder: number; products: SystemProduct[]; is_optional: boolean } } = {}
    systemProducts.forEach(sp => {
      const key = sp.option_group || sp.id
      if (!stageGroups[key]) {
        stageGroups[key] = {
          stage: sp.stage?.name || 'Other',
          stageOrder: sp.stage?.display_order || 99,
          products: [],
          is_optional: sp.is_optional
        }
      }
      stageGroups[key].products.push(sp)
    })

    const sortedGroups = Object.entries(stageGroups).sort(([, a], [, b]) => a.stageOrder - b.stageOrder)

    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => { setView('list'); setSelectedSystem(null); setSystemProducts([]); setFinishPresets([]) }}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Systems
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <Layers className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{selectedSystem.name}</h1>
            {selectedSystem.description && (
              <p className="text-gray-500 text-sm">{selectedSystem.description}</p>
            )}
          </div>
        </div>

        {/* FINISH PRESETS */}
        <Card className="mb-6">
          <CardHeader className="border-b bg-gradient-to-r from-orange-50 to-amber-50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Microcement finish</CardTitle>
                <p className="text-sm text-gray-600 mt-1">User picks one of these build-ups</p>
              </div>
              <Button onClick={openNewPreset}>
                <Plus className="w-4 h-4 mr-2" /> Add preset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            {finishPresets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No finish presets yet. Add your first preset.
              </div>
            ) : (
              <div className="space-y-3">
                {finishPresets.map(preset => {
                  return (
                    <div
                      key={preset.id}
                      className={`p-4 rounded-xl border-2 cursor-pointer hover:shadow-md transition-shadow ${
                        preset.is_default ? 'border-orange-400 bg-orange-50/50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                      onClick={() => openEditPreset(preset)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-gray-900">{preset.name}</span>
                            {preset.is_default && (
                              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">Default</span>
                            )}
                          </div>
                          {preset.description && (
                            <p className="text-sm text-gray-500 mt-0.5">{preset.description}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          {!preset.is_default && (
                            <button
                              onClick={() => setPresetAsDefault(preset)}
                              className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50"
                              title="Set as default"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deletePreset(preset)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {preset.products?.map((pp, idx) => (
                          <div key={pp.id} className="flex items-center gap-1 text-sm">
                            <span className="px-2 py-1 bg-gray-100 rounded font-medium">
                              {pp.product?.name?.replace('Magma ', '')}
                            </span>
                            <span className="text-gray-400">×{pp.default_coats}</span>
                            {pp.has_pigment && <Droplet className="w-3 h-3 text-blue-500" />}
                            {idx < (preset.products?.length || 0) - 1 && (
                              <span className="text-gray-300 mx-1">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* OTHER STAGES */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle>Other build-up stages</CardTitle>
              <Button variant="outline" onClick={openAddProduct}>
                <Plus className="w-4 h-4 mr-2" /> Add product
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedGroups.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No other stages configured.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {sortedGroups.map(([key, group]) => (
                  <div key={key} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-700">{group.stage}</span>
                        {group.is_optional && (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">optional</span>
                        )}
                      </div>
                      {group.products.length > 1 && (
                        <span className="text-xs text-gray-400">pick one</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {group.products.map(sp => (
                        <div
                          key={sp.id}
                          onClick={() => openProductEdit(sp)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                            sp.is_default_option
                              ? 'bg-gray-700 text-white border-gray-700 hover:bg-gray-600'
                              : 'bg-white border-gray-200 hover:border-blue-400'
                          }`}
                        >
                          <span className={sp.is_default_option ? 'text-white' : 'text-gray-900'}>
                            {sp.product?.name?.replace('DPM Epoxy Primer ', '').replace('Fibreglass ', '').replace('PU Seal ', '')}
                          </span>
                          {sp.has_pigment && (
                            <Droplet className={`w-3 h-3 ${sp.is_default_option ? 'text-blue-300' : 'text-blue-500'}`} />
                          )}
                          {(sp.max_coats || 1) > 1 && (
                            <span className={`text-xs ${sp.is_default_option ? 'text-gray-300' : 'text-gray-400'}`}>
                              {sp.min_coats || 1}-{sp.max_coats || 1}
                            </span>
                          )}
                          <Pencil className={`w-3 h-3 ${sp.is_default_option ? 'text-gray-400' : 'text-gray-300'}`} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* PRODUCT EDIT MODAL */}
        {showProductModal && (editingProduct || isAddingProduct) && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">
                  {isAddingProduct ? 'Add product to system' : `Edit: ${editingProduct?.product?.name}`}
                </h2>
                <button onClick={closeProductModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Product and Stage selection (only when adding) */}
                {isAddingProduct && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                      <select
                        value={newProductId}
                        onChange={e => setNewProductId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                
                {/* Stage selection (always show - for both add and edit) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stage / Section</label>
                  <div className="flex gap-2">
                    <select
                      value={isAddingProduct ? newProductStageId : (editingProduct?.stage_id || '')}
                      onChange={e => {
                        if (isAddingProduct) {
                          setNewProductStageId(e.target.value)
                        } else if (editingProduct) {
                          // Update stage directly in database
                          supabase
                            .from('system_products')
                            .update({ stage_id: e.target.value })
                            .eq('id', editingProduct.id)
                            .then(() => {
                              if (selectedSystem) fetchSystemDetails(selectedSystem.id)
                            })
                        }
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      {stages.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewStageModal(true)}
                      className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700"
                    >
                      + New
                    </button>
                  </div>
                </div>
                
                {/* Delete button (only when editing) */}
                {!isAddingProduct && editingProduct && (
                  <button
                    onClick={async () => {
                      if (confirm(`Remove ${editingProduct.product?.name} from this system?`)) {
                        await supabase.from('system_products').delete().eq('id', editingProduct.id)
                        await fetchSystemDetails(selectedSystem!.id)
                        closeProductModal()
                      }
                    }}
                    className="w-full py-2 px-4 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 font-medium"
                  >
                    Remove from system
                  </button>
                )}
                
                {/* Optional toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Optional layer</p>
                    <p className="text-sm text-gray-500">User can toggle this on/off</p>
                  </div>
                  <button
                    onClick={() => setProductForm({ ...productForm, is_optional: !productForm.is_optional })}
                    className={`w-14 h-7 rounded-full transition-colors relative ${
                      productForm.is_optional ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                      productForm.is_optional ? 'translate-x-7' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Default option toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Default selection</p>
                    <p className="text-sm text-gray-500">Pre-selected in option groups</p>
                  </div>
                  <button
                    onClick={() => setProductForm({ ...productForm, is_default_option: !productForm.is_default_option })}
                    className={`w-14 h-7 rounded-full transition-colors relative ${
                      productForm.is_default_option ? 'bg-amber-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                      productForm.is_default_option ? 'translate-x-7' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Pigment toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Has pigment</p>
                    <p className="text-sm text-gray-500">Show pigment toggle in calculator</p>
                  </div>
                  <button
                    onClick={() => setProductForm({ ...productForm, has_pigment: !productForm.has_pigment })}
                    className={`w-14 h-7 rounded-full transition-colors relative ${
                      productForm.has_pigment ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                      productForm.has_pigment ? 'translate-x-7' : 'translate-x-0.5'
                    }`} />
                  </button>
                </div>

                {/* Pigment default ON/OFF (only show when has_pigment is true) */}
                {productForm.has_pigment && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg ml-4">
                    <div>
                      <p className="font-medium text-gray-900">Pigment default ON</p>
                      <p className="text-sm text-gray-500">Toggle starts in ON position</p>
                    </div>
                    <button
                      onClick={() => setProductForm({ ...productForm, pigment_default_on: !productForm.pigment_default_on })}
                      className={`w-14 h-7 rounded-full transition-colors relative ${
                        productForm.pigment_default_on ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                        productForm.pigment_default_on ? 'translate-x-7' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                )}

                {/* Coats range */}
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Default</label>
                    <select
                      value={productForm.default_coats}
                      onChange={e => setProductForm({ ...productForm, default_coats: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
                    <select
                      value={productForm.min_coats}
                      onChange={e => setProductForm({ ...productForm, min_coats: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
                    <select
                      value={productForm.max_coats}
                      onChange={e => setProductForm({ ...productForm, max_coats: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                    >
                      {[1, 2, 3, 4].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Coverage */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coverage (m² per pack)</label>
                  <Input
                    type="number"
                    value={productForm.coverage_sqm || ''}
                    onChange={e => setProductForm({ ...productForm, coverage_sqm: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 20"
                  />
                </div>

                {/* Coverage note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coverage note</label>
                  <Input
                    value={productForm.coverage_note}
                    onChange={e => setProductForm({ ...productForm, coverage_note: e.target.value })}
                    placeholder="e.g., 1kg/m² = 20m² per 20kg pack"
                  />
                </div>

                {/* Option group */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Option group</label>
                  <Input
                    value={productForm.option_group}
                    onChange={e => setProductForm({ ...productForm, option_group: e.target.value })}
                    placeholder="e.g., dpm_type, mesh_type"
                  />
                  <p className="text-xs text-gray-500 mt-1">Products with the same group become OR choices</p>
                </div>

                {/* Depends on (conditional visibility) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Only show when selected</label>
                  <select
                    value={productForm.depends_on_product_id}
                    onChange={e => setProductForm({ ...productForm, depends_on_product_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  >
                    <option value="">Always show (no dependency)</option>
                    {systemProducts
                      .filter(sp => sp.option_group && sp.id !== editingProduct?.id)
                      .map(sp => (
                        <option key={sp.id} value={sp.id}>
                          {sp.product?.name} ({sp.stage?.name})
                        </option>
                      ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">This layer only appears when the selected product is chosen</p>
                </div>
              </div>

              <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
                <Button variant="outline" className="flex-1" onClick={closeProductModal}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={saveProductEdit}>
                  {isAddingProduct ? 'Add product' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* NEW STAGE MODAL */}
        {showNewStageModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="text-lg font-semibold">Create new stage</h2>
                <button onClick={() => setShowNewStageModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Stage name</label>
                <Input
                  value={newStageName}
                  onChange={e => setNewStageName(e.target.value)}
                  placeholder="e.g., Microcement Finish Options"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === 'Enter') createNewStage()
                  }}
                />
              </div>
              <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
                <Button variant="outline" className="flex-1" onClick={() => setShowNewStageModal(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={createNewStage}>
                  Create stage
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* PRESET MODAL */}
        {showPresetModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-auto">
              <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
                <h2 className="text-lg font-semibold">
                  {editingPreset ? 'Edit preset' : 'Create preset'}
                </h2>
                <button onClick={closePresetModal} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Preset name</label>
                    <Input
                      placeholder="e.g., Smooth finish"
                      value={presetForm.name}
                      onChange={e => setPresetForm({ ...presetForm, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <Input
                      placeholder="Brief description"
                      value={presetForm.description}
                      onChange={e => setPresetForm({ ...presetForm, description: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-700">Build-up recipe</label>
                    <Button size="sm" variant="outline" onClick={addPresetProduct}>
                      <Plus className="w-3 h-3 mr-1" /> Add layer
                    </Button>
                  </div>
                  
                  {presetProducts.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 border-2 border-dashed rounded-xl">
                      Add microcement layers
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {presetProducts.map((pp, idx) => {
                        return (
                          <div key={idx} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => movePresetProduct(idx, 'up')}
                                disabled={idx === 0}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => movePresetProduct(idx, 'down')}
                                disabled={idx === presetProducts.length - 1}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <select
                              value={pp.product_id}
                              onChange={e => updatePresetProduct(idx, 'product_id', e.target.value)}
                              className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm"
                            >
                              {microProducts.map(mp => (
                                <option key={mp.id} value={mp.id}>{mp.name.replace('Magma ', '')}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => updatePresetProduct(idx, 'has_pigment', !pp.has_pigment)}
                              className={`p-1.5 rounded transition-colors ${
                                pp.has_pigment ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                              }`}
                              title="Toggle pigment"
                            >
                              <Droplet className="w-4 h-4" />
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Default:</span>
                              <select
                                value={pp.default_coats}
                                onChange={e => updatePresetProduct(idx, 'default_coats', parseInt(e.target.value))}
                                className="w-14 px-1 py-1 border border-gray-200 rounded text-sm"
                              >
                                {[1, 2, 3].map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">Range:</span>
                              <select
                                value={pp.min_coats}
                                onChange={e => updatePresetProduct(idx, 'min_coats', parseInt(e.target.value))}
                                className="w-12 px-1 py-1 border border-gray-200 rounded text-sm"
                              >
                                {[1, 2, 3].map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                              <span className="text-gray-400">-</span>
                              <select
                                value={pp.max_coats}
                                onChange={e => updatePresetProduct(idx, 'max_coats', parseInt(e.target.value))}
                                className="w-12 px-1 py-1 border border-gray-200 rounded text-sm"
                              >
                                {[1, 2, 3].map(n => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                            </div>
                            <button
                              onClick={() => removePresetProduct(idx)}
                              className="p-1.5 text-gray-400 hover:text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {presetProducts.length > 0 && (
                  <div className="p-3 bg-blue-50 rounded-xl">
                    <p className="text-xs text-blue-600 font-medium mb-2">Installer sees:</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {presetProducts.map((pp, idx) => {
                        const prod = products.find(p => p.id === pp.product_id)
                        return (
                          <div key={idx} className="flex items-center gap-1">
                            <span className="px-2 py-1 bg-white rounded text-sm font-medium">
                              {prod?.name?.replace('Magma ', '')}
                            </span>
                            <span className="text-gray-500 text-sm">×{pp.default_coats}</span>
                            {pp.has_pigment && <Droplet className="w-3 h-3 text-blue-500" />}
                            {idx < presetProducts.length - 1 && (
                              <span className="text-gray-300 mx-1">→</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
                <Button variant="outline" className="flex-1" onClick={closePresetModal}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={savePreset} disabled={!presetForm.name.trim()}>
                  {editingPreset ? 'Save changes' : 'Create preset'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // List view
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Systems</h1>
          <p className="text-gray-500">Manage microcement build-up systems</p>
        </div>
        <Button onClick={() => setShowAddSystem(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add System
        </Button>
      </div>

      {showAddSystem && (
        <Card className="mb-6 border-2 border-dashed border-orange-300">
          <CardContent className="p-4">
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <Input
                placeholder="System name"
                value={newSystem.name}
                onChange={e => setNewSystem({ ...newSystem, name: e.target.value })}
              />
              <Input
                placeholder="Description (optional)"
                value={newSystem.description}
                onChange={e => setNewSystem({ ...newSystem, description: e.target.value })}
              />
              <select
                value={newSystem.surface_type}
                onChange={e => setNewSystem({ ...newSystem, surface_type: e.target.value as any })}
                className="px-3 py-2 border border-gray-200 rounded-lg"
              >
                <option value="floor">Floor</option>
                <option value="wall">Wall</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAddSystem(false)}>Cancel</Button>
              <Button onClick={createSystem}>Create</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {systems.map(system => (
          <Card
            key={system.id}
            className={`transition-all hover:shadow-md ${!system.is_active ? 'opacity-60' : ''}`}
          >
            <CardContent className="p-4">
              {editingSystemId === system.id ? (
                // Edit mode
                <div className="space-y-3">
                  <Input
                    value={editSystemName}
                    onChange={e => setEditSystemName(e.target.value)}
                    placeholder="System name"
                    className="font-semibold"
                    autoFocus
                  />
                  <Input
                    value={editSystemDescription}
                    onChange={e => setEditSystemDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="text-sm"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={cancelSystemEdit}>
                      <X className="w-4 h-4 mr-1" /> Cancel
                    </Button>
                    <Button size="sm" onClick={saveSystemEdit}>
                      <Check className="w-4 h-4 mr-1" /> Save
                    </Button>
                  </div>
                </div>
              ) : deletingSystemId === system.id ? (
                // Delete confirmation
                <div className="space-y-3">
                  <p className="text-red-600 font-medium">Delete "{system.name}"?</p>
                  <p className="text-sm text-gray-500">This will remove the system and all its product configurations. This cannot be undone.</p>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDeletingSystemId(null)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" size="sm" onClick={confirmDeleteSystem}>
                      <Trash2 className="w-4 h-4 mr-1" /> Delete
                    </Button>
                  </div>
                </div>
              ) : (
                // Normal view
                <div className="flex items-center justify-between">
                  <div className="flex-1 cursor-pointer" onClick={() => openSystem(system)}>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{system.name}</h3>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        system.surface_type === 'floor' ? 'bg-blue-100 text-blue-700' :
                        system.surface_type === 'wall' ? 'bg-green-100 text-green-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {system.surface_type}
                      </span>
                      {!system.is_active && (
                        <span className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-500">inactive</span>
                      )}
                    </div>
                    {system.description && (
                      <p className="text-sm text-gray-500 mt-1">{system.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={e => startEditSystem(system, e)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="Rename"
                    >
                      <Pencil className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setDeletingSystemId(system.id) }}
                      className="p-2 hover:bg-red-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); toggleSystemActive(system) }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg ${
                        system.is_active
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {system.is_active ? 'Active' : 'Inactive'}
                    </button>
                    <button
                      onClick={() => openSystem(system)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
