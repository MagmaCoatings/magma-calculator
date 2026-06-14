import { useState } from 'react'
import { useProducts, useColours } from '@/hooks/useProducts'
import { calculateFloor, calculateWall, getDefaultCalculatorState, getProductByCode } from '@/lib/calculations'
import { formatCurrency } from '@/lib/formatters'
import type { CalculatorState, LineItem, Product } from '@/lib/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'

export function Calculator() {
  const { products, loading: productsLoading } = useProducts()
  const { coloursByFamily, loading: coloursLoading } = useColours()
  const [state, setState] = useState<CalculatorState>(getDefaultCalculatorState())
  const [copied, setCopied] = useState(false)

  if (productsLoading || coloursLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Calculate results
  const floorResult = (state.surface === 'floor' || state.surface === 'both')
    ? calculateFloor(state, products)
    : null
  
  const wallResult = (state.surface === 'wall' || state.surface === 'both')
    ? calculateWall(state, products)
    : null

  // Combine results
  let allItems: LineItem[] = []
  let totalPigmentPacks = 0
  let totalSealKg = 0

  if (floorResult) {
    allItems = [...allItems, ...floorResult.items]
    totalPigmentPacks += floorResult.pigmentPacks
    totalSealKg += floorResult.sealKg
  }

  if (wallResult) {
    allItems = [...allItems, ...wallResult.items]
    totalPigmentPacks += wallResult.pigmentPacks
    totalSealKg += wallResult.sealKg
  }

  // Add pigment
  const pigmentProduct = getProductByCode(products, 'pigment')
  if (totalPigmentPacks > 0 && pigmentProduct) {
    allItems.push({
      name: `Pigment - ${state.selectedColour.name}`,
      qty: `${totalPigmentPacks} pots`,
      units: totalPigmentPacks,
      unitSize: 'pot',
      cost: totalPigmentPacks * pigmentProduct.price,
    })
  }

  // Add sealer
  const sealProduct = getProductByCode(products, state.sealerType === 'matt' ? 'pu_seal_matt' : 'pu_seal_satin')
  if (totalSealKg > 0 && sealProduct) {
    const sealUnits = Math.ceil(totalSealKg / sealProduct.pack_size)
    allItems.push({
      name: sealProduct.name,
      qty: `${totalSealKg.toFixed(1)}kg (2 coats)`,
      units: sealUnits,
      unitSize: `${sealProduct.pack_size}kg`,
      cost: sealUnits * sealProduct.price,
    })
  }

  // Calculate totals
  const subtotal = allItems.reduce((sum, item) => sum + item.cost, 0)
  const vat = subtotal * 0.2
  const total = subtotal + vat

  const totalArea = state.surface === 'floor' ? state.floorArea
    : state.surface === 'wall' ? state.wallArea
    : state.floorArea + state.wallArea

  const costPerM2 = subtotal / totalArea

  // Update a single state property
  const update = <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }

  // Copy shopping list
  const copyList = () => {
    let text = 'MAGMA CALCULATOR - Shopping List\n'
    text += '================================\n\n'
    
    allItems.forEach(item => {
      text += `${item.units}× ${item.name} (${item.unitSize}) - £${formatCurrency(item.cost)}\n`
    })

    text += `\nSubtotal: £${formatCurrency(subtotal)}`
    text += `\nVAT: £${formatCurrency(vat)}`
    text += `\nTOTAL: £${formatCurrency(total)}`
    text += `\n\nCost per m² (ex VAT): £${formatCurrency(costPerM2)}`
    text += `\n\n* Includes ${state.wastagePercent}% wastage allowance`

    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 grid lg:grid-cols-[1fr,380px] gap-6">
      {/* Configuration Panel */}
      <div className="space-y-4">
        {/* Surface selector */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Surface type</h2>
          <div className="flex flex-wrap gap-2">
            {(['floor', 'wall', 'both'] as const).map(surface => (
              <button
                key={surface}
                className={`toggle-btn ${state.surface === surface ? 'active' : ''}`}
                onClick={() => update('surface', surface)}
              >
                {surface === 'floor' ? 'Floor Only' : surface === 'wall' ? 'Wall Only' : 'Floor + Wall'}
              </button>
            ))}
          </div>
        </Card>

        {/* Area inputs */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Area</h2>
          <div className="flex flex-wrap gap-4">
            {(state.surface === 'floor' || state.surface === 'both') && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Floor:</label>
                <input
                  type="number"
                  value={state.floorArea}
                  onChange={e => update('floorArea', parseFloat(e.target.value) || 1)}
                  min={1}
                  max={500}
                  className="w-20 h-9 px-3 rounded-lg border border-gray-200 text-sm"
                />
                <span className="text-sm text-gray-500">m²</span>
              </div>
            )}
            {(state.surface === 'wall' || state.surface === 'both') && (
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600">Wall:</label>
                <input
                  type="number"
                  value={state.wallArea}
                  onChange={e => update('wallArea', parseFloat(e.target.value) || 1)}
                  min={1}
                  max={500}
                  className="w-20 h-9 px-3 rounded-lg border border-gray-200 text-sm"
                />
                <span className="text-sm text-gray-500">m²</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Wastage:</label>
              <input
                type="number"
                value={state.wastagePercent}
                onChange={e => update('wastagePercent', parseFloat(e.target.value) || 0)}
                min={0}
                max={50}
                className="w-16 h-9 px-3 rounded-lg border border-gray-200 text-sm"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
        </Card>

        {/* Floor configuration */}
        {(state.surface === 'floor' || state.surface === 'both') && (
          <FloorConfig state={state} update={update} />
        )}

        {/* Wall configuration */}
        {(state.surface === 'wall' || state.surface === 'both') && (
          <WallConfig state={state} update={update} />
        )}

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
                        state.selectedColour.name === swatch.name
                          ? 'border-charcoal scale-110'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ backgroundColor: swatch.hex_code }}
                      onClick={() => update('selectedColour', {
                        id: swatch.id,
                        name: swatch.name,
                        hex: swatch.hex_code,
                      })}
                      title={swatch.name}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-3">
            Selected: <strong>{state.selectedColour.name}</strong>
          </p>
        </Card>

        {/* Sealer type */}
        <Card className="p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Sealer finish</h2>
          <div className="flex gap-2">
            <button
              className={`toggle-btn ${state.sealerType === 'matt' ? 'active' : ''}`}
              onClick={() => update('sealerType', 'matt')}
            >
              Matt
            </button>
            <button
              className={`toggle-btn ${state.sealerType === 'satin' ? 'active' : ''}`}
              onClick={() => update('sealerType', 'satin')}
            >
              Satin
            </button>
          </div>
        </Card>
      </div>

      {/* Results Panel */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <Card className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Materials - {totalArea}m² {state.surface === 'both' ? 'floor + wall' : state.surface}
          </h2>

          <div className="space-y-2 mb-4">
            {allItems.map((item, i) => (
              <div key={i} className="flex justify-between text-sm py-2 border-b border-gray-100">
                <div>
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-gray-500 text-xs">{item.qty} → {item.units}× {item.unitSize}</p>
                </div>
                <p className="font-medium text-gray-900">£{formatCurrency(item.cost)}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-4 border-t border-gray-200">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal (ex VAT)</span>
              <span className="font-medium">£{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">VAT (20%)</span>
              <span className="font-medium">£{formatCurrency(vat)}</span>
            </div>
            {state.includeDelivery && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Pallet delivery</span>
                <span className="text-gray-500">TBC</span>
              </div>
            )}
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
              <span>Total (inc VAT)</span>
              <span className="text-magma">£{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-100">
              <span className="text-gray-600">Cost per m² (ex VAT)</span>
              <span className="font-semibold">£{formatCurrency(costPerM2)}</span>
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <Button className="w-full gap-2" onClick={copyList}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy shopping list'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

// Floor configuration component
function FloorConfig({ state, update }: {
  state: CalculatorState
  update: <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => void
}) {
  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-sm font-medium text-gray-500">Floor configuration</h2>

      {/* Build type */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Build type</p>
        <div className="flex gap-2">
          <button
            className={`toggle-btn ${state.floorBuildType === 'bb' ? 'active' : ''}`}
            onClick={() => update('floorBuildType', 'bb')}
          >
            Belt & Braces
          </button>
          <button
            className={`toggle-btn ${state.floorBuildType === 'std' ? 'active' : ''}`}
            onClick={() => update('floorBuildType', 'std')}
          >
            Standard
          </button>
        </div>
      </div>

      {/* Finish */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Finish coat</p>
        <div className="flex gap-2">
          <button
            className={`toggle-btn ${state.floorFinish === '500' ? 'active' : ''}`}
            onClick={() => update('floorFinish', '500')}
          >
            500 Medium
          </button>
          <button
            className={`toggle-btn ${state.floorFinish === '700' ? 'active' : ''}`}
            onClick={() => update('floorFinish', '700')}
          >
            700 Smooth
          </button>
        </div>
      </div>

      {/* DPM Type */}
      <div className="layer-card">
        <p className="text-sm font-medium mb-2">DPM Epoxy Primer</p>
        <div className="flex gap-2">
          <button
            className={`choice-btn ${state.dpmType === 'std' ? 'active' : ''}`}
            onClick={() => update('dpmType', 'std')}
          >
            Standard Cure
          </button>
          <button
            className={`choice-btn ${state.dpmType === 'fast' ? 'active' : ''}`}
            onClick={() => update('dpmType', 'fast')}
          >
            Fast Cure
          </button>
        </div>
      </div>

      {/* B&B Mesh */}
      {state.floorBuildType === 'bb' && (
        <div className="layer-card">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm font-medium">Fibreglass Mesh</p>
            <button
              className={`layer-toggle ${state.includeMesh ? 'on' : ''}`}
              onClick={() => update('includeMesh', !state.includeMesh)}
            />
          </div>
          {state.includeMesh && (
            <div className="flex gap-2">
              <button
                className={`choice-btn ${state.meshType === '62' ? 'active' : ''}`}
                onClick={() => update('meshType', '62')}
              >
                Mesh 62
              </button>
              <button
                className={`choice-btn ${state.meshType === '88' ? 'active' : ''}`}
                onClick={() => update('meshType', '88')}
              >
                Mesh 88
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quartz */}
      {state.floorBuildType === 'bb' && (
        <div className="layer-card">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">Quartz Blinding</p>
            <button
              className={`layer-toggle ${state.includeQuartz ? 'on' : ''}`}
              onClick={() => update('includeQuartz', !state.includeQuartz)}
            />
          </div>
        </div>
      )}

      {state.floorBuildType === 'std' && (
        <div className="layer-card">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium">Quartz Blinding (optional)</p>
            <button
              className={`layer-toggle ${state.includeQuartzStd ? 'on' : ''}`}
              onClick={() => update('includeQuartzStd', !state.includeQuartzStd)}
            />
          </div>
        </div>
      )}

      {/* Base coat */}
      <div className="layer-card">
        <p className="text-sm font-medium mb-2">Base coat</p>
        <div className="flex gap-2 mb-3">
          <button
            className={`choice-btn ${state.baseChoice === 'bondprime' ? 'active' : ''}`}
            onClick={() => update('baseChoice', 'bondprime')}
          >
            BondPrime SC
          </button>
          <button
            className={`choice-btn ${state.baseChoice === 'magma200' ? 'active' : ''}`}
            onClick={() => update('baseChoice', 'magma200')}
          >
            Magma 200 XL
          </button>
        </div>

        {state.baseChoice === 'bondprime' && (
          <>
            <div className="flex gap-2 mb-2">
              <button
                className={`choice-btn ${state.bondprimeApplication === 'mesh' ? 'active' : ''}`}
                onClick={() => update('bondprimeApplication', 'mesh')}
              >
                Over Mesh (1.5kg/m²)
              </button>
              <button
                className={`choice-btn ${state.bondprimeApplication === 'epoxy' ? 'active' : ''}`}
                onClick={() => update('bondprimeApplication', 'epoxy')}
              >
                Over Epoxy/Quartz (1kg/m²)
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Include Quartz</span>
              <button
                className={`layer-toggle ${state.bondprimeIncludeQuartz ? 'on' : ''}`}
                onClick={() => update('bondprimeIncludeQuartz', !state.bondprimeIncludeQuartz)}
                style={{ width: 40, height: 22 }}
              />
            </div>
          </>
        )}

        {state.baseChoice === 'magma200' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Coats:</span>
              <button
                className={`coat-btn ${state.magma200FloorCoats === 1 ? 'active' : ''}`}
                onClick={() => update('magma200FloorCoats', 1)}
              >
                1
              </button>
              <button
                className={`coat-btn ${state.magma200FloorCoats === 2 ? 'active' : ''}`}
                onClick={() => update('magma200FloorCoats', 2)}
              >
                2
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Add pigment</span>
              <button
                className={`layer-toggle ${state.magma200FloorPigment ? 'on' : ''}`}
                onClick={() => update('magma200FloorPigment', !state.magma200FloorPigment)}
                style={{ width: 40, height: 22 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Magma 300 */}
      <div className="layer-card">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Magma 300 Large</p>
          <button
            className={`layer-toggle ${state.includeMagma300Floor ? 'on' : ''}`}
            onClick={() => update('includeMagma300Floor', !state.includeMagma300Floor)}
          />
        </div>
        {state.includeMagma300Floor && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Coats:</span>
              <button
                className={`coat-btn ${state.magma300FloorCoats === 1 ? 'active' : ''}`}
                onClick={() => update('magma300FloorCoats', 1)}
              >
                1
              </button>
              <button
                className={`coat-btn ${state.magma300FloorCoats === 2 ? 'active' : ''}`}
                onClick={() => update('magma300FloorCoats', 2)}
              >
                2
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Add pigment</span>
              <button
                className={`layer-toggle ${state.magma300FloorPigment ? 'on' : ''}`}
                onClick={() => update('magma300FloorPigment', !state.magma300FloorPigment)}
                style={{ width: 40, height: 22 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Finish coat pigment */}
      <div className="layer-card">
        <p className="text-sm font-medium mb-2">
          Magma {state.floorFinish} {state.floorFinish === '500' ? 'Medium' : 'Smooth'}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Coats:</span>
            {state.floorFinish === '500' ? (
              <>
                <button
                  className={`coat-btn ${state.floorMagma500Coats === 1 ? 'active' : ''}`}
                  onClick={() => update('floorMagma500Coats', 1)}
                >
                  1
                </button>
                <button
                  className={`coat-btn ${state.floorMagma500Coats === 2 ? 'active' : ''}`}
                  onClick={() => update('floorMagma500Coats', 2)}
                >
                  2
                </button>
              </>
            ) : (
              <>
                <button
                  className={`coat-btn ${state.floorMagma700Coats === 1 ? 'active' : ''}`}
                  onClick={() => update('floorMagma700Coats', 1)}
                >
                  1
                </button>
                <button
                  className={`coat-btn ${state.floorMagma700Coats === 2 ? 'active' : ''}`}
                  onClick={() => update('floorMagma700Coats', 2)}
                >
                  2
                </button>
              </>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Add pigment</span>
            <button
              className={`layer-toggle ${state.floorFinishPigment ? 'on' : ''}`}
              onClick={() => update('floorFinishPigment', !state.floorFinishPigment)}
              style={{ width: 40, height: 22 }}
            />
          </div>
        </div>
      </div>

      {/* Pore filler */}
      <div className="layer-card">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Pore filler</p>
          <button
            className={`layer-toggle ${state.floorPoreFiller ? 'on' : ''}`}
            onClick={() => update('floorPoreFiller', !state.floorPoreFiller)}
          />
        </div>
        {state.floorPoreFiller && (
          <div className="flex gap-2">
            <button
              className={`choice-btn ${state.floorPoreFillerType === 'xero' ? 'active' : ''}`}
              onClick={() => update('floorPoreFillerType', 'xero')}
            >
              Xero Pore Filler
            </button>
            <button
              className={`choice-btn ${state.floorPoreFillerType === 'epgela' ? 'active' : ''}`}
              onClick={() => update('floorPoreFillerType', 'epgela')}
            >
              EP Gela
            </button>
          </div>
        )}
      </div>
    </Card>
  )
}

// Wall configuration (simplified - similar pattern to floor)
function WallConfig({ state, update }: {
  state: CalculatorState
  update: <K extends keyof CalculatorState>(key: K, value: CalculatorState[K]) => void
}) {
  return (
    <Card className="p-4 space-y-4">
      <h2 className="text-sm font-medium text-gray-500">Wall configuration</h2>

      {/* Build type */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Build type</p>
        <div className="flex gap-2">
          <button
            className={`toggle-btn ${state.wallBuildType === 'bb' ? 'active' : ''}`}
            onClick={() => update('wallBuildType', 'bb')}
          >
            Belt & Braces
          </button>
          <button
            className={`toggle-btn ${state.wallBuildType === 'std' ? 'active' : ''}`}
            onClick={() => update('wallBuildType', 'std')}
          >
            Standard
          </button>
        </div>
      </div>

      {/* Finish */}
      <div>
        <p className="text-xs text-gray-400 mb-2">Finish coat</p>
        <div className="flex gap-2">
          <button
            className={`toggle-btn ${state.wallFinish === '500' ? 'active' : ''}`}
            onClick={() => update('wallFinish', '500')}
          >
            500 Medium
          </button>
          <button
            className={`toggle-btn ${state.wallFinish === '700' ? 'active' : ''}`}
            onClick={() => update('wallFinish', '700')}
          >
            700 Smooth
          </button>
        </div>
      </div>

      {/* Wall primer */}
      <div className="layer-card">
        <p className="text-sm font-medium mb-2">Wall Primer</p>
        <div className="flex gap-2">
          <button
            className={`choice-btn ${state.wallPrimer === '180' ? 'active' : ''}`}
            onClick={() => update('wallPrimer', '180')}
          >
            Primer 180
          </button>
          <button
            className={`choice-btn ${state.wallPrimer === '200' ? 'active' : ''}`}
            onClick={() => update('wallPrimer', '200')}
          >
            Primer 200
          </button>
          <button
            className={`choice-btn ${state.wallPrimer === '250' ? 'active' : ''}`}
            onClick={() => update('wallPrimer', '250')}
          >
            Primer 250 Grit
          </button>
        </div>
      </div>

      {/* Magma 300 Wall */}
      <div className="layer-card">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium">Magma 300 Large</p>
          <button
            className={`layer-toggle ${state.includeMagma300Wall ? 'on' : ''}`}
            onClick={() => update('includeMagma300Wall', !state.includeMagma300Wall)}
          />
        </div>
        {state.includeMagma300Wall && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Coats:</span>
              <button
                className={`coat-btn ${state.magma300WallCoats === 1 ? 'active' : ''}`}
                onClick={() => update('magma300WallCoats', 1)}
              >
                1
              </button>
              <button
                className={`coat-btn ${state.magma300WallCoats === 2 ? 'active' : ''}`}
                onClick={() => update('magma300WallCoats', 2)}
              >
                2
              </button>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Add pigment</span>
              <button
                className={`layer-toggle ${state.magma300WallPigment ? 'on' : ''}`}
                onClick={() => update('magma300WallPigment', !state.magma300WallPigment)}
                style={{ width: 40, height: 22 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Wall finish coat */}
      <div className="layer-card">
        <p className="text-sm font-medium mb-2">
          Magma {state.wallFinish} {state.wallFinish === '500' ? 'Medium' : 'Smooth'}
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Coats:</span>
            {state.wallFinish === '500' ? (
              <>
                <button
                  className={`coat-btn ${state.wallMagma500Coats === 1 ? 'active' : ''}`}
                  onClick={() => update('wallMagma500Coats', 1)}
                >
                  1
                </button>
                <button
                  className={`coat-btn ${state.wallMagma500Coats === 2 ? 'active' : ''}`}
                  onClick={() => update('wallMagma500Coats', 2)}
                >
                  2
                </button>
              </>
            ) : (
              <>
                <button
                  className={`coat-btn ${state.wallMagma700Coats === 1 ? 'active' : ''}`}
                  onClick={() => update('wallMagma700Coats', 1)}
                >
                  1
                </button>
                <button
                  className={`coat-btn ${state.wallMagma700Coats === 2 ? 'active' : ''}`}
                  onClick={() => update('wallMagma700Coats', 2)}
                >
                  2
                </button>
              </>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Add pigment</span>
            <button
              className={`layer-toggle ${state.wallFinishPigment ? 'on' : ''}`}
              onClick={() => update('wallFinishPigment', !state.wallFinishPigment)}
              style={{ width: 40, height: 22 }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}
