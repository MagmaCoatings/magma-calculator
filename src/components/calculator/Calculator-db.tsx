import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useColours } from '@/hooks/useProducts'
import { formatCurrency } from '@/lib/formatters'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check, Info, ChevronDown, ChevronUp } from 'lucide-react'

// Types
interface System {
  id: string
  name: string
  description: string | null
  surface_type: 'floor' | 'wall' | 'both'
  is_active: boolean
}

interface FinishPreset {
  id: string
  system_id: string
  name: string
  description: string | null
  is_default: boolean
  products: FinishPresetProduct[]
}

interface FinishPresetProduct {
  id: string
  product_id: string
  default_coats: number
  min_coats: number
  max_coats: number
  has_pigment: boolean
  coverage_sqm: number
  product: {
    id: string
    name: string
    pack_size: number
    pack_unit: string
    price: number
  }
}

interface SystemProduct {
  id: string
  product_id: string
  stage_id: string
  option_group: string | null
  is_default_option: boolean
  is_optional: boolean
  coverage_sqm: number
  coverage_note: string | null
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

interface LineItem {
  name: string
  qty: string
  units: number
  unitSize: string
  cost: number
}

interface CalculatorSelection {
  area: number
  wastagePercent: number
  systemId: string | null
  presetId: string | null
  presetCoats: { [productId: string]: number }
  optionSelections: { [optionGroup: string]: string } // product_id selected for each option_group
  optionalLayers: { [productId: string]: boolean } // toggle for optional layers
  sealerType: 'matt' | 'satin'
  colourId: string
  colourName: string
  colourHex: string
}

export function Calculator() {
  const { coloursByFamily, loading: coloursLoading } = useColours()
  const [systems, setSystems] = useState<System[]>([])
  const [presets, setPresets] = useState<FinishPreset[]>([])
  const [stageProducts, setStageProducts] = useState<SystemProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const [selection, setSelection] = useState<CalculatorSelection>({
    area: 20,
    wastagePercent: 10,
    systemId: null,
    presetId: null,
    presetCoats: {},
    optionSelections: {},
    optionalLayers: {},
    sealerType: 'matt',
    colourId: '',
    colourName: 'Natural',
    colourHex: '#E8E4DC',
  })

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
        // Auto-select first system
        handleSystemChange(data[0].id)
      }
      setLoading(false)
    }
    loadSystems()
  }, [])

  // Load presets and stage products when system changes
  async function handleSystemChange(systemId: string) {
    setSelection(prev => ({ ...prev, systemId, presetId: null, presetCoats: {}, optionSelections: {}, optionalLayers: {} }))
    
    // Fetch presets
    const { data: presetsData } = await supabase
      .from('finish_presets')
      .select('*')
      .eq('system_id', systemId)
      .eq('is_active', true)
      .order('display_order')

    if (presetsData) {
      // Fetch products for each preset
      const presetsWithProducts = await Promise.all(
        presetsData.map(async (preset) => {
          const { data: products } = await supabase
            .from('finish_preset_products')
            .select('*, product:products(*)')
            .eq('preset_id', preset.id)
            .order('display_order')
          return { ...preset, products: products || [] }
        })
      )
      setPresets(presetsWithProducts)
      
      // Auto-select default preset
      const defaultPreset = presetsWithProducts.find(p => p.is_default) || presetsWithProducts[0]
      if (defaultPreset) {
        handlePresetChange(defaultPreset)
      }
    }

    // Fetch stage products
    const { data: spData } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')

    if (spData) {
      setStageProducts(spData)
      
      // Set default selections for option groups
      const defaults: { [key: string]: string } = {}
      const optionalDefaults: { [key: string]: boolean } = {}
      
      spData.forEach(sp => {
        if (sp.option_group && sp.is_default_option) {
          defaults[sp.option_group] = sp.product_id
        }
        if (sp.is_optional) {
          optionalDefaults[sp.product_id] = false // optional layers off by default
        }
      })
      
      setSelection(prev => ({ 
        ...prev, 
        systemId,
        optionSelections: defaults,
        optionalLayers: optionalDefaults
      }))
    }
  }

  function handlePresetChange(preset: FinishPreset) {
    const coats: { [productId: string]: number } = {}
    preset.products.forEach(pp => {
      coats[pp.product_id] = pp.default_coats
    })
    setSelection(prev => ({ ...prev, presetId: preset.id, presetCoats: coats }))
  }

  function updateCoats(productId: string, coats: number) {
    setSelection(prev => ({
      ...prev,
      presetCoats: { ...prev.presetCoats, [productId]: coats }
    }))
  }

  function selectOption(optionGroup: string, productId: string) {
    setSelection(prev => ({
      ...prev,
      optionSelections: { ...prev.optionSelections, [optionGroup]: productId }
    }))
  }

  function toggleOptional(productId: string) {
    setSelection(prev => ({
      ...prev,
      optionalLayers: { ...prev.optionalLayers, [productId]: !prev.optionalLayers[productId] }
    }))
  }

  // Calculate results
  function calculate(): { items: LineItem[], subtotal: number } {
    const items: LineItem[] = []
    const area = selection.area * (1 + selection.wastagePercent / 100)
    
    if (!selection.presetId) return { items: [], subtotal: 0 }
    
    const selectedPreset = presets.find(p => p.id === selection.presetId)
    if (!selectedPreset) return { items: [], subtotal: 0 }

    // 1. Add stage products (DPM, Mesh, Base coat, Pore filler, Sealer)
    const groupedProducts: { [group: string]: SystemProduct[] } = {}
    const standaloneProducts: SystemProduct[] = []
    
    stageProducts.forEach(sp => {
      if (sp.option_group) {
        if (!groupedProducts[sp.option_group]) groupedProducts[sp.option_group] = []
        groupedProducts[sp.option_group].push(sp)
      } else {
        standaloneProducts.push(sp)
      }
    })

    // Add selected option from each group
    Object.entries(groupedProducts).forEach(([group, products]) => {
      const selectedId = selection.optionSelections[group]
      const selected = products.find(p => p.product_id === selectedId)
      if (selected && selected.product) {
        // Skip if it's optional and not enabled
        if (selected.is_optional && !selection.optionalLayers[selected.product_id]) {
          return
        }
        
        const coverage = selected.coverage_sqm || selected.product.pack_size
        const unitsNeeded = Math.ceil(area / coverage)
        items.push({
          name: selected.product.name,
          qty: `${area.toFixed(1)}m²`,
          units: unitsNeeded,
          unitSize: `${selected.product.pack_size}${selected.product.pack_unit}`,
          cost: unitsNeeded * selected.product.price,
        })
      }
    })

    // Add standalone products (non-optional or enabled optional)
    standaloneProducts.forEach(sp => {
      if (sp.is_optional && !selection.optionalLayers[sp.product_id]) {
        return
      }
      if (sp.product) {
        const coverage = sp.coverage_sqm || sp.product.pack_size
        const unitsNeeded = Math.ceil(area / coverage)
        items.push({
          name: sp.product.name,
          qty: `${area.toFixed(1)}m²`,
          units: unitsNeeded,
          unitSize: `${sp.product.pack_size}${sp.product.pack_unit}`,
          cost: unitsNeeded * sp.product.price,
        })
      }
    })

    // 2. Add preset products (microcement finish)
    let totalPigmentedKg = 0
    selectedPreset.products.forEach(pp => {
      if (pp.product) {
        const coats = selection.presetCoats[pp.product_id] || pp.default_coats
        const coverage = pp.coverage_sqm || 20
        const areaWithCoats = area * coats
        const unitsNeeded = Math.ceil(areaWithCoats / coverage)
        const kgNeeded = unitsNeeded * pp.product.pack_size

        items.push({
          name: pp.product.name,
          qty: `${area.toFixed(1)}m² × ${coats} coat${coats > 1 ? 's' : ''}`,
          units: unitsNeeded,
          unitSize: `${pp.product.pack_size}${pp.product.pack_unit}`,
          cost: unitsNeeded * pp.product.price,
        })

        if (pp.has_pigment) {
          totalPigmentedKg += kgNeeded
        }
      }
    })

    // 3. Add pigment pots (1 per 20kg of pigmented microcement)
    if (totalPigmentedKg > 0) {
      const pigmentPots = Math.ceil(totalPigmentedKg / 20)
      // Find pigment product
      const pigmentProduct = stageProducts.find(sp => sp.product?.name?.includes('Pigment'))?.product
      if (pigmentProduct) {
        items.push({
          name: `Pigment - ${selection.colourName}`,
          qty: `${pigmentPots} pot${pigmentPots > 1 ? 's' : ''} (1 per 20kg)`,
          units: pigmentPots,
          unitSize: 'pot',
          cost: pigmentPots * pigmentProduct.price,
        })
      }
    }

    // 4. Add sealer
    const sealerGroup = groupedProducts['sealer']
    if (sealerGroup) {
      const selectedSealer = sealerGroup.find(sp => 
        sp.product?.name?.toLowerCase().includes(selection.sealerType)
      )
      if (selectedSealer?.product) {
        const sealerCoverage = 30 // 5kg covers 30m² for 2 coats
        const unitsNeeded = Math.ceil(area / sealerCoverage)
        items.push({
          name: selectedSealer.product.name,
          qty: `${area.toFixed(1)}m² (2 coats)`,
          units: unitsNeeded,
          unitSize: `${selectedSealer.product.pack_size}${selectedSealer.product.pack_unit}`,
          cost: unitsNeeded * selectedSealer.product.price,
        })
      }
    }

    const subtotal = items.reduce((sum, item) => sum + item.cost, 0)
    return { items, subtotal }
  }

  const { items, subtotal } = calculate()
  const vat = subtotal * 0.2
  const total = subtotal + vat
  const costPerM2 = selection.area > 0 ? subtotal / selection.area : 0

  const selectedPreset = presets.find(p => p.id === selection.presetId)
  const selectedSystem = systems.find(s => s.id === selection.systemId)

  // Copy list
  const copyList = () => {
    let text = `MAGMA CALCULATOR - ${selectedSystem?.name || 'Quote'}\n`
    text += '================================\n\n'
    
    items.forEach(item => {
      text += `${item.units}× ${item.name} (${item.unitSize}) - £${formatCurrency(item.cost)}\n`
    })

    text += `\nSubtotal: £${formatCurrency(subtotal)}`
    text += `\nVAT: £${formatCurrency(vat)}`
    text += `\nTOTAL: £${formatCurrency(total)}`
    text += `\n\nCost per m² (ex VAT): £${formatCurrency(costPerM2)}`
    text += `\n\n* Includes ${selection.wastagePercent}% wastage allowance`

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

  // Group stage products by stage
  const stageGroups: { [stageName: string]: SystemProduct[] } = {}
  stageProducts.forEach(sp => {
    const stageName = sp.stage?.name || 'Other'
    if (!stageGroups[stageName]) stageGroups[stageName] = []
    stageGroups[stageName].push(sp)
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr,380px] gap-6">
      {/* Configuration Panel */}
      <div className="space-y-4">
        {/* System selector */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">System</h2>
          <div className="flex flex-wrap gap-2">
            {systems.map(system => (
              <button
                key={system.id}
                className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  selection.systemId === system.id
                    ? 'border-magma bg-magma text-white'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
                onClick={() => handleSystemChange(system.id)}
              >
                {system.name}
              </button>
            ))}
          </div>
        </Card>

        {/* Area input */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Area</h2>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={selection.area}
                onChange={e => setSelection(prev => ({ ...prev, area: parseFloat(e.target.value) || 1 }))}
                min={1}
                max={500}
                className="w-24 h-10 px-3 rounded-lg border border-gray-200 text-sm font-medium"
              />
              <span className="text-sm text-gray-500">m²</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Wastage:</span>
              <input
                type="number"
                value={selection.wastagePercent}
                onChange={e => setSelection(prev => ({ ...prev, wastagePercent: parseFloat(e.target.value) || 0 }))}
                min={0}
                max={50}
                className="w-16 h-10 px-3 rounded-lg border border-gray-200 text-sm"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </Card>

        {/* Finish preset selector */}
        {presets.length > 0 && (
          <Card className="p-4">
            <h2 className="text-sm font-medium text-gray-500 mb-3">Microcement finish</h2>
            <div className="space-y-3">
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    selection.presetId === preset.id
                      ? 'border-magma bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handlePresetChange(preset)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{preset.name}</span>
                    {preset.is_default && (
                      <span className="text-xs text-magma">Recommended</span>
                    )}
                  </div>
                  {preset.description && (
                    <p className="text-sm text-gray-500 mb-3">{preset.description}</p>
                  )}
                  
                  {/* Show products in preset */}
                  <div className="flex flex-wrap gap-2">
                    {preset.products.map((pp, idx) => (
                      <div key={pp.id} className="flex items-center gap-1">
                        {idx > 0 && <span className="text-gray-300 mr-1">→</span>}
                        <span className={`px-2 py-1 rounded text-sm ${
                          pp.has_pigment ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {pp.product?.name?.replace('Magma ', '')}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Coat adjustments when selected */}
                  {selection.presetId === preset.id && (
                    <div className="mt-4 pt-4 border-t border-orange-200 space-y-3">
                      {preset.products.map(pp => (
                        <div key={pp.id} className="flex items-center justify-between">
                          <span className="text-sm text-gray-700">
                            {pp.product?.name?.replace('Magma ', '')} coats:
                          </span>
                          <div className="flex gap-1">
                            {Array.from({ length: pp.max_coats - pp.min_coats + 1 }, (_, i) => pp.min_coats + i).map(n => (
                              <button
                                key={n}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                                  (selection.presetCoats[pp.product_id] || pp.default_coats) === n
                                    ? 'bg-charcoal text-white'
                                    : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                                onClick={(e) => { e.stopPropagation(); updateCoats(pp.product_id, n) }}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Stage options */}
        {Object.entries(stageGroups)
          .filter(([name]) => name !== 'Microcement' && name !== 'Pigments' && name !== 'Sealers')
          .map(([stageName, products]) => {
            // Group by option_group
            const groups: { [key: string]: SystemProduct[] } = {}
            const standalone: SystemProduct[] = []
            
            products.forEach(sp => {
              if (sp.option_group) {
                if (!groups[sp.option_group]) groups[sp.option_group] = []
                groups[sp.option_group].push(sp)
              } else {
                standalone.push(sp)
              }
            })

            const hasContent = Object.keys(groups).length > 0 || standalone.length > 0

            if (!hasContent) return null

            return (
              <Card key={stageName} className="p-4">
                <h2 className="text-sm font-medium text-gray-500 mb-3">{stageName}</h2>
                
                {/* Option groups */}
                {Object.entries(groups).map(([groupName, groupProducts]) => {
                  const isOptional = groupProducts.some(p => p.is_optional)
                  const anySelected = groupProducts.some(p => selection.optionSelections[groupName] === p.product_id)
                  
                  return (
                    <div key={groupName} className="mb-3">
                      {isOptional && (
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-500 capitalize">
                            {groupName.replace('_', ' ')} (optional)
                          </span>
                          <button
                            className={`w-10 h-5 rounded-full transition-colors ${
                              selection.optionalLayers[groupProducts[0]?.product_id]
                                ? 'bg-magma'
                                : 'bg-gray-300'
                            }`}
                            onClick={() => toggleOptional(groupProducts[0]?.product_id)}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                              selection.optionalLayers[groupProducts[0]?.product_id] ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                      )}
                      
                      {(!isOptional || selection.optionalLayers[groupProducts[0]?.product_id]) && (
                        <div className="flex flex-wrap gap-2">
                          {groupProducts.map(sp => (
                            <button
                              key={sp.id}
                              className={`px-3 py-2 rounded-lg text-sm transition-all ${
                                selection.optionSelections[groupName] === sp.product_id
                                  ? 'bg-charcoal text-white'
                                  : 'bg-gray-100 hover:bg-gray-200'
                              }`}
                              onClick={() => selectOption(groupName, sp.product_id)}
                            >
                              {sp.product?.name
                                ?.replace('DPM Epoxy Primer ', '')
                                .replace('Fibreglass ', '')
                                .replace('PU Seal ', '')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Standalone products */}
                {standalone.map(sp => (
                  <div key={sp.id} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{sp.product?.name}</span>
                    {sp.is_optional && (
                      <button
                        className={`w-10 h-5 rounded-full transition-colors ${
                          selection.optionalLayers[sp.product_id]
                            ? 'bg-magma'
                            : 'bg-gray-300'
                        }`}
                        onClick={() => toggleOptional(sp.product_id)}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${
                          selection.optionalLayers[sp.product_id] ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                    )}
                  </div>
                ))}
              </Card>
            )
          })}

        {/* Sealer */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Sealer</h2>
          <div className="flex gap-2">
            <button
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                selection.sealerType === 'matt'
                  ? 'bg-charcoal text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setSelection(prev => ({ ...prev, sealerType: 'matt' }))}
            >
              Matt
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm transition-all ${
                selection.sealerType === 'satin'
                  ? 'bg-charcoal text-white'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              onClick={() => setSelection(prev => ({ ...prev, sealerType: 'satin' }))}
            >
              Satin
            </button>
          </div>
        </Card>

        {/* Colour picker */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Pigment colour</h2>
          <div className="space-y-3">
            {coloursByFamily.map(({ family, shades }) => (
              <div key={family.id}>
                <p className="text-xs text-gray-400 mb-2">{family.name}</p>
                <div className="flex flex-wrap gap-2">
                  {shades.map(swatch => (
                    <button
                      key={swatch.id}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        selection.colourName === swatch.name
                          ? 'border-charcoal scale-110'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: swatch.hex_code }}
                      onClick={() => setSelection(prev => ({
                        ...prev,
                        colourId: swatch.id,
                        colourName: swatch.name,
                        colourHex: swatch.hex_code,
                      }))}
                      title={swatch.name}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Selected: <span className="font-medium">{selection.colourName}</span>
          </p>
        </Card>
      </div>

      {/* Results Panel */}
      <div className="lg:sticky lg:top-6 space-y-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Materials list</h2>
            <button
              onClick={copyList}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-magma transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-8">
              Select a system and preset to see materials
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-4">
                {items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.qty}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">£{formatCurrency(item.cost)}</p>
                      <p className="text-xs text-gray-500">{item.units} × {item.unitSize}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">£{formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (20%)</span>
                  <span className="font-medium">£{formatCurrency(vat)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
                  <span>Total</span>
                  <span className="text-magma">£{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost per m² (ex VAT)</span>
                  <span className="font-medium">£{formatCurrency(costPerM2)}</span>
                </div>
              </div>

              <p className="text-xs text-gray-400 mt-4">
                * Includes {selection.wastagePercent}% wastage allowance
              </p>
            </>
          )}
        </Card>

        <Button className="w-full" size="lg">
          Save Quote
        </Button>
      </div>
    </div>
  )
}
