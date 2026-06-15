// Colour families matching the original HTML calculator
export interface Colour {
  name: string
  hex: string
  family: string
}

export interface ColourFamily {
  family: string
  shades: Colour[]
}

// Exact colours from magma_calculator_v5.html
export const colourFamilies: ColourFamily[] = [
  {
    family: 'Natural',
    shades: [
      { name: 'Natural (No Pigment)', hex: '#F5F5F0', family: 'Natural' }
    ]
  },
  {
    family: 'Grey',
    shades: [
      { name: 'Grey 1', hex: '#E8E6E0', family: 'Grey' },
      { name: 'Grey 2', hex: '#DCDAD4', family: 'Grey' },
      { name: 'Grey 3', hex: '#C8C4BC', family: 'Grey' },
      { name: 'Grey 4', hex: '#A8A69E', family: 'Grey' },
      { name: 'Grey 5', hex: '#8A8880', family: 'Grey' },
      { name: 'Grey 6', hex: '#6E6C66', family: 'Grey' }
    ]
  },
  {
    family: 'Plume',
    shades: [
      { name: 'Plume 1', hex: '#E4DED8', family: 'Plume' },
      { name: 'Plume 2', hex: '#D4CCC4', family: 'Plume' },
      { name: 'Plume 3', hex: '#C4B8B0', family: 'Plume' },
      { name: 'Plume 4', hex: '#A8988C', family: 'Plume' },
      { name: 'Plume 5', hex: '#988478', family: 'Plume' }
    ]
  },
  {
    family: 'Earth',
    shades: [
      { name: 'Earth 1', hex: '#E8E2D4', family: 'Earth' },
      { name: 'Earth 2', hex: '#DCD4C4', family: 'Earth' },
      { name: 'Earth 3', hex: '#D0C8B4', family: 'Earth' },
      { name: 'Earth 4', hex: '#C4B89C', family: 'Earth' },
      { name: 'Earth 5', hex: '#B4A888', family: 'Earth' }
    ]
  },
  {
    family: 'Nectar',
    shades: [
      { name: 'Nectar 1', hex: '#FAF6E8', family: 'Nectar' },
      { name: 'Nectar 2', hex: '#F6F2E0', family: 'Nectar' },
      { name: 'Nectar 3', hex: '#F2EED8', family: 'Nectar' },
      { name: 'Nectar 4', hex: '#EEE8CC', family: 'Nectar' },
      { name: 'Nectar 5', hex: '#E8E2C0', family: 'Nectar' },
      { name: 'Nectar 6', hex: '#E0D8AC', family: 'Nectar' }
    ]
  },
  {
    family: 'Frost',
    shades: [
      { name: 'Frost 1', hex: '#F0F4F6', family: 'Frost' },
      { name: 'Frost 2', hex: '#E0E8EC', family: 'Frost' },
      { name: 'Frost 3', hex: '#C8D4DC', family: 'Frost' },
      { name: 'Frost 4', hex: '#A8B8C4', family: 'Frost' }
    ]
  },
  {
    family: 'Relic',
    shades: [
      { name: 'Relic 1', hex: '#E4E8E4', family: 'Relic' },
      { name: 'Relic 2', hex: '#D0D4D0', family: 'Relic' },
      { name: 'Relic 3', hex: '#B0B8B0', family: 'Relic' },
      { name: 'Relic 4', hex: '#949C94', family: 'Relic' }
    ]
  }
]

// Flat list of all colours
export const allColours: Colour[] = colourFamilies.flatMap(f => f.shades)

// Default colour
export const defaultColour: Colour = { name: 'Grey 1', hex: '#E8E6E0', family: 'Grey' }

// Natural colour (no pigment)
export const naturalColour: Colour = { name: 'Natural (No Pigment)', hex: '#F5F5F0', family: 'Natural' }

// Hook for components
export function useColours() {
  return {
    families: colourFamilies,
    all: allColours,
    default: defaultColour,
    natural: naturalColour,
    isNatural: (colour: Colour) => colour.family === 'Natural'
  }
}

// Custom colour type for special colours (Farrow & Ball, Little Greene, etc.)
export interface CustomColour {
  id?: string
  name: string
  hex: string
  brand?: string // e.g., "Farrow & Ball", "Little Greene"
}

// Validate hex colour
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex)
}
