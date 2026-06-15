import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useColours } from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { SaveQuoteModal } from '@/components/SaveQuoteModal'

// Types
interface System {
  id: string
  name: string
  description: string | null
  surface_type: 'floor' | 'wall' | 'both'
}

interface SystemProduct {
  id: string
  product_id: string
  stage_id: string
  option_group: string | null
  is_default_option: boolean
  is_optional: boolean
  coverage_sqm: number
  coverage_kg_per_sqm: number
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
  pigment_default_on: boolean
  depends_on_product_id: string | null
  coverage_note: string | null
  display_order: number
  surface_type?: 'floor' | 'wall'  // Added for "both" mode
  product: {
    id: string
    name: string
    pack_size: number
    pack_unit: string
    price: number
  }
  stage: {
    id: string
    name: string
    display_order: number
  }
}

interface LayerState {
  enabled: boolean
  selectedProductId: string | null
  coats: number
  pigment: boolean
}

export function Calculator() {
  const { coloursByFamily, loading: coloursLoading } = useColours()
  const { settings, loading: settingsLoading } = useSettings()
  const [systems, setSystems] = useState<System[]>([])
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [settingsApplied, setSettingsApplied] = useState(false)

  // Main state
  const [surface, setSurface] = useState<'floor' | 'wall' | 'both'>('floor')
  const [floorArea, setFloorArea] = useState(20)
  const [wallArea, setWallArea] = useState(10)
  const [wastagePercent, setWastagePercent] = useState(10)
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  // For "both" mode - separate floor and wall systems
  const [floorSystemId, setFloorSystemId] = useState<string | null>(null)
  const [wallSystemId, setWallSystemId] = useState<string | null>(null)
  const [floorProducts, setFloorProducts] = useState<SystemProduct[]>([])
  const [wallProducts, setWallProducts] = useState<SystemProduct[]>([])
  const [selectedColour, setSelectedColour] = useState({ name: 'Natural', hex: '#E8E4DC' })
  
  // Custom colour state
  const [useCustomColour, setUseCustomColour] = useState(false)
  const [customColourName, setCustomColourName] = useState('')
  const [customColourHex, setCustomColourHex] = useState('')
  
  // Save quote modal
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Layer states - keyed by stage name or option_group (prefixed with floor_/wall_ in both mode)
  const [layerStates, setLayerStates] = useState<{ [key: string]: LayerState }>({})

  // Load systems on mount
  useEffect(() => {
    async function loadSystems() {
      const { data } = await supabase
        .from('systems')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      
      if (data && data.length > 0) {
        setSystems(data)
        // Auto-select first floor and wall systems
        const floorSystem = data.find(s => s.surface_type === 'floor')
        const wallSystem = data.find(s => s.surface_type === 'wall')
        if (floorSystem) {
          setFloorSystemId(floorSystem.id)
          handleSystemChange(floorSystem.id)
        }
        if (wallSystem) {
          setWallSystemId(wallSystem.id)
        }
      }
      setLoading(false)
    }
    loadSystems()
  }, [])

  // Apply settings defaults once loaded
  useEffect(() => {
    if (!settingsLoading && !settingsApplied) {
      setFloorArea(settings.default_floor_area)
      setWallArea(settings.default_wall_area)
      setWastagePercent(settings.default_wastage_percent)
      setSettingsApplied(true)
    }
  }, [settingsLoading, settings, settingsApplied])

  // Auto-select appropriate system when surface type changes
  useEffect(() => {
    if (systems.length === 0) return
    
    let targetSystem: System | undefined
    
    if (surface === 'floor' || surface === 'both') {
      targetSystem = systems.find(s => s.surface_type === 'floor')
    } else if (surface === 'wall') {
      targetSystem = systems.find(s => s.surface_type === 'wall')
    }
    
    if (targetSystem && targetSystem.id !== selectedSystemId) {
      handleSystemChange(targetSystem.id)
    }
  }, [surface, systems])

  // Auto-refresh when window regains focus (picks up admin changes)
  useEffect(() => {
    function onFocus() {
      if (selectedSystemId) {
        handleSystemChange(selectedSystemId)
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [selectedSystemId])

  // Load system products when system changes (for single surface mode)
  async function handleSystemChange(systemId: string) {
    setSelectedSystemId(systemId)
    
    const { data } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')

    if (data) {
      setSystemProducts(data)
      
      // Initialize layer states from defaults
      initLayerStates(data, '')
    }
  }

  // Load products for a specific surface in "both" mode
  async function loadSurfaceProducts(systemId: string, surfaceType: 'floor' | 'wall') {
    const { data } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')

    if (data) {
      if (surfaceType === 'floor') {
        setFloorProducts(data)
        initLayerStates(data, 'floor_', true)
      } else {
        setWallProducts(data)
        initLayerStates(data, 'wall_', true)
      }
    }
  }

  // Initialize layer states with optional prefix and merge mode
  function initLayerStates(data: SystemProduct[], prefix: string, merge = false) {
    const newStates: { [key: string]: LayerState } = {}
    
    data.forEach(sp => {
      const key = prefix + (sp.option_group || `standalone_${sp.product_id}`)
      const isStandalone = !sp.option_group
      
      if (!newStates[key]) {
        newStates[key] = {
          enabled: !sp.is_optional || sp.is_default_option,
          selectedProductId: isStandalone ? sp.product_id : (sp.is_default_option ? sp.product_id : null),
          coats: sp.default_coats || sp.min_coats || 1,
          pigment: sp.has_pigment ? (sp.pigment_default_on !== false) : false,
        }
      } else if (sp.is_default_option) {
        newStates[key].selectedProductId = sp.product_id
        newStates[key].coats = sp.default_coats || sp.min_coats || 1
        newStates[key].pigment = sp.has_pigment ? (sp.pigment_default_on !== false) : false
        if (sp.is_optional) {
          newStates[key].enabled = true
        }
      }
    })
    
    if (merge) {
      setLayerStates(prev => ({ ...prev, ...newStates }))
    } else {
      setLayerStates(newStates)
    }
  }

  // Handle floor/wall system change in "both" mode
  function handleFloorSystemChange(systemId: string) {
    setFloorSystemId(systemId)
    loadSurfaceProducts(systemId, 'floor')
  }

  function handleWallSystemChange(systemId: string) {
    setWallSystemId(systemId)
    loadSurfaceProducts(systemId, 'wall')
  }

  // Load both systems when switching to "both" mode
  useEffect(() => {
    if (surface === 'both' && floorSystemId && wallSystemId) {
      // Clear existing state and load both
      setLayerStates({})
      loadSurfaceProducts(floorSystemId, 'floor')
      loadSurfaceProducts(wallSystemId, 'wall')
    }
  }, [surface])

  function toggleLayer(key: string) {
    setLayerStates(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key]?.enabled }
    }))
  }

  function selectProduct(key: string, productId: string) {
    // Find the system product to get its pigment_default_on value
    const sp = systemProducts.find(p => p.product_id === productId)
    const pigmentDefault = sp?.has_pigment ? (sp.pigment_default_on !== false) : false
    
    setLayerStates(prev => ({
      ...prev,
      [key]: { 
        ...prev[key], 
        selectedProductId: productId,
        pigment: pigmentDefault,
        // Also update coats to the new product's defaults
        coats: sp?.default_coats || sp?.min_coats || prev[key]?.coats || 1
      }
    }))
  }

  function setCoats(key: string, coats: number) {
    setLayerStates(prev => ({
      ...prev,
      [key]: { ...prev[key], coats }
    }))
  }

  function togglePigment(key: string) {
    setLayerStates(prev => ({
      ...prev,
      [key]: { ...prev[key], pigment: !prev[key]?.pigment }
    }))
  }

  // Group products by stage
  function getLayersByStage(products: SystemProduct[] = systemProducts, prefix: string = '') {
    const stages: { [stageName: string]: { stageOrder: number; layers: { key: string; products: SystemProduct[]; isOptional: boolean }[] } } = {}
    
    products.forEach(sp => {
      // Skip pigment products - they're calculated automatically
      if (sp.product?.name?.toLowerCase().includes('pigment')) return
      
      const stageName = sp.stage?.name || 'Other'
      const stageOrder = sp.stage?.display_order || 99
      
      if (!stages[stageName]) {
        stages[stageName] = { stageOrder, layers: [] }
      }
      
      const key = prefix + (sp.option_group || `standalone_${sp.product_id}`)
      let layer = stages[stageName].layers.find(l => l.key === key)
      
      if (!layer) {
        layer = { key, products: [], isOptional: sp.is_optional }
        stages[stageName].layers.push(layer)
      }
      
      layer.products.push(sp)
    })
    
    // Sort stages by display_order
    return Object.entries(stages)
      .sort(([, a], [, b]) => a.stageOrder - b.stageOrder)
  }

  // Calculate materials
  function calculate() {
    const items: { name: string; qty: string; units: number; unitSize: string; cost: number }[] = []
    const floorAreaWithWastage = floorArea * (1 + wastagePercent / 100)
    const wallAreaWithWastage = wallArea * (1 + wastagePercent / 100)
    let totalPigmentPacks = 0

    // Helper to process products for a surface
    function processProducts(products: SystemProduct[], prefix: string, area: number, surfaceLabel: string) {
      Object.entries(layerStates).forEach(([key, state]) => {
        if (!key.startsWith(prefix) && prefix !== '') return
        if (!state.enabled) return
        if (!state.selectedProductId) return

        const sp = products.find(p => p.product_id === state.selectedProductId)
        if (!sp || !sp.product) return
        
        if (sp.product.name?.toLowerCase().includes('pigment')) return

        const coats = state.coats || 1
        const coverage = sp.coverage_sqm || sp.product.pack_size
        const areaWithCoats = area * coats
        const unitsNeeded = Math.ceil(areaWithCoats / coverage)

        const displayName = surface === 'both' ? `${surfaceLabel}${sp.product.name}` : sp.product.name

        items.push({
          name: displayName,
          qty: coats > 1 ? `${area.toFixed(1)}m² × ${coats} coats` : `${area.toFixed(1)}m²`,
          units: unitsNeeded,
          unitSize: `${sp.product.pack_size}${sp.product.pack_unit}`,
          cost: unitsNeeded * sp.product.price,
        })

        if (state.pigment && sp.has_pigment) {
          totalPigmentPacks += unitsNeeded
        }
      })
    }

    if (surface === 'both') {
      processProducts(floorProducts, 'floor_', floorAreaWithWastage, '(F) ')
      processProducts(wallProducts, 'wall_', wallAreaWithWastage, '(W) ')
    } else {
      const area = surface === 'floor' ? floorAreaWithWastage : wallAreaWithWastage
      processProducts(systemProducts, '', area, '')
    }

    // Add pigment pots (1 per pack of pigmented product)
    // Skip if "Natural" colour is selected (no pigment needed)
    const isNaturalColour = selectedColour.name.toLowerCase().includes('natural') || 
                            (useCustomColour && customColourName.toLowerCase().includes('natural'))
    
    if (totalPigmentPacks > 0 && !isNaturalColour) {
      const allProds = surface === 'both' ? [...floorProducts, ...wallProducts] : systemProducts
      const pigmentProduct = allProds.find(sp => sp.product?.name?.toLowerCase().includes('pigment'))?.product
      const pigmentPrice = pigmentProduct?.price || settings.pigment_price
      const colourName = useCustomColour ? (customColourName || 'Custom') : selectedColour.name
      items.push({
        name: `Pigment - ${colourName}`,
        qty: `${totalPigmentPacks} pot${totalPigmentPacks > 1 ? 's' : ''}`,
        units: totalPigmentPacks,
        unitSize: 'pot',
        cost: totalPigmentPacks * pigmentPrice,
      })
    }

    const subtotal = items.reduce((sum, item) => sum + item.cost, 0)
    return { items, subtotal }
  }

  const { items, subtotal } = calculate()
  const vat = subtotal * settings.vat_rate
  const total = subtotal + vat
  const totalArea = surface === 'floor' ? floorArea : surface === 'wall' ? wallArea : floorArea + wallArea
  const costPerM2 = totalArea > 0 ? subtotal / totalArea : 0

  // Map items for SaveQuoteModal
  const quoteItems = items.map(it => ({
    code: '',
    name: it.name,
    quantity: it.units,
    unitPrice: it.units ? it.cost / it.units : 0,
    total: it.cost,
  }))

  const selectedSystem = systems.find(s => s.id === selectedSystemId)
  
  // Get stage groups based on mode
  const floorStageGroups = getLayersByStage(floorProducts, 'floor_')
  const wallStageGroups = getLayersByStage(wallProducts, 'wall_')
  const singleStageGroups = getLayersByStage(systemProducts, '')

  // Render a single layer card
  function renderLayerCard(layer: { key: string; products: SystemProduct[]; isOptional: boolean }, stageName: string) {
    const state = layerStates[layer.key] || { enabled: false, selectedProductId: null, coats: 1, pigment: false }
    const hasMultipleProducts = layer.products.length > 1
    const selectedProduct = hasMultipleProducts 
      ? layer.products.find(p => p.product_id === state.selectedProductId)
      : layer.products[0]
    
    // Check if this layer depends on another product being selected
    const dependsOnId = layer.products[0]?.depends_on_product_id
    if (dependsOnId) {
      // Use the appropriate products array based on prefix
      const prefix = layer.key.startsWith('floor_') ? 'floor_' : (layer.key.startsWith('wall_') ? 'wall_' : '')
      const productsToSearch = prefix === 'floor_' ? floorProducts : (prefix === 'wall_' ? wallProducts : systemProducts)
      const dependsOnSp = productsToSearch.find(sp => sp.id === dependsOnId)
      if (dependsOnSp) {
        const dependsOnKey = prefix + (dependsOnSp.option_group || `standalone_${dependsOnSp.product_id}`)
        const dependsOnState = layerStates[dependsOnKey]
        if (!dependsOnState?.enabled || dependsOnState?.selectedProductId !== dependsOnSp.product_id) {
          return null
        }
      }
    }
    
    const hasCoatOptions = selectedProduct && 
      (selectedProduct.min_coats || 1) < (selectedProduct.max_coats || 1)
    const hasPigmentOption = selectedProduct?.has_pigment
    const showFullCard = state.enabled || !layer.isOptional || hasCoatOptions || hasPigmentOption
    const fixedCoats = selectedProduct && 
      (selectedProduct.min_coats || 1) === (selectedProduct.max_coats || 1) && 
      (selectedProduct.min_coats || 1) > 1 
        ? selectedProduct.min_coats 
        : null

    return (
      <div key={layer.key} className={`bg-gray-50 border border-gray-100 rounded-lg p-4 ${
        layer.isOptional && !state.enabled ? 'opacity-60' : ''
      }`}>
        {/* Layer header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-gray-900">
              {hasMultipleProducts 
                ? stageName 
                : selectedProduct?.product?.name || layer.products[0]?.product?.name || stageName}
            </p>
            {selectedProduct?.coverage_note && (
              <p className="text-xs text-gray-500 mt-0.5">{selectedProduct.coverage_note}</p>
            )}
          </div>
          {layer.isOptional && (
            <button
              onClick={() => toggleLayer(layer.key)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                state.enabled ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                state.enabled ? 'translate-x-6' : 'translate-x-0.5'
              }`} />
            </button>
          )}
        </div>

        {/* Product choices and options - show if not collapsed */}
        {showFullCard && (
          <div className={layer.isOptional && !state.enabled ? 'opacity-50 pointer-events-none' : ''}>
            {/* Product choice buttons */}
            {hasMultipleProducts && (
              <div className="flex flex-wrap gap-2 mt-3">
                {layer.products.map(sp => (
                  <button
                    key={sp.product_id}
                    onClick={() => selectProduct(layer.key, sp.product_id)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      state.selectedProductId === sp.product_id
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {sp.product?.name?.replace('Magma ', '').replace(' Microcement', '') || 'Product'}
                  </button>
                ))}
              </div>
            )}

            {/* Coats and pigment */}
            {(hasCoatOptions || hasPigmentOption || fixedCoats) && (
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                {/* Coat selector */}
                {hasCoatOptions && selectedProduct && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Coats:</span>
                    <div className="flex gap-1">
                      {Array.from(
                        { length: (selectedProduct.max_coats || 1) - (selectedProduct.min_coats || 1) + 1 },
                        (_, i) => (selectedProduct.min_coats || 1) + i
                      ).map(num => (
                        <button
                          key={num}
                          onClick={() => setCoats(layer.key, num)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium ${
                            state.coats === num
                              ? 'bg-blue-600 text-white'
                              : 'bg-white border border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Fixed coats badge */}
                {fixedCoats && !hasCoatOptions && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Coats:</span>
                    <span className="px-2 py-1 bg-gray-100 rounded text-sm font-medium">{fixedCoats}</span>
                  </div>
                )}
                {/* Pigment toggle */}
                {hasPigmentOption && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Add pigment:</span>
                    <button
                      onClick={() => !layer.isOptional || state.enabled ? togglePigment(layer.key) : null}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        state.pigment ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-transform ${
                        state.pigment ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render stage groups - returns flat array of layer cards
  function renderStageGroups(groups: [string, { layers: any[] }][]) {
    const result: React.ReactNode[] = []
    groups.forEach(([stageName, { layers }]) => {
      layers.forEach(layer => {
        const card = renderLayerCard(layer, stageName)
        if (card) result.push(card)
      })
    })
    return result
  }

  // Copy list
  function copyList() {
    let text = `MAGMA CALCULATOR - ${selectedSystem?.name || 'Quote'}\n`
    text += `${totalArea}m² - ${selectedColour.name}\n`
    text += '================================\n\n'
    
    items.forEach(item => {
      text += `${item.units}× ${item.name} (${item.unitSize}) - £${formatCurrency(item.cost)}\n`
    })

    text += `\nSubtotal: £${formatCurrency(subtotal)}`
    text += `\nVAT: £${formatCurrency(vat)}`
    text += `\nTOTAL: £${formatCurrency(total)}`
    text += `\n\nCost per m² (ex VAT): £${formatCurrency(costPerM2)}`
    text += `\n\n* Includes ${wastagePercent}% wastage`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || coloursLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Filter systems by surface type
  const availableSystems = systems.filter(s => {
    if (surface === 'floor') return s.surface_type === 'floor' || s.name.toLowerCase().includes('floor')
    if (surface === 'wall') return s.surface_type === 'wall' || s.name.toLowerCase().includes('wall')
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Magma Calculator</h1>
        <p className="text-gray-500 text-sm mt-1">Material estimator for microcement systems</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6">
        {/* Configuration */}
        <div className="space-y-4">
          {/* Surface type */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-3">Surface type</p>
            <div className="flex gap-2">
              {(['floor', 'wall', 'both'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSurface(s)}
                  className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                    surface === s
                      ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                      : 'bg-white border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {s === 'floor' ? 'Floor' : s === 'wall' ? 'Wall' : 'Floor + Wall'}
                </button>
              ))}
            </div>
          </div>

          {/* Area */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-3">Area</p>
            <div className="flex flex-wrap items-center gap-4">
              {(surface === 'floor' || surface === 'both') && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium">Floor:</label>
                  <input
                    type="number"
                    value={floorArea}
                    onChange={e => setFloorArea(parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center font-semibold"
                  />
                  <span className="text-sm text-gray-500">m²</span>
                </div>
              )}
              {(surface === 'wall' || surface === 'both') && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 font-medium">Wall:</label>
                  <input
                    type="number"
                    value={wallArea}
                    onChange={e => setWallArea(parseFloat(e.target.value) || 1)}
                    className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-center font-semibold"
                  />
                  <span className="text-sm text-gray-500">m²</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-500">Wastage:</label>
                <input
                  type="number"
                  value={wastagePercent}
                  onChange={e => setWastagePercent(parseFloat(e.target.value) || 0)}
                  className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-center"
                />
                <span className="text-sm text-gray-500">%</span>
              </div>
            </div>
          </div>

          {/* Build type / System - shows separately for floor and wall in "both" mode */}
          {surface === 'both' ? (
            <>
              {/* Floor configuration */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-orange-500 text-white text-xs font-bold flex items-center justify-center">F</div>
                  <p className="text-sm font-medium text-gray-700">Floor configuration</p>
                </div>
                <p className="text-xs text-gray-400 mb-2">Build type</p>
                <div className="flex gap-2 mb-4">
                  {systems.filter(s => s.surface_type === 'floor').map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleFloorSystemChange(system.id)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                        floorSystemId === system.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                          : 'bg-white border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {system.name.replace('Floor ', '')}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {renderStageGroups(floorStageGroups as [string, { layers: any[] }][])}
                </div>
              </div>

              {/* Wall configuration */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-blue-500 text-white text-xs font-bold flex items-center justify-center">W</div>
                  <p className="text-sm font-medium text-gray-700">Wall configuration</p>
                </div>
                <p className="text-xs text-gray-400 mb-2">Build type</p>
                <div className="flex gap-2 mb-4">
                  {systems.filter(s => s.surface_type === 'wall').map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleWallSystemChange(system.id)}
                      className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                        wallSystemId === system.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                          : 'bg-white border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {system.name.replace('Wall ', '')}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  {renderStageGroups(wallStageGroups as [string, { layers: any[] }][])}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Single surface mode */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-3">Build type</p>
                <div className="flex gap-2">
                  {availableSystems.map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleSystemChange(system.id)}
                      className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                        selectedSystemId === system.id
                          ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                          : 'bg-white border border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {system.name.replace('Floor ', '').replace('Wall ', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layers */}
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-sm text-gray-500 mb-4">Layers</p>
                <div className="space-y-3">
                  {renderStageGroups(singleStageGroups as [string, { layers: any[] }][])}
                </div>
              </div>
            </>
          )}

          {/* Colour picker */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-3">Pigment colour</p>
            
            {/* Natural / No Pigment option - always visible */}
            <button
              onClick={() => {
                setSelectedColour({ name: 'Natural (No Pigment)', hex: '#F5F5F0' })
                setUseCustomColour(false)
              }}
              className={`w-full mb-4 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                selectedColour.name.toLowerCase().includes('natural') && !useCustomColour
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="w-5 h-5 rounded border border-gray-300" style={{ backgroundColor: '#F5F5F0' }} />
              Natural (No Pigment)
            </button>
            
            <div className="space-y-3">
              {coloursByFamily.map(({ family, shades }) => (
                <div key={family.id}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{family.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {shades.map(swatch => (
                      <button
                        key={swatch.id}
                        onClick={() => {
                          setSelectedColour({ name: swatch.name, hex: swatch.hex_code })
                          setUseCustomColour(false)
                        }}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          selectedColour.name === swatch.name && !useCustomColour
                            ? 'border-gray-900 scale-110 shadow-lg'
                            : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: swatch.hex_code }}
                        title={swatch.name}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Custom colour section */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Custom Colour</p>
                <button
                  onClick={() => setUseCustomColour(!useCustomColour)}
                  className={`text-xs px-2 py-1 rounded ${
                    useCustomColour 
                      ? 'bg-orange-100 text-orange-700' 
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {useCustomColour ? 'Using Custom' : 'Use Custom'}
                </button>
              </div>
              {useCustomColour && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Colour name (e.g. Farrow & Ball Hague Blue)"
                      value={customColourName}
                      onChange={e => setCustomColourName(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="#000000"
                      value={customColourHex}
                      onChange={e => setCustomColourHex(e.target.value)}
                      className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono"
                    />
                    <input
                      type="color"
                      value={customColourHex || '#888888'}
                      onChange={e => setCustomColourHex(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <span className="flex-1 text-xs text-gray-400 self-center">
                      Pick or enter hex code
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected colour display */}
            <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
              <div 
                className="w-8 h-8 rounded-lg border border-gray-200"
                style={{ backgroundColor: useCustomColour ? (customColourHex || '#888888') : selectedColour.hex }}
              />
              <span className="font-medium">
                {useCustomColour ? (customColourName || 'Custom Colour') : selectedColour.name}
              </span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-gray-900">Materials</h2>
              <button
                onClick={copyList}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-magma"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">
                Configure your layers to see materials
              </p>
            ) : (
              <>
                <div className="space-y-1 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">£{formatCurrency(item.cost)}</p>
                        <p className="text-xs text-gray-500">{item.units} × {item.unitSize}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t-2 border-gray-200 pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">£{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">VAT (20%)</span>
                    <span className="font-medium">£{formatCurrency(vat)}</span>
                  </div>
                  <div className="flex justify-between text-xl font-bold pt-2">
                    <span>Total</span>
                    <span className="text-magma">£{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Cost per m²</span>
                    <span className="font-semibold">£{formatCurrency(costPerM2)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-4">
                  * Includes {wastagePercent}% wastage
                </p>
              </>
            )}
          </div>

          <Button 
            className="w-full mt-4" 
            size="lg"
            disabled={items.length === 0}
            onClick={() => setShowSaveModal(true)}
          >
            Save Quote
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">© Magma Coatings Ltd</p>
      
      {/* Save Quote Modal */}
      <SaveQuoteModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        surfaceType={surface}
        floorArea={floorArea}
        wallArea={wallArea}
        items={quoteItems}
        subtotal={subtotal}
        vat={vat}
        total={total}
      />
    </div>
  )
}
