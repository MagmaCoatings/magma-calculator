/**
 * Format currency with commas (e.g., £1,903.92)
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format number with commas (e.g., 1,234)
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-GB')
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format date and time for display
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Human label for a quote's surface type
 */
export function surfaceLabel(surfaceType: string): string {
  switch (surfaceType) {
    case 'floor': return 'Floor'
    case 'wall': return 'Wall'
    case 'both': return 'Floor + Wall'
    case 'custom': return 'Build Your Own'
    default: return surfaceType
  }
}

/**
 * Area summary for a quote (Build Your Own stores its single area in floor_area)
 */
export function areaLabel(surfaceType: string, floorArea: number, wallArea: number): string {
  if (surfaceType === 'floor' || surfaceType === 'custom') return `${floorArea}m²`
  if (surfaceType === 'wall') return `${wallArea}m²`
  return `${floorArea}m² floor + ${wallArea}m² wall`
}

/**
 * VAT rate implied by a saved quote, falling back when the subtotal is zero
 */
export function quoteVatRate(subtotal: number, vat: number, fallback = 0.2): number {
  return subtotal > 0 ? Math.round((vat / subtotal) * 1000) / 1000 : fallback
}

/**
 * "VAT (20%)" style label from a rate such as 0.2
 */
export function vatLabel(rate: number): string {
  return `VAT (${Math.round(rate * 100)}%)`
}

/**
 * Round money to whole pennies
 */
export function pennies(amount: number): number {
  return Math.round(amount * 100) / 100
}
