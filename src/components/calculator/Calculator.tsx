import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useColours } from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/ui/InfoTip'
import { Copy, Check, ChevronUp } from 'lucide-react'
import { SaveQuoteModal } from '@/components/SaveQuoteModal'
import { MagmaSpinner } from '@/components/brand/MagmaMark'

// Types
interface System {
  id: string
  name: string
  description: string | null
  surface_type: 'floor' | 'wall' | 'both'
  family: string | null
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
  shared_across_surfaces: boolean
  surface_type?: 'floor' | 'wall'  // Added for "both" mode
  product: {
    id: string
    name: string
    description: string | null
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
  const { profile } = useAuth()
  const showTooltips = profile?.show_tooltips ?? true
  const [systems, setSystems] = useState<System[]>([])
  const [families, setFamilies] = useState<string[]>([])
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null)
  const [systemProducts, setSystemProducts] = useState<SystemProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [settingsApplied, setSettingsApplied] = useState(false)

  // Main state
  const [surface, setSurface] = useState<'floor' | 'wall' | 'both'>('floor')
  const [floorArea, setFloorArea] = useState<number | ''>(20)
  const [wallArea, setWallArea] = useState<number | ''>(10)
  const [wastagePercent, setWastagePercent] = useState<number | ''>(10)
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
  async function loadSystems() {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error: queryError } = await supabase
        .from('systems')
        .select('*')
        .eq('is_active', true)
        .order('display_order')
      
      if (queryError) {
        setError('Failed to load systems. Please check your connection and try again.')
        return
      }
      
      if (!data || data.length === 0) {
        setError('No systems configured. Please contact an administrator.')
        return
      }
      
      setSystems(data)
      
      // Extract unique families
      const uniqueFamilies = [...new Set(data.map(s => s.family).filter(Boolean))] as string[]
      setFamilies(uniqueFamilies)
      
      // Auto-select first family if there are multiple
      const initialFamily = uniqueFamilies.length > 0 ? uniqueFamilies[0] : null
      setSelectedFamily(initialFamily)
      
      // Filter by initial family
      const familySystems = initialFamily 
        ? data.filter(s => s.family === initialFamily)
        : data
      
      // Auto-select first floor and wall systems from filtered list
      const floorSystem = familySystems.find(s => s.surface_type === 'floor')
      const wallSystem = familySystems.find(s => s.surface_type === 'wall')
      if (floorSystem) {
        setFloorSystemId(floorSystem.id)
        handleSystemChange(floorSystem.id)
      }
      if (wallSystem) {
        setWallSystemId(wallSystem.id)
      }
    } catch {
      setError('Failed to load systems. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
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

  // Auto-refresh product data when window regains focus (picks up admin changes)
  // This updates prices/names but preserves user's layer selections
  useEffect(() => {
    async function onFocus() {
      const query = (systemId: string) => supabase
        .from('system_products')
        .select('*, product:products(*), stage:stages(*)')
        .eq('system_id', systemId)
        .order('display_order')
      
      if (surface === 'both') {
        // Refresh both floor and wall products
        if (floorSystemId) {
          const { data } = await query(floorSystemId)
          if (data) setFloorProducts(data)
        }
        if (wallSystemId) {
          const { data } = await query(wallSystemId)
          if (data) setWallProducts(data)
        }
      } else if (selectedSystemId) {
        // Single surface mode
        const { data } = await query(selectedSystemId)
        if (data) setSystemProducts(data)
      }
      // Note: NOT calling initLayerStates - preserves user selections
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [surface, selectedSystemId, floorSystemId, wallSystemId])

  // Load system products when system changes (for single surface mode)
  async function handleSystemChange(systemId: string) {
    setSelectedSystemId(systemId)
    
    try {
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
    } catch {
      // Silently fail - products will be empty, user can retry via system selection
      console.error('Failed to load system products')
    }
  }

  // Handle family change - reset system selections
  function handleFamilyChange(family: string) {
    setSelectedFamily(family)
    
    // Clear current selections
    setSelectedSystemId(null)
    setFloorSystemId(null)
    setWallSystemId(null)
    setSystemProducts([])
    setFloorProducts([])
    setWallProducts([])
    setLayerStates({})
    
    // Auto-select first systems from the new family
    const familySystems = systems.filter(s => s.family === family)
    const floorSystem = familySystems.find(s => s.surface_type === 'floor')
    const wallSystem = familySystems.find(s => s.surface_type === 'wall')
    
    if (floorSystem) {
      setFloorSystemId(floorSystem.id)
      if (surface === 'floor' || surface === 'both') {
        handleSystemChange(floorSystem.id)
      }
    }
    if (wallSystem) {
      setWallSystemId(wallSystem.id)
      if (surface === 'both') {
        loadSurfaceProducts(wallSystem.id, 'wall')
      }
    }
  }

  // Load products for a specific surface in "both" mode
  async function loadSurfaceProducts(systemId: string, surfaceType: 'floor' | 'wall') {
    try {
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
    } catch {
      // Silently fail - products will be empty, user can retry via system selection
      console.error('Failed to load surface products')
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
    const items: { name: string; qty: string; units: number; unitSize: string; cost: number; stageOrder: number; productOrder: number; surfaceType: number }[] = []
    const floorAreaNum = floorArea === '' ? 0 : floorArea
    const wallAreaNum = wallArea === '' ? 0 : wallArea
    const wastageNum = wastagePercent === '' ? 0 : wastagePercent
    const floorAreaWithWastage = floorAreaNum * (1 + wastageNum / 100)
    const wallAreaWithWastage = wallAreaNum * (1 + wastageNum / 100)
    const combinedAreaWithWastage = floorAreaWithWastage + wallAreaWithWastage
    let totalPigmentPacks = 0
    
    // Track shared products already processed (by product_id)
    const processedSharedProducts = new Set<string>()

    // Helper to process products for a surface
    function processProducts(
      products: SystemProduct[], 
      prefix: string, 
      area: number, 
      surfaceLabel: string,
      skipShared: boolean = false,
      isSharedPass: boolean = false
    ) {
      Object.entries(layerStates).forEach(([key, state]) => {
        if (!key.startsWith(prefix) && prefix !== '') return
        if (!state.enabled) return
        if (!state.selectedProductId) return

        const sp = products.find(p => p.product_id === state.selectedProductId)
        if (!sp || !sp.product) return
        
        // Handle shared products
        if (skipShared && sp.shared_across_surfaces) return
        if (isSharedPass && !sp.shared_across_surfaces) return
        
        // Skip if this shared product was already processed
        if (sp.shared_across_surfaces && processedSharedProducts.has(sp.product_id)) return
        if (sp.shared_across_surfaces) processedSharedProducts.add(sp.product_id)
        
        if (sp.product.name?.toLowerCase().includes('pigment')) return

        const coats = state.coats || 1
        const coverage = sp.coverage_sqm || sp.product.pack_size
        const areaWithCoats = area * coats
        const unitsNeeded = Math.ceil(areaWithCoats / coverage)

        // Shared products don't get F/W prefix, but get a badge
        const isSharedInBothMode = surface === 'both' && sp.shared_across_surfaces
        const displayName = (surface === 'both' && !sp.shared_across_surfaces) 
          ? `${surfaceLabel}${sp.product.name}` 
          : sp.product.name

        // For shared products in both mode, make it very clear it covers both areas
        let qtyDisplay: string
        if (isSharedInBothMode) {
          qtyDisplay = coats > 1 
            ? `${area.toFixed(1)}m² total (floor + wall combined) × ${coats} coats` 
            : `${area.toFixed(1)}m² total (floor + wall combined)`
        } else {
          qtyDisplay = coats > 1 
            ? `${area.toFixed(1)}m² × ${coats} coats` 
            : `${area.toFixed(1)}m²`
        }

        items.push({
          name: isSharedInBothMode ? `${displayName} ✦` : displayName,
          qty: qtyDisplay,
          units: unitsNeeded,
          unitSize: `${sp.product.pack_size}${sp.product.pack_unit}`,
          cost: unitsNeeded * sp.product.price,
          stageOrder: sp.stage?.display_order || 0,
          productOrder: sp.display_order || 0,
          surfaceType: isSharedPass ? 0 : (prefix === 'floor_' ? 1 : 2), // 0=shared, 1=floor, 2=wall
        })

        if (state.pigment && sp.has_pigment) {
          totalPigmentPacks += unitsNeeded
        }
      })
    }

    if (surface === 'both') {
      // First pass: process shared products from both systems using combined area
      processProducts(floorProducts, 'floor_', combinedAreaWithWastage, '', false, true)
      processProducts(wallProducts, 'wall_', combinedAreaWithWastage, '', false, true)
      
      // Second pass: process non-shared products with their respective areas
      processProducts(floorProducts, 'floor_', floorAreaWithWastage, '(F) ', true, false)
      processProducts(wallProducts, 'wall_', wallAreaWithWastage, '(W) ', true, false)
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
        stageOrder: 999, // Pigment goes last
        productOrder: 0,
        surfaceType: 3, // After everything
      })
    }

    // Sort items by stage order, then floor before wall, then product order
    items.sort((a, b) => {
      if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder
      if (a.surfaceType !== b.surfaceType) return a.surfaceType - b.surfaceType
      return a.productOrder - b.productOrder
    })

    // Consolidate matching products (combine F + W into single line)
    const productMap = new Map<string, typeof items[0]>()
    
    for (const item of items) {
      // Extract base product name (remove F/W prefix)
      const baseName = item.name.replace(/^\(F\)\s*/, '').replace(/^\(W\)\s*/, '').replace(/\s*✦$/, '')
      const isFloor = item.name.startsWith('(F)')
      const isWall = item.name.startsWith('(W)')
      const isShared = item.name.includes('✦')
      
      const existing = productMap.get(baseName)
      if (existing && !isShared) {
        // Combine quantities
        existing.units += item.units
        existing.cost += item.cost
        // Update name to show F+W if combining
        const existingIsFloor = existing.name.startsWith('(F)')
        const existingIsWall = existing.name.startsWith('(W)')
        if ((existingIsFloor && isWall) || (existingIsWall && isFloor)) {
          existing.name = `(F+W) ${baseName}`
        }
        // Keep the better qty display (just units)
        existing.qty = `${existing.units} units`
      } else {
        productMap.set(baseName, { ...item })
      }
    }
    
    // Convert map back to sorted array (maintain stage order)
    const sortedItems = Array.from(productMap.values()).sort((a, b) => {
      if (a.stageOrder !== b.stageOrder) return a.stageOrder - b.stageOrder
      return a.productOrder - b.productOrder
    })

    const subtotal = sortedItems.reduce((sum, item) => sum + item.cost, 0)
    return { items: sortedItems, subtotal }
  }

  const { items, subtotal } = calculate()
  const vat = subtotal * settings.vat_rate
  const total = subtotal + vat
  const floorAreaNum = floorArea === '' ? 0 : floorArea
  const wallAreaNum = wallArea === '' ? 0 : wallArea
  const totalArea = surface === 'floor' ? floorAreaNum : surface === 'wall' ? wallAreaNum : floorAreaNum + wallAreaNum
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
      <div key={layer.key} className={`bg-bone border border-line rounded-xl p-5 ${
        layer.isOptional && !state.enabled ? 'opacity-60' : ''
      }`}>
        {/* Layer header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-basalt flex items-center gap-1.5">
              {hasMultipleProducts 
                ? stageName 
                : selectedProduct?.product?.name || layer.products[0]?.product?.name || stageName}
              {showTooltips && !hasMultipleProducts && selectedProduct?.product?.description && (
                <InfoTip content={selectedProduct.product.description} />
              )}
            </p>
            {selectedProduct?.coverage_note && (
              <p className="text-xs text-stone mt-0.5">{selectedProduct.coverage_note}</p>
            )}
          </div>
          {layer.isOptional && (
            <button
              onClick={() => toggleLayer(layer.key)}
              className={`w-12 h-6 rounded-full transition-colors relative ${
                state.enabled ? 'bg-sage' : 'bg-ash'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-bone shadow absolute top-0.5 transition-transform ${
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
                  <div key={sp.product_id} className="flex items-center gap-1">
                    <button
                      onClick={() => selectProduct(layer.key, sp.product_id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        state.selectedProductId === sp.product_id
                          ? 'bg-basalt text-bone border-2 border-basalt font-medium'
                          : 'bg-bone border border-line text-ink hover:border-stone'
                      }`}
                    >
                      {sp.product?.name?.replace('Magma ', '').replace(' Microcement', '') || 'Product'}
                    </button>
                    {showTooltips && sp.product?.description && (
                      <InfoTip content={sp.product.description} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Coats and pigment */}
            {(hasCoatOptions || hasPigmentOption || fixedCoats) && (
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-line">
                {/* Coat selector */}
                {hasCoatOptions && selectedProduct && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone">Coats:</span>
                    <div className="flex gap-1">
                      {Array.from(
                        { length: (selectedProduct.max_coats || 1) - (selectedProduct.min_coats || 1) + 1 },
                        (_, i) => (selectedProduct.min_coats || 1) + i
                      ).map(num => (
                        <button
                          key={num}
                          onClick={() => setCoats(layer.key, num)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium min-h-[44px] min-w-[44px] ${
                            state.coats === num
                              ? 'bg-basalt text-bone border-2 border-basalt font-medium'
                              : 'bg-bone border border-line text-ink hover:border-stone'
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
                    <span className="text-xs text-stone">Coats:</span>
                    <span className="px-2 py-1 bg-line-soft rounded text-sm font-medium">{fixedCoats}</span>
                  </div>
                )}
                {/* Pigment toggle */}
                {hasPigmentOption && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone">Add pigment:</span>
                    <button
                      onClick={() => !layer.isOptional || state.enabled ? togglePigment(layer.key) : null}
                      className={`w-10 h-5 rounded-full transition-colors relative ${
                        state.pigment ? 'bg-sage' : 'bg-ash'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-bone shadow absolute top-0.5 transition-transform ${
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
    text += `\n\nPallet / Delivery Costs: TBC - quoted at time of order`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || coloursLoading || settingsLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <MagmaSpinner size={48} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-bone border border-danger/20 rounded-xl p-6 text-center">
          <div className="w-12 h-12 bg-danger-tint rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-basalt mb-2">Something went wrong</h2>
          <p className="text-stone text-sm mb-4">{error}</p>
          <button
            onClick={() => loadSystems()}
            className="px-4 py-2 bg-molten text-white rounded-lg font-medium hover:bg-molten-ink transition-colors min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Filter systems by surface type and family
  const availableSystems = systems.filter(s => {
    // First filter by family
    if (selectedFamily && s.family !== selectedFamily) return false
    // Then filter by surface type
    if (surface === 'floor') return s.surface_type === 'floor' || s.name.toLowerCase().includes('floor')
    if (surface === 'wall') return s.surface_type === 'wall' || s.name.toLowerCase().includes('wall')
    return true
  })

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 pb-52 lg:pb-6">
      {/* Family selector - only show if there are multiple families */}
      {families.length > 1 && (
        <div className="flex justify-center gap-2 mb-8">
          {families.map(family => (
            <button
              key={family}
              onClick={() => handleFamilyChange(family)}
              className={`px-6 py-2.5 rounded-full font-medium text-sm transition-all min-h-[44px] ${
                selectedFamily === family
                  ? 'bg-basalt text-bone'
                  : 'bg-bone border border-line text-ink hover:border-stone'
              }`}
            >
              {family}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_340px] gap-8">
        {/* Configuration */}
        <div className="space-y-5">
          {/* Surface type */}
          <div className="bg-bone border border-line rounded-xl p-5">
            <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3">Surface type</p>
            <div className="bg-track rounded-lg p-1 flex gap-1">
              {(['floor', 'wall', 'both'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSurface(s)}
                  className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                    surface === s
                      ? 'bg-bone text-basalt shadow-sm'
                      : 'text-stone hover:text-ink'
                  }`}
                >
                  {s === 'floor' ? 'Floor' : s === 'wall' ? 'Wall' : 'Floor + Wall'}
                </button>
              ))}
            </div>
          </div>

          {/* Area */}
          <div className="bg-bone border border-line rounded-xl p-5">
            <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3">Area</p>
            <div className="flex flex-wrap items-center gap-4">
              {(surface === 'floor' || surface === 'both') && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-ink font-medium">Floor:</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={floorArea}
                    onChange={e => setFloorArea(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={() => { if (floorArea === '' || floorArea <= 0) setFloorArea(1) }}
                    className="w-20 px-3 py-2 border border-line rounded-lg text-base text-center font-medium bg-bone min-h-[44px]"
                  />
                  <span className="text-sm text-stone">m²</span>
                </div>
              )}
              {(surface === 'wall' || surface === 'both') && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-ink font-medium">Wall:</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={wallArea}
                    onChange={e => setWallArea(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    onBlur={() => { if (wallArea === '' || wallArea <= 0) setWallArea(1) }}
                    className="w-20 px-3 py-2 border border-line rounded-lg text-base text-center font-medium bg-bone min-h-[44px]"
                  />
                  <span className="text-sm text-stone">m²</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="text-sm text-stone">Wastage:</label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={wastagePercent}
                  onChange={e => setWastagePercent(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  onBlur={() => { if (wastagePercent === '' || wastagePercent < 0) setWastagePercent(0) }}
                  className="w-16 px-2 py-2 border border-line rounded-lg text-base text-center bg-bone min-h-[44px]"
                />
                <span className="text-sm text-stone">%</span>
              </div>
            </div>
          </div>

          {/* Build type / System - shows separately for floor and wall in "both" mode */}
          {surface === 'both' ? (
            <>
              {/* Floor configuration */}
              <div className="bg-bone border border-line rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-basalt text-white text-xs font-medium flex items-center justify-center">F</div>
                  <p className="text-sm font-medium text-ink">Floor configuration</p>
                </div>
                <p className="text-xs font-medium text-stone uppercase tracking-wide mb-2">Build type</p>
                <div className="bg-track rounded-lg p-1 flex gap-1 mb-4">
                  {systems.filter(s => s.surface_type === 'floor' && (!selectedFamily || s.family === selectedFamily)).map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleFloorSystemChange(system.id)}
                      className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                        floorSystemId === system.id
                          ? 'bg-bone text-basalt shadow-sm'
                          : 'text-stone hover:text-ink'
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
              <div className="bg-bone border border-line rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded bg-basalt text-white text-xs font-medium flex items-center justify-center">W</div>
                  <p className="text-sm font-medium text-ink">Wall configuration</p>
                </div>
                <p className="text-xs font-medium text-stone uppercase tracking-wide mb-2">Build type</p>
                <div className="bg-track rounded-lg p-1 flex gap-1 mb-4">
                  {systems.filter(s => s.surface_type === 'wall' && (!selectedFamily || s.family === selectedFamily)).map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleWallSystemChange(system.id)}
                      className={`flex-1 py-2 px-3 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                        wallSystemId === system.id
                          ? 'bg-bone text-basalt shadow-sm'
                          : 'text-stone hover:text-ink'
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
              <div className="bg-bone border border-line rounded-xl p-5">
                <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3">Build type</p>
                <div className="bg-track rounded-lg p-1 flex gap-1">
                  {availableSystems.map(system => (
                    <button
                      key={system.id}
                      onClick={() => handleSystemChange(system.id)}
                      className={`flex-1 py-2.5 px-4 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                        selectedSystemId === system.id
                          ? 'bg-bone text-basalt shadow-sm'
                          : 'text-stone hover:text-ink'
                      }`}
                    >
                      {system.name.replace('Floor ', '').replace('Wall ', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Layers */}
              <div>
                <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3 px-1">Layers</p>
                <div className="space-y-4">
                  {renderStageGroups(singleStageGroups as [string, { layers: any[] }][])}
                </div>
              </div>
            </>
          )}

          {/* Colour picker */}
          <div className="bg-bone border border-line rounded-xl p-5">
            <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3">Pigment colour</p>
            
            {/* Natural / No Pigment option - always visible */}
            <button
              onClick={() => {
                setSelectedColour({ name: 'Natural (No Pigment)', hex: '#F5F5F0' })
                setUseCustomColour(false)
              }}
              className={`w-full mb-4 py-2 px-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center justify-center gap-2 min-h-[44px] ${
                selectedColour.name.toLowerCase().includes('natural') && !useCustomColour
                  ? 'border-basalt bg-limestone'
                  : 'border-line hover:border-stone'
              }`}
            >
              <div className="w-5 h-5 rounded border border-stone" style={{ backgroundColor: '#F5F5F0' }} />
              Natural (No Pigment)
            </button>
            
            <div className="space-y-3">
              {coloursByFamily.map(({ family, shades }) => (
                <div key={family.id}>
                  <p className="text-xs text-ash uppercase tracking-wide mb-2">{family.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {shades.map(swatch => (
                      <button
                        key={swatch.id}
                        onClick={() => {
                          setSelectedColour({ name: swatch.name, hex: swatch.hex_code })
                          setUseCustomColour(false)
                        }}
                        className={`w-12 h-12 rounded-lg border transition-all ${
                          selectedColour.name === swatch.name && !useCustomColour
                            ? 'ring-2 ring-basalt ring-offset-2 ring-offset-bone border-transparent'
                            : 'border-line hover:border-stone'
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
            <div className="mt-4 pt-4 border-t border-line-soft">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-stone uppercase tracking-wide">Custom Colour</p>
                <button
                  onClick={() => setUseCustomColour(!useCustomColour)}
                  className={`text-xs px-2 py-1 rounded ${
                    useCustomColour 
                      ? 'bg-basalt text-bone' 
                      : 'bg-line-soft text-stone hover:bg-line'
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
                      className="flex-1 px-3 py-2 text-sm border border-line rounded-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="#000000"
                      value={customColourHex}
                      onChange={e => setCustomColourHex(e.target.value)}
                      className="w-24 px-3 py-2 text-sm border border-line rounded-lg font-mono"
                    />
                    <input
                      type="color"
                      value={customColourHex || '#888888'}
                      onChange={e => setCustomColourHex(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <span className="flex-1 text-xs text-ash self-center">
                      Pick or enter hex code
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Selected colour display */}
            <div className="flex items-center gap-3 mt-4 p-3 bg-limestone rounded-lg">
              <div 
                className="w-8 h-8 rounded-lg border border-line"
                style={{ backgroundColor: useCustomColour ? (customColourHex || '#888888') : selectedColour.hex }}
              />
              <span className="font-medium">
                {useCustomColour ? (customColourName || 'Custom Colour') : selectedColour.name}
              </span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div id="materials-section" className="lg:sticky lg:top-6 h-fit">
          <div className="bg-bone border border-line rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-medium text-basalt">Materials</h2>
              <button
                onClick={copyList}
                className="flex items-center gap-1.5 text-sm text-stone hover:text-molten-ink"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            {items.length === 0 ? (
              <p className="text-ash text-sm text-center py-8">
                Configure your layers to see materials
              </p>
            ) : (
              <>
                <div className="space-y-1 mb-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-2 border-b border-line-soft last:border-0">
                      <div>
                        <p className="text-sm font-medium text-basalt">{item.name}</p>
                        <p className="text-xs text-stone">{item.qty}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">£{formatCurrency(item.cost)}</p>
                        <p className="text-xs text-stone">{item.units} × {item.unitSize}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Legend for shared materials */}
                {surface === 'both' && items.some(item => item.name.includes('✦')) && (
                  <div className="bg-molten-tint border border-molten/20 rounded-lg px-3 py-2 mb-4">
                    <p className="text-xs text-molten-ink">
                      <span className="font-medium">✦ Smart calculation:</span> These materials are calculated once for the combined floor + wall area — no need to buy separately for each surface.
                    </p>
                  </div>
                )}

                <div className="border-t-2 border-line pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-stone">Subtotal</span>
                    <span className="font-medium">£{formatCurrency(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-stone">VAT (20%)</span>
                    <span className="font-medium">£{formatCurrency(vat)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-3">
                    <span className="text-lg text-basalt">Total</span>
                    <span className="text-3xl font-medium text-basalt total-accent">£{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="flex justify-between text-sm mt-4">
                  <span className="text-stone">Cost per m²</span>
                  <span className="font-medium text-ink">£{formatCurrency(costPerM2)}</span>
                </div>

                <p className="text-xs text-ash mt-4">
                  * Includes {wastagePercent}% wastage
                </p>
                
                <p className="text-xs text-stone mt-3">
                  Pallet / Delivery Costs: TBC — quoted at time of order
                </p>
              </>
            )}
          </div>

          <Button 
            className="w-full mt-4 hidden lg:flex" 
            size="lg"
            disabled={items.length === 0}
            onClick={() => setShowSaveModal(true)}
          >
            Save Quote
          </Button>
        </div>
      </div>

      {/* Mobile sticky bottom bar - positioned above the tab nav (incl. iOS safe area) */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 bg-bone border-t border-line shadow-lg lg:hidden z-50">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-stone text-sm">Total</span>
            <span className="text-xl font-medium text-basalt total-accent">£{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline"
              className="flex-1 min-h-[48px]"
              onClick={() => {
                const el = document.getElementById('materials-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <ChevronUp className="w-4 h-4 mr-1" />
              Materials ({items.length})
            </Button>
            <Button 
              className="flex-1 min-h-[48px]"
              disabled={items.length === 0}
              onClick={() => setShowSaveModal(true)}
            >
              Save Quote
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ash mt-8 hidden lg:block">© Magma Coatings Ltd</p>
      
      {/* Save Quote Modal */}
      <SaveQuoteModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        surfaceType={surface}
        floorArea={floorAreaNum}
        wallArea={wallAreaNum}
        items={quoteItems}
        subtotal={subtotal}
        vat={vat}
        total={total}
      />
    </div>
  )
}
