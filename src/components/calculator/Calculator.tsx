import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useColours } from '@/hooks/useProducts'
import { formatCurrency } from '@/lib/formatters'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

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
  coverage_note: string | null
  display_order: number
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
  const [systems, setSystems] = useState<System[]>([])
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Main state
  const [surface, setSurface] = useState<'floor' | 'wall' | 'both'>('floor')
  const [floorArea, setFloorArea] = useState(20)
  const [wallArea, setWallArea] = useState(10)
  const [wastagePercent, setWastagePercent] = useState(10)
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null)
  const [sealerType, setSealerType] = useState<'matt' | 'satin'>('matt')
  const [selectedColour, setSelectedColour] = useState({ name: 'Natural', hex: '#E8E4DC' })

  // Layer states - keyed by stage name or option_group
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
        // Auto-select first floor system
        const floorSystem = data.find(s => s.surface_type === 'floor' || s.name.toLowerCase().includes('floor'))
        if (floorSystem) {
          handleSystemChange(floorSystem.id)
        }
      }
      setLoading(false)
    }
    loadSystems()
  }, [])

  // Auto-select appropriate system when surface type changes
  useEffect(() => {
    if (systems.length === 0) return
    
    let targetSystem: System | undefined
    
    if (surface === 'floor') {
      targetSystem = systems.find(s => s.surface_type === 'floor') 
        || systems.find(s => s.name.toLowerCase().includes('floor'))
    } else if (surface === 'wall') {
      targetSystem = systems.find(s => s.surface_type === 'wall')
        || systems.find(s => s.name.toLowerCase().includes('wall'))
    } else {
      // For 'both', default to floor system
      targetSystem = systems.find(s => s.surface_type === 'floor')
        || systems.find(s => s.name.toLowerCase().includes('floor'))
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

  // Load system products when system changes
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
      const newLayerStates: { [key: string]: LayerState } = {}
      
      data.forEach(sp => {
        const key = sp.option_group || `standalone_${sp.product_id}`
        const isStandalone = !sp.option_group
        
        if (!newLayerStates[key]) {
          newLayerStates[key] = {
            // Optional layers start disabled UNLESS is_default_option is true
            enabled: !sp.is_optional || sp.is_default_option,
            // For standalone products, always select them. For groups, select the default.
            selectedProductId: isStandalone ? sp.product_id : (sp.is_default_option ? sp.product_id : null),
            coats: sp.default_coats || sp.min_coats || 1,
            // Use pigment_default_on if available, otherwise fall back to has_pigment
            pigment: sp.has_pigment ? (sp.pigment_default_on !== false) : false,
          }
        } else if (sp.is_default_option) {
          newLayerStates[key].selectedProductId = sp.product_id
          // Update coats to the default product's default_coats
          newLayerStates[key].coats = sp.default_coats || sp.min_coats || 1
          // Update pigment default from the selected default product
          newLayerStates[key].pigment = sp.has_pigment ? (sp.pigment_default_on !== false) : false
          // If this is the default option for an optional layer, enable it
          if (sp.is_optional) {
            newLayerStates[key].enabled = true
          }
        }
      })
      
      setLayerStates(newLayerStates)
    }
  }

  function updateLayer(key: string, updates: Partial<LayerState>) {
    setLayerStates(prev => ({
      ...prev,
      [key]: { ...prev[key], ...updates }
    }))
  }

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
  function getLayersByStage() {
    const stages: { [stageName: string]: { stageOrder: number; layers: { key: string; products: SystemProduct[]; isOptional: boolean }[] } } = {}
    
    systemProducts.forEach(sp => {
      const stageName = sp.stage?.name || 'Other'
      const stageOrder = sp.stage?.display_order || 99
      
      if (!stages[stageName]) {
        stages[stageName] = { stageOrder, layers: [] }
      }
      
      const key = sp.option_group || `standalone_${sp.product_id}`
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
    const area = (surface === 'floor' ? floorArea : surface === 'wall' ? wallArea : floorArea + wallArea) * (1 + wastagePercent / 100)
    let totalPigmentedKg = 0

    Object.entries(layerStates).forEach(([key, state]) => {
      if (!state.enabled) return
      if (!state.selectedProductId) return

      const sp = systemProducts.find(p => p.product_id === state.selectedProductId)
      if (!sp || !sp.product) return

      const coats = state.coats || 1
      const coverage = sp.coverage_sqm || sp.product.pack_size
      const areaWithCoats = area * coats
      const unitsNeeded = Math.ceil(areaWithCoats / coverage)

      items.push({
        name: sp.product.name,
        qty: coats > 1 ? `${area.toFixed(1)}m² × ${coats} coats` : `${area.toFixed(1)}m²`,
        units: unitsNeeded,
        unitSize: `${sp.product.pack_size}${sp.product.pack_unit}`,
        cost: unitsNeeded * sp.product.price,
      })

      if (state.pigment && sp.has_pigment) {
        totalPigmentedKg += unitsNeeded * sp.product.pack_size
      }
    })

    // Add pigment pots (1 per 20kg)
    if (totalPigmentedKg > 0) {
      const pigmentPots = Math.ceil(totalPigmentedKg / 20)
      const pigmentProduct = systemProducts.find(sp => sp.product?.name?.includes('Pigment'))?.product
      if (pigmentProduct) {
        items.push({
          name: `Pigment - ${selectedColour.name}`,
          qty: `${pigmentPots} pot${pigmentPots > 1 ? 's' : ''}`,
          units: pigmentPots,
          unitSize: 'pot',
          cost: pigmentPots * pigmentProduct.price,
        })
      }
    }

    // Add sealer
    const sealerProduct = systemProducts.find(sp => 
      sp.product?.name?.toLowerCase().includes('seal') && 
      sp.product?.name?.toLowerCase().includes(sealerType)
    )?.product
    
    if (sealerProduct) {
      const sealerCoverage = 30 // 5kg covers 30m² for 2 coats
      const sealerUnits = Math.ceil(area / sealerCoverage)
      items.push({
        name: sealerProduct.name,
        qty: `${area.toFixed(1)}m² (2 coats)`,
        units: sealerUnits,
        unitSize: `${sealerProduct.pack_size}${sealerProduct.pack_unit}`,
        cost: sealerUnits * sealerProduct.price,
      })
    }

    const subtotal = items.reduce((sum, item) => sum + item.cost, 0)
    return { items, subtotal }
  }

  const { items, subtotal } = calculate()
  const vat = subtotal * 0.2
  const total = subtotal + vat
  const totalArea = surface === 'floor' ? floorArea : surface === 'wall' ? wallArea : floorArea + wallArea
  const costPerM2 = totalArea > 0 ? subtotal / totalArea : 0

  const selectedSystem = systems.find(s => s.id === selectedSystemId)
  const stageGroups = getLayersByStage()

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

  if (loading || coloursLoading) {
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

      <div className="grid lg:grid-cols-[1fr,340px] gap-6">
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

          {/* Build type / System */}
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

          {/* Layer cards */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-4">Layers</p>
            <div className="space-y-3">
              {stageGroups.map(([stageName, { layers }]) => (
                layers.map(layer => {
                  const state = layerStates[layer.key] || { enabled: false, selectedProductId: null, coats: 1, pigment: false }
                  const hasMultipleProducts = layer.products.length > 1
                  // For standalone products, always use the first product even if selectedProductId doesn't match
                  const selectedProduct = hasMultipleProducts 
                    ? layer.products.find(p => p.product_id === state.selectedProductId)
                    : layer.products[0]
                  // Only show coat buttons if there's a choice (min < max)
                  const hasCoatOptions = selectedProduct && 
                    (selectedProduct.min_coats || 1) < (selectedProduct.max_coats || 1)
                  const hasPigmentOption = selectedProduct?.has_pigment
                  // Show full card if enabled, or if it has special options (pigment/coats)
                  const showFullCard = state.enabled || !layer.isOptional || hasCoatOptions || hasPigmentOption
                  // Fixed coats (when min = max and > 1)
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

                      {/* Product choices */}
                      {showFullCard && hasMultipleProducts && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {layer.products.map(sp => (
                            <button
                              key={sp.product_id}
                              onClick={() => selectProduct(layer.key, sp.product_id)}
                              disabled={layer.isOptional && !state.enabled}
                              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                state.selectedProductId === sp.product_id
                                  ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                                  : 'bg-white border border-gray-200 hover:border-gray-300'
                              } ${layer.isOptional && !state.enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              {sp.product?.name
                                ?.replace('DPM Epoxy Primer ', '')
                                .replace('Fibreglass ', '')
                                .replace('PU Seal ', '')
                                .replace('Magma ', '')}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Coats and pigment */}
                      {showFullCard && (hasCoatOptions || hasPigmentOption || fixedCoats) && (
                        <div className={`flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-gray-200 ${
                          layer.isOptional && !state.enabled ? 'opacity-50' : ''
                        }`}>
                          {hasCoatOptions && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 font-medium">Coats:</span>
                              {Array.from({ length: (selectedProduct?.max_coats || 2) - (selectedProduct?.min_coats || 1) + 1 }, (_, i) => (selectedProduct?.min_coats || 1) + i).map(n => (
                                <button
                                  key={n}
                                  onClick={() => setCoats(layer.key, n)}
                                  disabled={layer.isOptional && !state.enabled}
                                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                                    state.coats === n
                                      ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                                      : 'bg-white border border-gray-200'
                                  } ${layer.isOptional && !state.enabled ? 'cursor-not-allowed' : ''}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                          {fixedCoats && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500 font-medium">Coats:</span>
                              <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-semibold text-gray-700">
                                {fixedCoats}
                              </span>
                            </div>
                          )}
                          {hasPigmentOption && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Add pigment:</span>
                              <button
                                onClick={() => !layer.isOptional || state.enabled ? togglePigment(layer.key) : null}
                                className={`w-10 h-5 rounded-full transition-colors relative ${
                                  state.pigment ? 'bg-green-500' : 'bg-gray-300'
                                } ${layer.isOptional && !state.enabled ? 'cursor-not-allowed' : ''}`}
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
                  )
                })
              ))}
            </div>
          </div>

          {/* Sealer */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-3">Sealer</p>
            <div className="flex gap-2">
              <button
                onClick={() => setSealerType('matt')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                  sealerType === 'matt'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                    : 'bg-white border border-gray-200 hover:border-gray-300'
                }`}
              >
                Matt
              </button>
              <button
                onClick={() => setSealerType('satin')}
                className={`flex-1 py-3 px-4 rounded-lg font-medium text-sm transition-all ${
                  sealerType === 'satin'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 border'
                    : 'bg-white border border-gray-200 hover:border-gray-300'
                }`}
              >
                Satin
              </button>
            </div>
          </div>

          {/* Colour picker */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-sm text-gray-500 mb-3">Pigment colour</p>
            <div className="space-y-3">
              {coloursByFamily.map(({ family, shades }) => (
                <div key={family.id}>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">{family.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {shades.map(swatch => (
                      <button
                        key={swatch.id}
                        onClick={() => setSelectedColour({ name: swatch.name, hex: swatch.hex_code })}
                        className={`w-8 h-8 rounded-lg border-2 transition-all ${
                          selectedColour.name === swatch.name
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
            <div className="flex items-center gap-3 mt-4 p-3 bg-gray-50 rounded-lg">
              <div 
                className="w-8 h-8 rounded-lg border border-gray-200"
                style={{ backgroundColor: selectedColour.hex }}
              />
              <span className="font-medium">{selectedColour.name}</span>
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

          <Button className="w-full mt-4" size="lg">
            Save Quote
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-8">© Magma Coatings Ltd</p>
    </div>
  )
}
