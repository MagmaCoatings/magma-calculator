import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useColours } from '@/hooks/useProducts'
import { useSettings } from '@/hooks/useSettings'
import { useAuth } from '@/hooks/useAuth'
import { formatCurrency, vatLabel, surfaceLabel, areaLabel } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { InfoTip } from '@/components/ui/InfoTip'
import { Copy, Check, ChevronUp, ChevronDown, Package, Mail, X } from 'lucide-react'
import { openOrderEmail } from '@/lib/orderEmail'
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
  group_label?: string | null
  is_default_option: boolean
  is_optional: boolean
  coverage_sqm: number | null
  coverage_kg_per_sqm: number
  coverage_sqm_over_mesh?: number | null
  default_coats: number | null
  min_coats: number | null
  max_coats: number | null
  has_pigment: boolean
  pigment_default_on: boolean
  depends_on_product_id: string | null
  depends_on_product_ids?: string[] | null
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
    coverage_sqm?: number | null
    coverage_sqm_over_mesh?: number | null
    default_coats?: number | null
    min_coats?: number | null
    max_coats?: number | null
    coverage_note?: string | null
    natural_colour?: string | null
    qty_per_job?: number | null
  }
  stage: {
    id: string
    name: string
    display_order: number
  }
}

// Effective values: a system_products override falls back to the product default.
const effCoverage = (sp: SystemProduct) => sp.coverage_sqm ?? sp.product?.coverage_sqm ?? sp.product?.pack_size ?? 1
const effOverMesh = (sp: SystemProduct) => sp.coverage_sqm_over_mesh ?? sp.product?.coverage_sqm_over_mesh ?? null
const effDefCoats = (sp: SystemProduct) => sp.default_coats ?? sp.product?.default_coats ?? sp.min_coats ?? sp.product?.min_coats ?? 1
const effMinCoats = (sp: SystemProduct) => sp.min_coats ?? sp.product?.min_coats ?? 1
const effMaxCoats = (sp: SystemProduct) => sp.max_coats ?? sp.product?.max_coats ?? effDefCoats(sp)
const effNote = (sp: SystemProduct) => sp.coverage_note ?? sp.product?.coverage_note ?? null

// Within a stage, list each dependent layer (e.g. tape needing Liquid Membrane) straight after its parent
function orderWithDependants<T extends { products: SystemProduct[] }>(layers: T[]): T[] {
  const depIds = (l: T) => {
    const sp = l.products[0]
    return [...(sp?.depends_on_product_id ? [sp.depends_on_product_id] : []), ...(sp?.depends_on_product_ids || [])]
  }
  const isDependant = (l: T) => depIds(l).length > 0
  const out: T[] = []
  layers.filter(l => !isDependant(l)).forEach(parent => {
    out.push(parent)
    layers.filter(l => isDependant(l) && depIds(l).some(id => parent.products.some(p => p.id === id))).forEach(d => {
      if (!out.includes(d)) out.push(d)
    })
  })
  layers.forEach(l => { if (!out.includes(l)) out.push(l) })
  return out
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
  const { profile, user } = useAuth()
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
  const [surface, setSurface] = useState<'floor' | 'wall' | 'both' | 'custom'>('floor')
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

  // Build Your Own (custom) builder
  const [buildableProducts, setBuildableProducts] = useState<SystemProduct[]>([])
  const [customArea, setCustomArea] = useState<number | ''>(20)
  const [customLayers, setCustomLayers] = useState<{ [key: string]: { enabled: boolean; selectedProductId: string | null; area: number | ''; coats: number; pigment: boolean; application?: 'mesh' | 'standard' } }>({})

  // Custom colour state
  const [useCustomColour, setUseCustomColour] = useState(false)
  const [customColourName, setCustomColourName] = useState('')
  const [customColourHex, setCustomColourHex] = useState('')
  
  // Save quote modal
  const [showSaveModal, setShowSaveModal] = useState(false)
  // After copying or emailing an unsaved quote, offer to save it
  const [offerSave, setOfferSave] = useState<null | 'copied' | 'emailed'>(null)

  // Consumables (universal, admin-managed extras)
  const [consumables, setConsumables] = useState<{ id: string; name: string; code: string; price: number; pack_size: number; pack_unit: string; consumable_group: string | null; consumable_min_order: number | null }[]>([])
  const [consumableQtys, setConsumableQtys] = useState<{ [id: string]: number }>({})
  const [showConsumables, setShowConsumables] = useState(false)

  // Layout: folding stage sections, system picker sheet, Floor/Wall switch in Floor + Wall mode
  const [openStages, setOpenStages] = useState<{ [key: string]: boolean }>({})
  const [showSystemPicker, setShowSystemPicker] = useState(false)
  const [editSurface, setEditSurface] = useState<'floor' | 'wall'>('floor')

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
      
      // Separate the editable "Build Your Own" system from the normal Floor/Wall systems
      const byoSystem = data.find(s => (s.family || '').toLowerCase() === 'build your own' || s.name.toLowerCase() === 'build your own')
      const regularSystems = byoSystem ? data.filter(s => s.id !== byoSystem.id) : data
      setSystems(regularSystems)

      // Build Your Own source: the dedicated system if it exists, else every product deduped (fallback)
      if (byoSystem) {
        const { data: byoSp } = await supabase
          .from('system_products')
          .select('*, product:products(*), stage:stages(*)')
          .eq('system_id', byoSystem.id)
          .order('display_order')
        setBuildableProducts(((byoSp as SystemProduct[]) || []).filter(sp => sp.product && !sp.product.name?.toLowerCase().includes('pigment')))
      } else {
        const { data: allSp } = await supabase
          .from('system_products')
          .select('*, product:products(*), stage:stages(*)')
          .order('display_order')
        if (allSp) {
          const seen = new Set<string>()
          const unique: SystemProduct[] = []
          for (const sp of allSp as SystemProduct[]) {
            if (!sp.product_id || seen.has(sp.product_id)) continue
            if (sp.product?.name?.toLowerCase().includes('pigment')) continue
            seen.add(sp.product_id)
            unique.push(sp)
          }
          setBuildableProducts(unique)
        }
      }

      // Extract unique families (excluding the Build Your Own system)
      const uniqueFamilies = [...new Set(regularSystems.map(s => s.family).filter(Boolean))] as string[]
      setFamilies(uniqueFamilies)

      // Auto-select first family if there are multiple.
      // The surface effect below picks and loads the floor/wall systems for it.
      const initialFamily = uniqueFamilies.length > 0 ? uniqueFamilies[0] : null
      setSelectedFamily(initialFamily)
    } catch {
      setError('Failed to load systems. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSystems()
    // Load the universal consumables list (admin-managed)
    supabase.from('products')
      .select('id, name, code, price, pack_size, pack_unit, consumable_group, consumable_min_order')
      .eq('is_consumable', true).eq('is_active', true).order('display_order')
      .then(({ data }) => setConsumables((data as typeof consumables) || []))
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

  // Load sequencing: every load records a sequence number, and results from a load
  // that has since been superseded (user switched surface/system again) are discarded.
  // modeSeq covers whole-mode loads; sideSeq covers the floor/wall halves of Floor + Wall.
  const modeSeq = useRef(0)
  const sideSeq = useRef({ floor: 0, wall: 0 })

  // (Re)load systems whenever the surface or family changes. Layer states are always
  // rebuilt for the new mode, so floor_/wall_ keys never leak into single-surface mode.
  useEffect(() => {
    if (systems.length === 0 || surface === 'custom') return

    const familySystems = systems.filter(s => !selectedFamily || s.family === selectedFamily)
    // Keep the user's current build type for a surface if it belongs to this family
    const pick = (type: 'floor' | 'wall', currentId: string | null) =>
      familySystems.find(s => s.id === currentId && s.surface_type === type) ??
      familySystems.find(s => s.surface_type === type)
    const floorSys = pick('floor', floorSystemId)
    const wallSys = pick('wall', wallSystemId)
    if ((floorSys?.id ?? null) !== floorSystemId) setFloorSystemId(floorSys?.id ?? null)
    if ((wallSys?.id ?? null) !== wallSystemId) setWallSystemId(wallSys?.id ?? null)

    if (surface === 'both') {
      loadBothSurfaces(floorSys?.id ?? null, wallSys?.id ?? null)
    } else {
      const target = surface === 'floor' ? floorSys : wallSys
      if (target) {
        handleSystemChange(target.id)
      } else {
        modeSeq.current++
        setSelectedSystemId(null)
        setSystemProducts([])
        setLayerStates({})
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, systems, selectedFamily])

  // Auto-refresh product data when window regains focus (picks up admin changes)
  // This updates prices/names but preserves user's layer selections
  useEffect(() => {
    async function onFocus() {
      const seq = modeSeq.current // ignore if the user switches mode while this refresh is in flight
      const query = (systemId: string) => supabase
        .from('system_products')
        .select('*, product:products(*), stage:stages(*)')
        .eq('system_id', systemId)
        .order('display_order')
      
      if (surface === 'both') {
        // Refresh both floor and wall products
        if (floorSystemId) {
          const { data } = await query(floorSystemId)
          if (data && seq === modeSeq.current) setFloorProducts(data)
        }
        if (wallSystemId) {
          const { data } = await query(wallSystemId)
          if (data && seq === modeSeq.current) setWallProducts(data)
        }
      } else if (selectedSystemId) {
        // Single surface mode
        const { data } = await query(selectedSystemId)
        if (data && seq === modeSeq.current) setSystemProducts(data)
      }
      // Note: NOT calling initLayerStates - preserves user selections
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [surface, selectedSystemId, floorSystemId, wallSystemId])

  async function fetchSystemProducts(systemId: string): Promise<SystemProduct[] | null> {
    const { data, error: queryError } = await supabase
      .from('system_products')
      .select('*, product:products(*), stage:stages(*)')
      .eq('system_id', systemId)
      .order('display_order')
    if (queryError) {
      console.error('Failed to load system products', queryError)
      return null
    }
    return (data as SystemProduct[]) || []
  }

  // Load system products for single surface mode (Floor or Wall)
  async function handleSystemChange(systemId: string) {
    const seq = ++modeSeq.current
    setSelectedSystemId(systemId)
    // Clear straight away so no previous mode's layers are counted while loading (or if it fails)
    setSystemProducts([])
    setLayerStates({})
    const data = await fetchSystemProducts(systemId)
    if (!data || seq !== modeSeq.current) return
    setSystemProducts(data)
    setLayerStates(buildLayerStates(data, ''))
  }

  // Handle family change - the surface effect reloads systems for the new family
  function handleFamilyChange(family: string) {
    setSelectedFamily(family)
    setFloorSystemId(null)
    setWallSystemId(null)
  }

  // Load both surfaces together when entering Floor + Wall mode
  async function loadBothSurfaces(floorId: string | null, wallId: string | null) {
    const seq = ++modeSeq.current
    const fSeq = ++sideSeq.current.floor
    const wSeq = ++sideSeq.current.wall
    setLayerStates({})
    const [f, w] = await Promise.all([
      floorId ? fetchSystemProducts(floorId) : Promise.resolve([] as SystemProduct[]),
      wallId ? fetchSystemProducts(wallId) : Promise.resolve([] as SystemProduct[]),
    ])
    if (seq !== modeSeq.current) return
    const next: { [key: string]: LayerState } = {}
    if (f && fSeq === sideSeq.current.floor) {
      setFloorProducts(f)
      Object.assign(next, buildLayerStates(f, 'floor_'))
    }
    if (w && wSeq === sideSeq.current.wall) {
      setWallProducts(w)
      Object.assign(next, buildLayerStates(w, 'wall_'))
    }
    setLayerStates(prev => ({ ...prev, ...next }))
  }

  // Reload one half of Floor + Wall mode (user changed that surface's build type)
  async function loadSurfaceProducts(systemId: string, surfaceType: 'floor' | 'wall') {
    const prefix = `${surfaceType}_`
    const seq = modeSeq.current
    const sSeq = ++sideSeq.current[surfaceType]
    const data = await fetchSystemProducts(systemId)
    if (!data || seq !== modeSeq.current || sSeq !== sideSeq.current[surfaceType]) return
    if (surfaceType === 'floor') setFloorProducts(data)
    else setWallProducts(data)
    setLayerStates(prev => {
      const kept = Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix)))
      return { ...kept, ...buildLayerStates(data, prefix) }
    })
  }

  // Build default layer states for a system's products, keys prefixed per surface
  function buildLayerStates(data: SystemProduct[], prefix: string) {
    const newStates: { [key: string]: LayerState } = {}
    
    data.forEach(sp => {
      const key = prefix + (sp.option_group || `standalone_${sp.product_id}`)
      const isStandalone = !sp.option_group
      
      if (!newStates[key]) {
        newStates[key] = {
          enabled: !sp.is_optional || sp.is_default_option,
          selectedProductId: isStandalone ? sp.product_id : (sp.is_default_option ? sp.product_id : null),
          coats: effDefCoats(sp),
          pigment: sp.has_pigment ? (sp.pigment_default_on !== false) : false,
        }
      } else if (sp.is_default_option) {
        newStates[key].selectedProductId = sp.product_id
        newStates[key].coats = effDefCoats(sp)
        newStates[key].pigment = sp.has_pigment ? (sp.pigment_default_on !== false) : false
        if (sp.is_optional) {
          newStates[key].enabled = true
        }
      }
    })
    
    return newStates
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

  function toggleLayer(key: string) {
    setLayerStates(prev => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key]?.enabled }
    }))
  }

  function selectProduct(key: string, productId: string) {
    // Find the system product to get its pigment_default_on value
    const pool = key.startsWith('floor_') ? floorProducts : key.startsWith('wall_') ? wallProducts : systemProducts
    const sp = pool.find(p => p.product_id === productId)
    const pigmentDefault = sp?.has_pigment ? (sp.pigment_default_on !== false) : false
    
    setLayerStates(prev => ({
      ...prev,
      [key]: { 
        ...prev[key], 
        selectedProductId: productId,
        pigment: pigmentDefault,
        // Also update coats to the new product's defaults
        coats: sp ? effDefCoats(sp) : (prev[key]?.coats || 1)
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
      const stageOrder = sp.stage?.display_order ?? 99
      
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
    
    Object.values(stages).forEach(st => { st.layers = orderWithDependants(st.layers) })

    // Sort stages by display_order
    return Object.entries(stages)
      .sort(([, a], [, b]) => a.stageOrder - b.stageOrder)
  }

  // The colour actually in use: a custom colour replaces the swatch entirely
  const activeColourName = useCustomColour ? (customColourName.trim() || 'Custom') : selectedColour.name
  const activeColourIsNatural = useCustomColour
    ? customColourName.toLowerCase().includes('natural')
    : selectedColour.name.toLowerCase().includes('natural')

  // Is the chosen swatch this product's own unpigmented shade? (e.g. Nectar 1 on Magma 500 Medium)
  const isNaturalShadeFor = (product?: { natural_colour?: string | null } | null) =>
    !useCustomColour && !!product?.natural_colour &&
    product.natural_colour.trim().toLowerCase() === selectedColour.name.trim().toLowerCase()

  // Fixed per-job quantity (e.g. 1 roll of tape), when the product has one
  const perJobQty = (product?: { qty_per_job?: number | null } | null) =>
    product?.qty_per_job && product.qty_per_job > 0 ? product.qty_per_job : null

  // Calculate materials
  function calculate() {
    const items: { name: string; qty: string; units: number; unitSize: string; cost: number; stageOrder: number; productOrder: number; surfaceType: number }[] = []
    const floorAreaNum = floorArea === '' ? 0 : floorArea
    const wallAreaNum = wallArea === '' ? 0 : wallArea
    const wastageNum = wastagePercent === '' ? 0 : wastagePercent

    // Universal consumables (manual quantity) — included in every quote regardless of surface
    for (const c of consumables) {
      const q = consumableQtys[c.id] || 0
      if (q > 0) {
        const unitSize = c.pack_size === 1 ? c.pack_unit : `${c.pack_size}${c.pack_unit}`
        items.push({
          name: c.consumable_group ? `${c.consumable_group} — ${c.name}` : c.name,
          qty: `${q} × ${unitSize}`,
          units: q,
          unitSize,
          cost: q * c.price,
          stageOrder: 998, // after materials, before pigment (999)
          productOrder: 0,
          surfaceType: 2,
        })
      }
    }

    // Build Your Own (custom) mode — à la carte from buildable products
    if (surface === 'custom') {
      const baseArea = customArea === '' ? 0 : customArea
      let pigPacks = 0
      const keyOf = (p: SystemProduct) => p.option_group || `p_${p.product_id}`
      const triggerActive = (triggerSpId: string) => {
        const tsp = buildableProducts.find(p => p.id === triggerSpId)
        if (!tsp) return false
        const ls = customLayers[keyOf(tsp)]
        return !!ls?.enabled && (ls.selectedProductId ?? null) === tsp.product_id
      }
      const depsOk = (p: SystemProduct) => {
        const trigs = [...(p.depends_on_product_id ? [p.depends_on_product_id] : []), ...(p.depends_on_product_ids || [])]
        return trigs.length === 0 || trigs.some(triggerActive)
      }
      const sorted = [...buildableProducts].sort(
        (a, b) => (a.stage?.display_order ?? 99) - (b.stage?.display_order ?? 99) || (a.display_order ?? 0) - (b.display_order ?? 0)
      )
      // Is any reinforcement mesh enabled? Used to auto-pick DPM "over mesh" coverage.
      const meshEnabled = sorted.some(p => {
        const ls = customLayers[keyOf(p)]
        return !!ls?.enabled && (p.stage?.name || '').toLowerCase().includes('mesh')
      })
      const seenKeys = new Set<string>()
      for (const rep of sorted) {
        const key = keyOf(rep)
        if (seenKeys.has(key)) continue
        seenKeys.add(key)
        const st = customLayers[key]
        if (!st?.enabled) continue
        if (!depsOk(rep)) continue
        const group = sorted.filter(p => keyOf(p) === key)
        const sp = group.find(p => p.product_id === (st.selectedProductId ?? '')) || group[0]
        if (!sp.product) continue
        const overrideArea = typeof st.area === 'number' && st.area > 0 ? st.area : 0
        const resolvedArea = overrideArea > 0 ? overrideArea : (baseArea > 0 ? baseArea : 1)
        const areaWithWastage = resolvedArea * (1 + wastageNum / 100)
        const coats = st.coats || 1
        // Dual-coverage products (e.g. DPM epoxy) carry a standard + over-mesh rate.
        const stdCoverage = effCoverage(sp)
        const overMesh = effOverMesh(sp)
        const isDual = overMesh != null && overMesh !== stdCoverage
        const application: 'mesh' | 'standard' = st.application ?? (meshEnabled ? 'mesh' : 'standard')
        const coverage = isDual
          ? (application === 'mesh' ? (overMesh as number) : stdCoverage)
          : stdCoverage
        const appSuffix = isDual ? (application === 'mesh' ? ' · over mesh' : ' · standard') : ''
        // An enabled product always shows at least 1 pack — never vanishes while editing the area
        const fixedQty = perJobQty(sp.product)
        const units = fixedQty ?? Math.max(1, Math.ceil((areaWithWastage * coats) / coverage))
        items.push({
          name: sp.product.name,
          qty: fixedQty ? `${fixedQty} per job` : (coats > 1 ? `${areaWithWastage.toFixed(1)}m² × ${coats} coats` : `${areaWithWastage.toFixed(1)}m²`) + appSuffix,
          units,
          unitSize: sp.product.pack_size === 1 ? sp.product.pack_unit : `${sp.product.pack_size}${sp.product.pack_unit}`,
          cost: units * sp.product.price,
          stageOrder: sp.stage?.display_order ?? 99,
          productOrder: sp.display_order ?? 0,
          surfaceType: 1,
        })
        if (st.pigment && sp.has_pigment && !isNaturalShadeFor(sp.product)) pigPacks += units
      }
      if (pigPacks > 0 && !activeColourIsNatural) {
        items.push({ name: `Pigment - ${activeColourName}`, qty: `${pigPacks} pot${pigPacks > 1 ? 's' : ''}`, units: pigPacks, unitSize: 'pot', cost: pigPacks * settings.pigment_price, stageOrder: 999, productOrder: 0, surfaceType: 3 })
      }
      items.sort((a, b) => a.stageOrder - b.stageOrder || a.productOrder - b.productOrder)
      const subtotal = items.reduce((s, i) => s + i.cost, 0)
      return { items, subtotal }
    }

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

        // Respect dependencies: skip in the calc if the product it depends on isn't selected
        if (sp.depends_on_product_id) {
          const depSp = products.find(p => p.id === sp.depends_on_product_id)
          if (depSp) {
            const depKey = prefix + (depSp.option_group || `standalone_${depSp.product_id}`)
            const depState = layerStates[depKey]
            if (!depState?.enabled || depState?.selectedProductId !== depSp.product_id) return
          }
        }

        // Handle shared products
        if (skipShared && sp.shared_across_surfaces) return
        if (isSharedPass && !sp.shared_across_surfaces) return
        
        // Skip if this shared product was already processed
        if (sp.shared_across_surfaces && processedSharedProducts.has(sp.product_id)) return
        if (sp.shared_across_surfaces) processedSharedProducts.add(sp.product_id)
        
        if (sp.product.name?.toLowerCase().includes('pigment')) return

        const coats = state.coats || 1
        const coverage = effCoverage(sp)
        const areaWithCoats = area * coats
        const fixedQty = perJobQty(sp.product)
        const unitsNeeded = fixedQty ?? Math.ceil(areaWithCoats / coverage)

        // Shared products don't get F/W prefix, but get a badge
        const isSharedInBothMode = surface === 'both' && sp.shared_across_surfaces
        const displayName = (surface === 'both' && !sp.shared_across_surfaces) 
          ? `${surfaceLabel}${sp.product.name}` 
          : sp.product.name

        // For shared products in both mode, make it very clear it covers both areas
        let qtyDisplay: string
        if (fixedQty) {
          qtyDisplay = `${fixedQty} per job`
        } else if (isSharedInBothMode) {
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
          unitSize: sp.product.pack_size === 1 ? sp.product.pack_unit : `${sp.product.pack_size}${sp.product.pack_unit}`,
          cost: unitsNeeded * sp.product.price,
          stageOrder: sp.stage?.display_order ?? 99,
          productOrder: sp.display_order ?? 0,
          surfaceType: isSharedPass ? 0 : (prefix === 'floor_' ? 1 : 2), // 0=shared, 1=floor, 2=wall
        })

        if (state.pigment && sp.has_pigment && !isNaturalShadeFor(sp.product)) {
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
    if (totalPigmentPacks > 0 && !activeColourIsNatural) {
      const allProds = surface === 'both' ? [...floorProducts, ...wallProducts] : systemProducts
      const pigmentProduct = allProds.find(sp => sp.product?.name?.toLowerCase().includes('pigment'))?.product
      const pigmentPrice = pigmentProduct?.price || settings.pigment_price
      items.push({
        name: `Pigment - ${activeColourName}`,
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
  const totalArea = surface === 'custom' ? (customArea === '' ? 0 : customArea) : surface === 'floor' ? floorAreaNum : surface === 'wall' ? wallAreaNum : floorAreaNum + wallAreaNum
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
    
    const selProdMin = selectedProduct ? effMinCoats(selectedProduct) : 1
    const selProdMax = selectedProduct ? effMaxCoats(selectedProduct) : 1
    const hasCoatOptions = selectedProduct && selProdMin < selProdMax
    const hasPigmentOption = selectedProduct?.has_pigment
    const showFullCard = state.enabled || !layer.isOptional || hasCoatOptions || hasPigmentOption
    const fixedCoats = selectedProduct && selProdMin === selProdMax && selProdMin > 1
        ? selProdMin
        : null

    return (
      <div key={`${stageName}__${layer.key}`} className={`py-4 border-t border-line-soft first:border-t-0 ${
        dependsOnId ? 'ml-2 pl-4 border-l-2 border-l-track' : ''
      } ${layer.isOptional && !state.enabled ? 'opacity-60' : ''}`}>
        {/* Layer header */}
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-basalt flex items-center gap-1.5">
              {layer.products[0]?.group_label
                || (hasMultipleProducts
                  ? stageName
                  : selectedProduct?.product?.name || layer.products[0]?.product?.name || stageName)}
              {showTooltips && !hasMultipleProducts && selectedProduct?.product?.description && (
                <InfoTip content={selectedProduct.product.description} />
              )}
            </p>
            {selectedProduct && effNote(selectedProduct) && (
              <p className="text-xs text-stone mt-0.5">{effNote(selectedProduct)}</p>
            )}
          </div>
          {layer.isOptional && (
            <button
              onClick={() => toggleLayer(layer.key)}
              aria-label={`Include ${selectedProduct?.product?.name || stageName}`}
              aria-pressed={!!state.enabled}
              className={`w-12 h-6 shrink-0 rounded-full transition-colors relative ${
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
                        { length: selProdMax - selProdMin + 1 },
                        (_, i) => selProdMin + i
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
                    {state.pigment && isNaturalShadeFor(selectedProduct?.product) && (
                      <span className="text-xs text-ash">{selectedColour.name} is this product's natural shade, so no pigment is needed</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // One-line summary of what a stage currently includes
  function stageSummary(layers: { key: string; products: SystemProduct[]; isOptional: boolean }[]) {
    const names: string[] = []
    layers.forEach(layer => {
      const st = layerStates[layer.key]
      if (!st?.enabled || !st.selectedProductId) return
      const sp = layer.products.find(p => p.product_id === st.selectedProductId)
      if (sp?.product?.name) names.push(sp.product.name)
    })
    return names.length ? names.join(' + ') : 'Not included'
  }

  // Stages as folding sections: header shows the stage and a summary, tap to open its layers
  function renderStageSections(groups: [string, { layers: any[] }][], prefix: string) {
    let n = 0
    return groups.map(([stageName, { layers }]) => {
      const cards = layers.map(layer => renderLayerCard(layer, stageName)).filter(Boolean)
      if (cards.length === 0) return null
      n += 1
      const openKey = `${prefix}${stageName}`
      const open = !!openStages[openKey]
      return (
        <div key={openKey} className="bg-bone border border-line rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setOpenStages(prev => ({ ...prev, [openKey]: !open }))}
            aria-expanded={open}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left min-h-[60px]"
          >
            <span className="flex items-center gap-3 min-w-0">
              <span className={`w-6 h-6 rounded-md text-xs font-medium flex items-center justify-center shrink-0 ${open ? 'bg-basalt text-bone' : 'bg-track text-ink'}`}>{n}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-basalt">{stageName}</span>
                <span className="block text-xs text-stone truncate">{stageSummary(layers)}</span>
              </span>
            </span>
            <ChevronDown className={`w-5 h-5 text-stone shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && <div className="px-5 pb-1 border-t border-line-soft">{cards}</div>}
        </div>
      )
    })
  }

  // Copy list
  function copyList() {
    let text = `MAGMA CALCULATOR - ${selectedSystem?.name || 'Quote'}\n`
    text += `${totalArea}m² - ${activeColourName}\n`
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
    setOfferSave('copied')
  }

  // Email the order to Magma straight from the calculator, without saving first
  function emailOrder() {
    const savedFloor = surface === 'custom' ? totalArea : surface === 'wall' ? 0 : floorAreaNum
    const savedWall = surface === 'custom' || surface === 'floor' ? 0 : wallAreaNum
    openOrderEmail({
      reference: null,
      surface: surfaceLabel(surface),
      area: areaLabel(surface, savedFloor, savedWall),
      colour: activeColourName,
      items: quoteItems.map(i => ({ quantity: i.quantity, name: i.name, unitPrice: i.unitPrice, total: i.total })),
      subtotal,
      vat,
      total,
      vatRate: settings.vat_rate,
      profile,
      userEmail: user?.email,
    })
    setOfferSave('emailed')
  }

  function openSave() {
    setOfferSave(null)
    setShowSaveModal(true)
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

  // Build Your Own helpers
  function setCustomLayer(key: string, updates: Partial<{ enabled: boolean; selectedProductId: string | null; area: number | ''; coats: number; pigment: boolean; application: 'mesh' | 'standard' }>) {
    setCustomLayers(prev => {
      const existing = prev[key] || { enabled: false, selectedProductId: null, area: '' as number | '', coats: 1, pigment: false }
      return { ...prev, [key]: { ...existing, ...updates } }
    })
  }

  function renderBuildYourOwn() {
    const keyOf = (p: SystemProduct) => p.option_group || `p_${p.product_id}`
    const triggerActive = (triggerSpId: string) => {
      const tsp = buildableProducts.find(p => p.id === triggerSpId)
      if (!tsp) return false
      const ls = customLayers[keyOf(tsp)]
      return !!ls?.enabled && (ls.selectedProductId ?? null) === tsp.product_id
    }
    const depsOk = (p: SystemProduct) => {
      const trigs = [...(p.depends_on_product_id ? [p.depends_on_product_id] : []), ...(p.depends_on_product_ids || [])]
      return trigs.length === 0 || trigs.some(triggerActive)
    }
    const meshOn = buildableProducts.some(p => {
      const ls = customLayers[keyOf(p)]
      return !!ls?.enabled && (p.stage?.name || '').toLowerCase().includes('mesh')
    })

    // Group by stage, then by option-group / standalone, in build order
    const stageList: { name: string; order: number; layers: { key: string; products: SystemProduct[] }[] }[] = []
    const sorted = [...buildableProducts].sort((a, b) => (a.stage?.display_order ?? 99) - (b.stage?.display_order ?? 99) || (a.display_order ?? 0) - (b.display_order ?? 0))
    sorted.forEach(sp => {
      const stName = sp.stage?.name || 'Other'
      let stg = stageList.find(s => s.name === stName)
      if (!stg) { stg = { name: stName, order: sp.stage?.display_order ?? 99, layers: [] }; stageList.push(stg) }
      const k = keyOf(sp)
      let layer = stg.layers.find(l => l.key === k)
      if (!layer) { layer = { key: k, products: [] }; stg.layers.push(layer) }
      layer.products.push(sp)
    })
    stageList.sort((a, b) => a.order - b.order)
    stageList.forEach(stg => { stg.layers = orderWithDependants(stg.layers) })

    return (
      <>
        <div className="bg-bone border border-line rounded-xl p-5">
          <p className="text-xs font-medium text-stone uppercase tracking-wide mb-1">Build your own system</p>
          <p className="text-xs text-ash mb-4">Toggle on exactly the products you need. Set a default area below; override it per product where needed.</p>
          <div className="flex items-center gap-2">
            <label className="text-sm text-ink font-medium">Default area:</label>
            <input
              type="number"
              inputMode="decimal"
              value={customArea}
              onChange={e => setCustomArea(e.target.value === '' ? '' : parseFloat(e.target.value))}
              onBlur={() => { if (customArea === '' || customArea <= 0) setCustomArea(1) }}
              className="w-20 px-3 py-2 border border-line rounded-lg text-base text-center font-medium bg-bone min-h-[44px]"
            />
            <span className="text-sm text-stone">m²</span>
            <span className="text-sm text-stone ml-2">Wastage:</span>
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

        {stageList.map((stg, stgIdx) => {
          const openKey = `custom_${stg.name}`
          const open = !!openStages[openKey]
          const included = stg.layers
            .filter(l => customLayers[l.key]?.enabled && depsOk(l.products[0]))
            .map(l => (l.products.find(p => p.product_id === customLayers[l.key]?.selectedProductId) || l.products[0])?.product?.name)
            .filter(Boolean)
          return (
          <div key={stg.name} className="bg-bone border border-line rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setOpenStages(prev => ({ ...prev, [openKey]: !open }))}
              aria-expanded={open}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left min-h-[60px]"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className={`w-6 h-6 rounded-md text-xs font-medium flex items-center justify-center shrink-0 ${open ? 'bg-basalt text-bone' : 'bg-track text-ink'}`}>{stgIdx + 1}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-basalt">{stg.name}</span>
                  <span className="block text-xs text-stone truncate">{included.length ? included.join(' + ') : 'None selected'}</span>
                </span>
              </span>
              <ChevronDown className={`w-5 h-5 text-stone shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
            <div className="px-5 pb-1 border-t border-line-soft">
              {stg.layers.map(layer => {
                const reps = layer.products
                if (!depsOk(reps[0])) return null
                const st = customLayers[layer.key] || { enabled: false, selectedProductId: reps.length === 1 ? reps[0].product_id : null, area: '' as number | '', coats: 1, pigment: reps[0]?.pigment_default_on ?? false }
                const multi = reps.length > 1
                const selected = reps.find(p => p.product_id === st.selectedProductId) || reps[0]
                const selMin = effMinCoats(selected), selMax = effMaxCoats(selected)
                const hasCoats = selMin < selMax
                const selOverMesh = effOverMesh(selected), selStd = effCoverage(selected)
                const isDual = selOverMesh != null && selOverMesh !== selStd
                const effApp: 'mesh' | 'standard' = st.application ?? (meshOn ? 'mesh' : 'standard')
                return (
                  <div key={layer.key} className={`py-4 border-t border-line-soft first:border-t-0 ${reps[0].depends_on_product_id || reps[0].depends_on_product_ids?.length ? 'ml-2 pl-4 border-l-2 border-l-track' : ''} ${!st.enabled ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-basalt">{reps[0]?.group_label || selected.product?.name}</p>
                        {effNote(selected) && <p className="text-xs text-stone mt-0.5">{effNote(selected)}</p>}
                      </div>
                      <button
                        onClick={() => setCustomLayer(layer.key, { enabled: !st.enabled, selectedProductId: st.selectedProductId || reps[0].product_id, coats: st.enabled ? st.coats : effDefCoats(reps[0]), pigment: st.enabled ? st.pigment : (selected.pigment_default_on ?? false) })}
                        className={`w-12 h-6 rounded-full transition-colors relative shrink-0 ${st.enabled ? 'bg-sage' : 'bg-ash'}`}
                        aria-label={`Toggle ${selected.product?.name}`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow absolute top-0.5 transition-transform ${st.enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                    {st.enabled && (
                      <div className="mt-3 pt-3 border-t border-line-soft space-y-3">
                        {multi && (
                          <div className="flex flex-wrap gap-2">
                            {reps.map(rep => (
                              <button
                                key={rep.product_id}
                                onClick={() => setCustomLayer(layer.key, { selectedProductId: rep.product_id, coats: effDefCoats(rep) })}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${st.selectedProductId === rep.product_id ? 'bg-basalt text-bone border-2 border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}
                              >
                                {rep.product?.name}
                              </button>
                            ))}
                          </div>
                        )}
                        {isDual && (
                          <div className="rounded-lg bg-track/60 border border-line p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs font-medium text-ink">Application</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => setCustomLayer(layer.key, { application: 'mesh' })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${effApp === 'mesh' ? 'bg-basalt text-bone border-2 border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}
                                >
                                  Over mesh
                                </button>
                                <button
                                  onClick={() => setCustomLayer(layer.key, { application: 'standard' })}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${effApp === 'standard' ? 'bg-basalt text-bone border-2 border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}
                                >
                                  Standard
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-stone">
                              {effApp === 'mesh'
                                ? `Over mesh uses more epoxy (≈ ${selOverMesh} m²/pack).`
                                : `Standard, no mesh (≈ ${selStd} m²/pack).`}
                              {st.application == null && ` Auto-set from your mesh selection — tap to override.`}
                            </p>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone">Area:</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              value={st.area}
                              placeholder={String(customArea)}
                              onChange={e => setCustomLayer(layer.key, { area: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                              className="w-20 px-3 py-2 border border-line rounded-lg text-base text-center bg-bone min-h-[44px]"
                            />
                            <span className="text-xs text-stone">m²</span>
                          </div>
                          {hasCoats && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-stone">Coats:</span>
                              {Array.from({ length: selMax - selMin + 1 }, (_, i) => selMin + i).map(n => (
                                <button
                                  key={n}
                                  onClick={() => setCustomLayer(layer.key, { coats: n })}
                                  className={`w-8 h-8 rounded-lg text-sm font-medium min-h-[44px] min-w-[44px] ${st.coats === n ? 'bg-basalt text-bone border-2 border-basalt' : 'bg-bone border border-line text-ink hover:border-stone'}`}
                                >
                                  {n}
                                </button>
                              ))}
                            </div>
                          )}
                          {selected.has_pigment && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-stone">Add pigment:</span>
                              <button
                                onClick={() => setCustomLayer(layer.key, { pigment: !st.pigment })}
                                className={`w-10 h-5 rounded-full transition-colors relative ${st.pigment ? 'bg-sage' : 'bg-ash'}`}
                              >
                                <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-0.5 transition-transform ${st.pigment ? 'translate-x-5' : 'translate-x-0.5'}`} />
                              </button>
                              {st.pigment && isNaturalShadeFor(selected.product) && (
                                <span className="text-xs text-ash">{selectedColour.name} is this product's natural shade, so no pigment is needed</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            )}
          </div>
          )
        })}
      </>
    )
  }

  // System summary line and picker contents
  const shortName = (id: string | null) => (systems.find(x => x.id === id)?.name || '').replace(/^(Floor|Wall)\s+/i, '')
  const systemSummary = surface === 'both'
    ? `Floor ${shortName(floorSystemId) || '-'} · Wall ${shortName(wallSystemId) || '-'}`
    : (selectedSystem?.name || 'Choose a system')
  const pickerSurface: 'floor' | 'wall' = surface === 'both' ? editSurface : (surface === 'wall' ? 'wall' : 'floor')
  const pickerSystems = systems.filter(s => s.surface_type === pickerSurface && (!selectedFamily || s.family === selectedFamily))
  const pickerSelectedId = surface === 'both'
    ? (pickerSurface === 'floor' ? floorSystemId : wallSystemId)
    : selectedSystemId
  function pickSystem(id: string) {
    if (surface === 'both') {
      if (pickerSurface === 'floor') handleFloorSystemChange(id)
      else handleWallSystemChange(id)
      return // stay open so the other surface can be chosen too
    }
    if (surface === 'floor') setFloorSystemId(id)
    else if (surface === 'wall') setWallSystemId(id)
    handleSystemChange(id)
    setShowSystemPicker(false)
  }


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
            <div className="bg-track rounded-lg p-1 flex flex-wrap gap-1">
              {(['floor', 'wall', 'both', 'custom'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSurface(s)}
                  className={`flex-1 min-w-[78px] py-2.5 px-3 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                    surface === s
                      ? 'bg-bone text-basalt shadow-sm'
                      : 'text-stone hover:text-ink'
                  }`}
                >
                  {s === 'floor' ? 'Floor' : s === 'wall' ? 'Wall' : s === 'both' ? 'Floor + Wall' : 'Build Your Own'}
                </button>
              ))}
            </div>
          </div>

          {/* Area (hidden in Build Your Own — it has its own area control) */}
          {surface !== 'custom' && (
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
          )}

          {/* System summary (opens the picker) and layers by stage; Build Your Own replaces both */}
          {surface === 'custom' ? renderBuildYourOwn() : (
            <>
              <div className="bg-bone border border-line rounded-xl">
                <button
                  type="button"
                  onClick={() => setShowSystemPicker(true)}
                  className="w-full flex items-center justify-between gap-3 p-5 text-left min-h-[64px]"
                >
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-stone uppercase tracking-wide">System</span>
                    <span className="block font-medium text-basalt mt-1">{systemSummary}</span>
                  </span>
                  <span className="text-sm font-medium text-molten-ink shrink-0">Change</span>
                </button>
              </div>

              {surface === 'both' && (
                <div className="bg-track rounded-lg p-1 flex gap-1" role="tablist" aria-label="Surface to edit">
                  {(['floor', 'wall'] as const).map(sf => (
                    <button
                      key={sf}
                      role="tab"
                      aria-selected={editSurface === sf}
                      onClick={() => setEditSurface(sf)}
                      className={`flex-1 py-2.5 px-3 rounded-md font-medium text-sm transition-all min-h-[44px] ${
                        editSurface === sf ? 'bg-bone text-basalt shadow-sm' : 'text-stone hover:text-ink'
                      }`}
                    >
                      {sf === 'floor' ? `Floor ${floorAreaNum}m²` : `Wall ${wallAreaNum}m²`}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                {surface === 'both'
                  ? (editSurface === 'floor'
                      ? renderStageSections(floorStageGroups as [string, { layers: any[] }][], 'floor_')
                      : renderStageSections(wallStageGroups as [string, { layers: any[] }][], 'wall_'))
                  : renderStageSections(singleStageGroups as [string, { layers: any[] }][], `${surface}_single_`)}
              </div>
            </>
          )}

          {/* Consumables / Extras — universal, collapsible */}
          {consumables.length > 0 && (
            <div className="bg-bone border border-line rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowConsumables(v => !v)}
                className="w-full flex items-center justify-between gap-3 p-5 text-left"
                aria-expanded={showConsumables}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Package className="w-4 h-4 text-stone shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone uppercase tracking-wide">Consumables / Extras</p>
                    <p className="text-xs text-ash mt-0.5">
                      {(() => { const n = Object.values(consumableQtys).filter(q => q > 0).length; return n > 0 ? `${n} added` : 'Sanding pads, discs & extras' })()}
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-stone shrink-0 transition-transform ${showConsumables ? 'rotate-180' : ''}`} />
              </button>
              {showConsumables && (() => {
                // Group consumables by family (consumable_group); ungrouped items stand alone.
                const order: string[] = []
                const map: { [key: string]: { heading: string | null; minOrder: number | null; items: typeof consumables } } = {}
                for (const c of consumables) {
                  const key = c.consumable_group || `__solo_${c.id}`
                  if (!map[key]) { map[key] = { heading: c.consumable_group, minOrder: null, items: [] }; order.push(key) }
                  map[key].items.push(c)
                  if (c.consumable_min_order != null) map[key].minOrder = c.consumable_min_order
                }
                return (
                  <div className="px-5 pb-5 pt-4 border-t border-line-soft space-y-5">
                    {order.map(key => {
                      const group = map[key]
                      const total = group.items.reduce((s, c) => s + (consumableQtys[c.id] || 0), 0)
                      const under = group.minOrder != null && total > 0 && total < group.minOrder
                      return (
                        <div key={key} className="space-y-2.5">
                          {group.heading && (
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-basalt">{group.heading}</p>
                              {group.minOrder != null && (
                                <span className="text-[11px] text-stone whitespace-nowrap shrink-0">Min {group.minOrder} · mix &amp; match</span>
                              )}
                            </div>
                          )}
                          {group.items.map(c => {
                            const q = consumableQtys[c.id] || 0
                            const unitSize = c.pack_size === 1 ? c.pack_unit : `${c.pack_size}${c.pack_unit}`
                            return (
                              <div key={c.id} className="flex items-center justify-between gap-3 pl-0.5">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-basalt truncate">{c.name}</p>
                                  <p className="text-xs text-stone">£{formatCurrency(c.price)} / {unitSize}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => setConsumableQtys(p => ({ ...p, [c.id]: Math.max(0, (p[c.id] || 0) - 1) }))}
                                    className="w-10 h-10 rounded-lg border border-line text-ink hover:border-stone disabled:opacity-40"
                                    disabled={q === 0}
                                    aria-label={`Decrease ${c.consumable_group ? `${c.consumable_group} ` : ''}${c.name}`}
                                  >−</button>
                                  <span className="w-6 text-center text-sm font-medium tabular-nums">{q}</span>
                                  <button
                                    type="button"
                                    onClick={() => setConsumableQtys(p => ({ ...p, [c.id]: (p[c.id] || 0) + 1 }))}
                                    className="w-10 h-10 rounded-lg border border-line text-ink hover:border-stone"
                                    aria-label={`Increase ${c.consumable_group ? `${c.consumable_group} ` : ''}${c.name}`}
                                  >+</button>
                                </div>
                              </div>
                            )
                          })}
                          {under && (
                            <p className="text-xs text-molten-ink bg-molten-tint border border-molten/30 rounded-lg px-3 py-2">
                              Add {group.minOrder! - total} more to meet the {group.minOrder} minimum order (any mix of grits).
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Colour picker */}
          <div className="bg-bone border border-line rounded-xl p-5">
            <p className="text-xs font-medium text-stone uppercase tracking-wide mb-3">Pigment colour</p>
            
            <div className="space-y-3">
              {coloursByFamily.map(({ family, shades }) => (
                <div key={family.id}>
                  <p className="text-xs text-ash uppercase tracking-wide mb-2">{family.name.toLowerCase() === 'natural' ? 'Natural - No Pigment' : family.name}</p>
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
              <div className="flex items-center gap-4">
                <button
                  onClick={emailOrder}
                  disabled={items.length === 0}
                  className="flex items-center gap-1.5 text-sm text-stone hover:text-molten-ink disabled:opacity-40"
                  title="Email this order to Magma (no need to save first)"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
                <button
                  onClick={copyList}
                  disabled={items.length === 0}
                  className="flex items-center gap-1.5 text-sm text-stone hover:text-molten-ink disabled:opacity-40"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
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
                    <span className="text-stone">{vatLabel(settings.vat_rate)}</span>
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
            onClick={openSave}
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
            <span className="text-xl font-medium text-basalt">
              <span className="total-accent">£{formatCurrency(subtotal)}</span>
              <span className="text-sm font-normal text-stone ml-1.5">+ VAT</span>
            </span>
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
              variant="outline"
              className="min-h-[48px] px-3 shrink-0"
              disabled={items.length === 0}
              onClick={copyList}
              aria-label="Copy materials list"
              title="Copy list"
            >
              {copied ? <Check className="w-4 h-4 text-sage" /> : <Copy className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              className="min-h-[48px] px-3 shrink-0"
              disabled={items.length === 0}
              onClick={emailOrder}
              aria-label="Email order to Magma"
              title="Email order"
            >
              <Mail className="w-4 h-4" />
            </Button>
            <Button
              className="flex-1 min-h-[48px]"
              disabled={items.length === 0}
              onClick={openSave}
            >
              Save Quote
            </Button>
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-ash mt-8 hidden lg:block">© Magma Coatings Ltd</p>
      
      {/* System picker sheet */}
      {showSystemPicker && (
        <div
          className="fixed inset-0 z-[70] bg-basalt/50 flex items-end lg:items-center justify-center"
          onClick={() => setShowSystemPicker(false)}
          onKeyDown={e => { if (e.key === 'Escape') setShowSystemPicker(false) }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose a system"
            onClick={e => e.stopPropagation()}
            className="bg-bone w-full lg:max-w-md rounded-t-2xl lg:rounded-2xl max-h-[85vh] overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-basalt">{surface === 'both' ? 'Choose systems' : 'Choose a system'}</h2>
              <button
                onClick={() => setShowSystemPicker(false)}
                aria-label="Close"
                className="w-11 h-11 flex items-center justify-center rounded-lg text-stone hover:text-basalt"
                autoFocus
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {surface === 'both' && (
              <div className="bg-track rounded-lg p-1 flex gap-1">
                {(['floor', 'wall'] as const).map(sf => (
                  <button
                    key={sf}
                    onClick={() => setEditSurface(sf)}
                    className={`flex-1 py-2.5 rounded-md font-medium text-sm min-h-[44px] ${
                      editSurface === sf ? 'bg-bone text-basalt shadow-sm' : 'text-stone hover:text-ink'
                    }`}
                  >
                    {sf === 'floor' ? 'Floor' : 'Wall'}
                  </button>
                ))}
              </div>
            )}

            <p className="text-xs font-medium text-stone uppercase tracking-wide pt-1">{selectedFamily || 'Systems'}</p>
            {pickerSystems.map(sys => {
              const sel = pickerSelectedId === sys.id
              return (
                <button
                  key={sys.id}
                  onClick={() => pickSystem(sys.id)}
                  aria-pressed={sel}
                  className={`w-full flex gap-3 p-4 rounded-xl text-left bg-bone ${sel ? 'border-2 border-molten' : 'border border-line hover:border-stone'}`}
                >
                  <span className={`w-5 h-5 rounded-full shrink-0 mt-0.5 ${sel ? 'border-[6px] border-molten' : 'border-2 border-ash'}`} />
                  <span className="min-w-0">
                    <span className="block font-medium text-basalt">{sys.name}</span>
                    {sys.description && <span className="block text-sm text-stone mt-1 leading-snug">{sys.description}</span>}
                  </span>
                </button>
              )
            })}

            <p className="text-xs font-medium text-stone uppercase tracking-wide pt-2">Pick products yourself</p>
            <button
              onClick={() => { setSurface('custom'); setShowSystemPicker(false) }}
              className="w-full flex gap-3 p-4 rounded-xl text-left bg-bone border border-dashed border-ash hover:border-stone"
            >
              <span className="w-5 h-5 rounded-full shrink-0 mt-0.5 border-2 border-ash" />
              <span>
                <span className="block font-medium text-basalt">Build your own</span>
                <span className="block text-sm text-stone mt-1 leading-snug">Switch on exactly the products you need, each with its own area</span>
              </span>
            </button>

            {surface === 'both' && (
              <Button className="w-full mt-2" size="lg" onClick={() => setShowSystemPicker(false)}>Done</Button>
            )}
          </div>
        </div>
      )}

      {/* Offer to save after copying or emailing an unsaved quote */}
      {offerSave && !showSaveModal && items.length > 0 && (
        <div
          role="status"
          className="fixed z-[60] left-4 right-4 bottom-[calc(9.5rem+env(safe-area-inset-bottom))] lg:left-auto lg:right-6 lg:bottom-6 lg:w-96 bg-basalt text-bone rounded-xl shadow-lg p-4 flex items-start gap-3"
        >
          <div className="flex-1">
            <p className="text-sm font-medium">{offerSave === 'copied' ? 'Materials list copied.' : 'Order email opened.'}</p>
            <p className="text-xs text-bone/80 mt-0.5">This quote isn't saved yet. Save it to find it later in Quotes.</p>
            <button
              onClick={openSave}
              className="mt-3 px-4 py-2 rounded-lg bg-molten text-white text-sm font-medium hover:bg-molten-ink min-h-[40px]"
            >
              Save quote
            </button>
          </div>
          <button onClick={() => setOfferSave(null)} aria-label="Dismiss" className="p-1 text-bone/70 hover:text-bone">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Save Quote Modal */}
      <SaveQuoteModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        surfaceType={surface}
        // Build Your Own has a single area: store it as floor_area so lists show the real figure
        floorArea={surface === 'custom' ? totalArea : surface === 'wall' ? 0 : floorAreaNum}
        wallArea={surface === 'custom' || surface === 'floor' ? 0 : wallAreaNum}
        items={quoteItems}
        subtotal={subtotal}
        vat={vat}
        total={total}
        colourName={activeColourName}
        colourHex={useCustomColour ? (customColourHex || null) : selectedColour.hex}
      />
    </div>
  )
}
