import type { CalculatorState, CalculationResult, LineItem, Product } from './types'

// Product lookup by code
export function getProductByCode(products: Product[], code: string): Product | undefined {
  return products.find(p => p.code === code)
}

// Apply wastage
function applyWastage(kg: number, wastagePercent: number): number {
  return kg * (1 + wastagePercent / 100)
}

// Calculate seal kg needed (5kg covers 60m² per coat, 2 coats)
function calcSealKg(area: number, wastagePercent: number): number {
  const kgPerCoat = (area / 60) * 5
  return applyWastage(kgPerCoat * 2, wastagePercent)
}

// Calculate liquid membrane (pick best pack size)
function calcLiquidMembrane(
  area: number,
  layers: number,
  wastagePercent: number,
  products: Product[]
): LineItem | null {
  const totalKg = applyWastage(area * 0.15 * layers, wastagePercent)
  
  let packSize: number
  let price: number
  let productCode: string
  
  if (totalKg <= 5) {
    packSize = 5
    price = getProductByCode(products, 'liquid_membrane_5')?.price ?? 159
    productCode = 'liquid_membrane_5'
  } else if (totalKg <= 10) {
    packSize = 10
    price = getProductByCode(products, 'liquid_membrane_10')?.price ?? 266
    productCode = 'liquid_membrane_10'
  } else {
    packSize = 20
    price = getProductByCode(products, 'liquid_membrane_20')?.price ?? 441
    productCode = 'liquid_membrane_20'
  }
  
  const units = Math.ceil(totalKg / packSize)
  
  return {
    name: `Liquid Membrane ${packSize}L`,
    qty: `${totalKg.toFixed(1)}L (${layers} layers)`,
    units,
    unitSize: `${packSize}L`,
    cost: units * price,
  }
}

// Calculate floor items
export function calculateFloor(
  state: CalculatorState,
  products: Product[]
): CalculationResult {
  const area = state.floorArea
  const wastage = state.wastagePercent
  const items: LineItem[] = []
  let pigmentPacks = 0

  // DPM: 750g/m² (B&B over mesh) or 250g/m² (Std)
  const dpmCoverage = state.floorBuildType === 'bb' ? 0.75 : 0.25
  const dpmKg = applyWastage(area * dpmCoverage, wastage)
  const dpmProduct = getProductByCode(products, state.dpmType === 'fast' ? 'dpm_fast' : 'dpm_std')
  if (dpmProduct) {
    const dpmUnits = Math.ceil(dpmKg / dpmProduct.pack_size)
    items.push({
      name: dpmProduct.name,
      qty: `${dpmKg.toFixed(1)}kg`,
      units: dpmUnits,
      unitSize: `${dpmProduct.pack_size}kg`,
      cost: dpmUnits * dpmProduct.price,
    })
  }

  // B&B Mesh
  if (state.floorBuildType === 'bb' && state.includeMesh) {
    const meshProduct = getProductByCode(products, state.meshType === '88' ? 'mesh_88' : 'mesh_62')
    if (meshProduct) {
      const meshArea = applyWastage(area, wastage)
      const meshRolls = Math.ceil(meshArea / 50)
      items.push({
        name: meshProduct.name,
        qty: `${meshArea.toFixed(1)}m²`,
        units: meshRolls,
        unitSize: '50m roll',
        cost: meshRolls * meshProduct.price,
      })
    }
  }

  // B&B Quartz blinding
  if (state.floorBuildType === 'bb' && state.includeQuartz) {
    const quartzProduct = getProductByCode(products, 'quartz')
    if (quartzProduct) {
      const quartzArea = applyWastage(area, wastage)
      const quartzBags = Math.ceil(quartzArea / 6)
      items.push({
        name: quartzProduct.name + ' (blinding)',
        qty: `${quartzArea.toFixed(1)}m²`,
        units: quartzBags,
        unitSize: '25kg',
        cost: quartzBags * quartzProduct.price,
      })
    }
  }

  // Standard mode Quartz blinding
  if (state.floorBuildType === 'std' && state.includeQuartzStd) {
    const quartzProduct = getProductByCode(products, 'quartz')
    if (quartzProduct) {
      const quartzArea = applyWastage(area, wastage)
      const quartzBags = Math.ceil(quartzArea / 6)
      items.push({
        name: quartzProduct.name + ' (blinding)',
        qty: `${quartzArea.toFixed(1)}m²`,
        units: quartzBags,
        unitSize: '25kg',
        cost: quartzBags * quartzProduct.price,
      })
    }
  }

  // Base coat
  if (state.baseChoice === 'bondprime') {
    const bpCoverage = state.bondprimeApplication === 'mesh' ? 1.5 : 1
    const bpKg = applyWastage(area * bpCoverage, wastage)
    const bpProduct = getProductByCode(products, 'bondprime')
    if (bpProduct) {
      const bpUnits = Math.ceil(bpKg / bpProduct.pack_size)
      items.push({
        name: bpProduct.name,
        qty: `${bpKg.toFixed(1)}kg`,
        units: bpUnits,
        unitSize: '10kg',
        cost: bpUnits * bpProduct.price,
      })
    }

    // Optional quartz with BondPrime
    if (state.bondprimeIncludeQuartz) {
      const quartzProduct = getProductByCode(products, 'quartz')
      if (quartzProduct) {
        const quartzArea = applyWastage(area, wastage)
        const quartzBags = Math.ceil(quartzArea / 6)
        items.push({
          name: quartzProduct.name + ' (for BP)',
          qty: `${quartzArea.toFixed(1)}m²`,
          units: quartzBags,
          unitSize: '25kg',
          cost: quartzBags * quartzProduct.price,
        })
      }
    }
  } else {
    // Magma 200 XL as base
    const m200Kg = applyWastage(area * 2 * state.magma200FloorCoats, wastage)
    const m200Product = getProductByCode(products, 'magma_200')
    if (m200Product) {
      const m200Units = Math.ceil(m200Kg / m200Product.pack_size)
      items.push({
        name: m200Product.name,
        qty: `${m200Kg.toFixed(1)}kg (${state.magma200FloorCoats} coat${state.magma200FloorCoats > 1 ? 's' : ''})`,
        units: m200Units,
        unitSize: '20kg',
        cost: m200Units * m200Product.price,
      })
      if (state.magma200FloorPigment) pigmentPacks += m200Units
    }
  }

  // Magma 300 Large
  if (state.includeMagma300Floor) {
    const m300Kg = applyWastage(area * 1 * state.magma300FloorCoats, wastage)
    const m300Product = getProductByCode(products, 'magma_300')
    if (m300Product) {
      const m300Units = Math.ceil(m300Kg / 20)
      items.push({
        name: m300Product.name,
        qty: `${m300Kg.toFixed(1)}kg (${state.magma300FloorCoats} coat${state.magma300FloorCoats > 1 ? 's' : ''})`,
        units: m300Units,
        unitSize: '20kg',
        cost: m300Units * m300Product.price,
      })
      if (state.magma300FloorPigment) pigmentPacks += m300Units
    }
  }

  // Finish coat
  if (state.floorFinish === '500') {
    const mKg = applyWastage(area * 0.6 * state.floorMagma500Coats, wastage)
    const mProduct = getProductByCode(products, 'magma_500')
    if (mProduct) {
      const mUnits = Math.ceil(mKg / 20)
      items.push({
        name: mProduct.name,
        qty: `${mKg.toFixed(1)}kg (${state.floorMagma500Coats} coat${state.floorMagma500Coats > 1 ? 's' : ''})`,
        units: mUnits,
        unitSize: '20kg',
        cost: mUnits * mProduct.price,
      })
      if (state.floorFinishPigment) pigmentPacks += mUnits
    }
  } else {
    const mKg = applyWastage(area * 0.35 * state.floorMagma700Coats, wastage)
    const mProduct = getProductByCode(products, 'magma_700')
    if (mProduct) {
      const mUnits = Math.ceil(mKg / 20)
      items.push({
        name: mProduct.name,
        qty: `${mKg.toFixed(1)}kg (${state.floorMagma700Coats} coat${state.floorMagma700Coats > 1 ? 's' : ''})`,
        units: mUnits,
        unitSize: '20kg',
        cost: mUnits * mProduct.price,
      })
      if (state.floorFinishPigment) pigmentPacks += mUnits
    }
  }

  // Pore filler
  if (state.floorPoreFiller) {
    if (state.floorPoreFillerType === 'xero') {
      const xKg = applyWastage(area * 0.1, wastage)
      const xProduct = getProductByCode(products, 'xero_pore')
      if (xProduct) {
        const xUnits = Math.ceil(xKg / 2.5)
        items.push({
          name: xProduct.name,
          qty: `${xKg.toFixed(2)}kg`,
          units: xUnits,
          unitSize: '2.5kg',
          cost: xUnits * xProduct.price,
        })
      }
    } else {
      const gArea = applyWastage(area, wastage)
      const gProduct = getProductByCode(products, 'ep_gela')
      if (gProduct) {
        const gUnits = Math.ceil(gArea / 10)
        items.push({
          name: gProduct.name,
          qty: `${gArea.toFixed(1)}m²`,
          units: gUnits,
          unitSize: '0.6kg set',
          cost: gUnits * gProduct.price,
        })
      }
    }
  }

  return { items, pigmentPacks, sealKg: calcSealKg(area, wastage) }
}

// Calculate wall items
export function calculateWall(
  state: CalculatorState,
  products: Product[]
): CalculationResult {
  const area = state.wallArea
  const wastage = state.wastagePercent
  const items: LineItem[] = []
  let pigmentPacks = 0

  // Wall primer
  const primerCode = `primer_${state.wallPrimer}`
  const primerProduct = getProductByCode(products, primerCode)
  if (primerProduct) {
    const primerKg = applyWastage(area * 0.15, wastage)
    const primerUnits = Math.ceil(primerKg / primerProduct.pack_size)
    items.push({
      name: primerProduct.name,
      qty: `${primerKg.toFixed(1)}${primerProduct.pack_unit}`,
      units: primerUnits,
      unitSize: `${primerProduct.pack_size}${primerProduct.pack_unit}`,
      cost: primerUnits * primerProduct.price,
    })
  }

  // Liquid membrane
  if (state.includeLiquidMembraneWall) {
    const lmItem = calcLiquidMembrane(
      state.liquidMembraneWallArea,
      state.liquidMembraneWallLayers,
      wastage,
      products
    )
    if (lmItem) items.push(lmItem)
  }

  // B&B Mesh
  if (state.wallBuildType === 'bb' && state.includeWallMesh) {
    const meshProduct = getProductByCode(products, 'mesh_62')
    if (meshProduct) {
      const meshArea = applyWastage(area, wastage)
      const meshRolls = Math.ceil(meshArea / 50)
      items.push({
        name: meshProduct.name,
        qty: `${meshArea.toFixed(1)}m²`,
        units: meshRolls,
        unitSize: '50m roll',
        cost: meshRolls * meshProduct.price,
      })
    }
  }

  // Magma 200 XL
  if (state.wallBuildType === 'bb' || state.includeMagma200Wall) {
    const m200Kg = applyWastage(area * 2 * state.magma200WallCoats, wastage)
    const m200Product = getProductByCode(products, 'magma_200')
    if (m200Product) {
      const m200Units = Math.ceil(m200Kg / 20)
      items.push({
        name: m200Product.name,
        qty: `${m200Kg.toFixed(1)}kg (${state.magma200WallCoats} coat${state.magma200WallCoats > 1 ? 's' : ''})`,
        units: m200Units,
        unitSize: '20kg',
        cost: m200Units * m200Product.price,
      })
      if (state.magma200WallPigment) pigmentPacks += m200Units
    }
  }

  // Magma 300 Large
  if (state.includeMagma300Wall) {
    const m300Kg = applyWastage(area * 1 * state.magma300WallCoats, wastage)
    const m300Product = getProductByCode(products, 'magma_300')
    if (m300Product) {
      const m300Units = Math.ceil(m300Kg / 20)
      items.push({
        name: m300Product.name,
        qty: `${m300Kg.toFixed(1)}kg (${state.magma300WallCoats} coat${state.magma300WallCoats > 1 ? 's' : ''})`,
        units: m300Units,
        unitSize: '20kg',
        cost: m300Units * m300Product.price,
      })
      if (state.magma300WallPigment) pigmentPacks += m300Units
    }
  }

  // Finish coat
  if (state.wallFinish === '500') {
    const mKg = applyWastage(area * 0.6 * state.wallMagma500Coats, wastage)
    const mProduct = getProductByCode(products, 'magma_500')
    if (mProduct) {
      const mUnits = Math.ceil(mKg / 20)
      items.push({
        name: mProduct.name,
        qty: `${mKg.toFixed(1)}kg (${state.wallMagma500Coats} coat${state.wallMagma500Coats > 1 ? 's' : ''})`,
        units: mUnits,
        unitSize: '20kg',
        cost: mUnits * mProduct.price,
      })
      if (state.wallFinishPigment) pigmentPacks += mUnits
    }
  } else {
    const mKg = applyWastage(area * 0.35 * state.wallMagma700Coats, wastage)
    const mProduct = getProductByCode(products, 'magma_700')
    if (mProduct) {
      const mUnits = Math.ceil(mKg / 20)
      items.push({
        name: mProduct.name,
        qty: `${mKg.toFixed(1)}kg (${state.wallMagma700Coats} coat${state.wallMagma700Coats > 1 ? 's' : ''})`,
        units: mUnits,
        unitSize: '20kg',
        cost: mUnits * mProduct.price,
      })
      if (state.wallFinishPigment) pigmentPacks += mUnits
    }
  }

  // Pore filler
  if (state.wallPoreFiller) {
    if (state.wallPoreFillerType === 'xero') {
      const xKg = applyWastage(area * 0.1, wastage)
      const xProduct = getProductByCode(products, 'xero_pore')
      if (xProduct) {
        const xUnits = Math.ceil(xKg / 2.5)
        items.push({
          name: xProduct.name,
          qty: `${xKg.toFixed(2)}kg`,
          units: xUnits,
          unitSize: '2.5kg',
          cost: xUnits * xProduct.price,
        })
      }
    } else {
      const gArea = applyWastage(area, wastage)
      const gProduct = getProductByCode(products, 'ep_gela')
      if (gProduct) {
        const gUnits = Math.ceil(gArea / 10)
        items.push({
          name: gProduct.name,
          qty: `${gArea.toFixed(1)}m²`,
          units: gUnits,
          unitSize: '0.6kg set',
          cost: gUnits * gProduct.price,
        })
      }
    }
  }

  return { items, pigmentPacks, sealKg: calcSealKg(area, wastage) }
}

// Get default calculator state
export function getDefaultCalculatorState(): CalculatorState {
  return {
    surface: 'floor',
    floorArea: 20,
    wallArea: 28,
    wastagePercent: 10,
    
    floorBuildType: 'bb',
    floorFinish: '500',
    dpmType: 'std',
    includeMesh: true,
    meshType: '62',
    includeQuartz: true,
    includeQuartzStd: false,
    baseChoice: 'bondprime',
    bondprimeApplication: 'mesh',
    bondprimeIncludeQuartz: false,
    
    magma200FloorCoats: 1,
    magma200FloorPigment: false,
    includeMagma300Floor: true,
    magma300FloorCoats: 1,
    magma300FloorPigment: true,
    
    floorMagma500Coats: 2,
    floorMagma700Coats: 1,
    floorFinishPigment: true,
    floorPoreFiller: false,
    floorPoreFillerType: 'xero',
    
    wallBuildType: 'bb',
    wallFinish: '500',
    wallPrimer: '180',
    includeWallMesh: true,
    
    includeLiquidMembraneWall: false,
    liquidMembraneWallArea: 28,
    liquidMembraneWallLayers: 2,
    
    includeMagma200Wall: true,
    magma200WallCoats: 1,
    magma200WallPigment: false,
    includeMagma300Wall: true,
    magma300WallCoats: 1,
    magma300WallPigment: true,
    
    wallMagma500Coats: 2,
    wallMagma700Coats: 1,
    wallFinishPigment: true,
    wallPoreFiller: false,
    wallPoreFillerType: 'xero',
    
    sealerType: 'matt',
    selectedColour: { name: 'Grey 1', hex: '#E8E6E0' },
    includeDelivery: true,
    
    custom: {
      area: 20,
      includePrimer180: false,
      primer180Area: 20,
      includePrimer200: false,
      primer200Area: 20,
      includePrimer250: false,
      primer250Area: 20,
      includeLiquidMembrane: false,
      liquidMembraneArea: 20,
      liquidMembraneLayers: 2,
      includeDpm: false,
      dpmArea: 20,
      dpmType: 'std',
      dpmCoverage: '250',
      includeMesh: false,
      meshArea: 20,
      meshType: '62',
      includeQuartz: false,
      quartzArea: 20,
      includeBondprime: false,
      bondprimeArea: 20,
      bondprimeApplication: 'mesh',
      bondprimeIncludeQuartz: false,
      includeMagma200: false,
      magma200Coats: 1,
      magma200Pigment: false,
      includeMagma300: false,
      magma300Coats: 1,
      magma300Pigment: true,
      includeMagma500: false,
      magma500Coats: 2,
      includeMagma700: false,
      magma700Coats: 1,
      includeXeroPore: false,
      includeEpGela: false,
      includeSeal: true,
    },
  }
}
