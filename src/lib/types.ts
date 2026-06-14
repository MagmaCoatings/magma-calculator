// Database types (subset - expand as needed)
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Profile>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Product>
      }
      product_categories: {
        Row: ProductCategory
        Insert: Omit<ProductCategory, 'id' | 'created_at'>
        Update: Partial<ProductCategory>
      }
      colour_families: {
        Row: ColourFamily
        Insert: Omit<ColourFamily, 'id'>
        Update: Partial<ColourFamily>
      }
      colour_swatches: {
        Row: ColourSwatch
        Insert: Omit<ColourSwatch, 'id'>
        Update: Partial<ColourSwatch>
      }
      quotes: {
        Row: Quote
        Insert: Omit<Quote, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Quote>
      }
      login_logs: {
        Row: LoginLog
        Insert: Omit<LoginLog, 'id' | 'logged_in_at'>
        Update: Partial<LoginLog>
      }
    }
  }
}

export interface Profile {
  id: string
  email: string
  full_name: string
  company_name?: string
  phone?: string
  role: 'admin' | 'installer'
  status: 'active' | 'suspended' | 'pending'
  notes?: string
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  code: string
  name: string
  category_id?: string
  description?: string
  pack_size: number
  pack_unit: string
  coverage_rate?: number
  coverage_unit?: string
  coverage_note?: string
  price: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Joined
  category?: ProductCategory
}

export interface ProductCategory {
  id: string
  name: string
  display_order: number
  created_at: string
}

export interface ColourFamily {
  id: string
  name: string
  display_order: number
}

export interface ColourSwatch {
  id: string
  family_id: string
  name: string
  hex_code: string
  display_order: number
  is_active: boolean
  // Joined
  family?: ColourFamily
}

export interface Quote {
  id: string
  user_id: string
  job_reference?: string
  client_name?: string
  surface_type: 'floor' | 'wall' | 'both' | 'custom'
  floor_area?: number
  wall_area?: number
  build_config: CalculatorState
  colour_id?: string
  subtotal: number
  vat: number
  total: number
  wastage_percent: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface LoginLog {
  id: string
  user_id: string
  logged_in_at: string
  ip_address?: string
  city?: string
  country?: string
  user_agent?: string
  device_type?: string
  browser?: string
  os?: string
  is_suspicious: boolean
  suspicious_reason?: string
}

// Calculator state types
export interface CalculatorState {
  surface: 'floor' | 'wall' | 'both' | 'custom'
  floorArea: number
  wallArea: number
  wastagePercent: number
  
  // Floor config
  floorBuildType: 'bb' | 'std'
  floorFinish: '500' | '700'
  dpmType: 'std' | 'fast'
  includeMesh: boolean
  meshType: '62' | '88'
  includeQuartz: boolean
  includeQuartzStd: boolean
  baseChoice: 'bondprime' | 'magma200'
  bondprimeApplication: 'mesh' | 'epoxy'
  bondprimeIncludeQuartz: boolean
  
  // Magma 200 floor
  magma200FloorCoats: 1 | 2
  magma200FloorPigment: boolean
  
  // Magma 300 floor
  includeMagma300Floor: boolean
  magma300FloorCoats: 1 | 2
  magma300FloorPigment: boolean
  
  // Finish coats floor
  floorMagma500Coats: 1 | 2
  floorMagma700Coats: 1 | 2
  floorFinishPigment: boolean
  floorPoreFiller: boolean
  floorPoreFillerType: 'xero' | 'epgela'
  
  // Wall config
  wallBuildType: 'bb' | 'std'
  wallFinish: '500' | '700'
  wallPrimer: '180' | '200' | '250'
  includeWallMesh: boolean
  
  // Liquid membrane wall
  includeLiquidMembraneWall: boolean
  liquidMembraneWallArea: number
  liquidMembraneWallLayers: 2 | 3
  
  // Magma 200 wall
  includeMagma200Wall: boolean
  magma200WallCoats: 1 | 2
  magma200WallPigment: boolean
  
  // Magma 300 wall
  includeMagma300Wall: boolean
  magma300WallCoats: 1 | 2
  magma300WallPigment: boolean
  
  // Finish coats wall
  wallMagma500Coats: 1 | 2
  wallMagma700Coats: 1 | 2
  wallFinishPigment: boolean
  wallPoreFiller: boolean
  wallPoreFillerType: 'xero' | 'epgela'
  
  // Shared
  sealerType: 'matt' | 'satin'
  selectedColour: { id?: string; name: string; hex: string }
  includeDelivery: boolean
  
  // Custom builder
  custom: CustomBuilderState
}

export interface CustomBuilderState {
  area: number
  includePrimer180: boolean
  primer180Area: number
  includePrimer200: boolean
  primer200Area: number
  includePrimer250: boolean
  primer250Area: number
  includeLiquidMembrane: boolean
  liquidMembraneArea: number
  liquidMembraneLayers: 2 | 3
  includeDpm: boolean
  dpmArea: number
  dpmType: 'std' | 'fast'
  dpmCoverage: '250' | '750'
  includeMesh: boolean
  meshArea: number
  meshType: '62' | '88'
  includeQuartz: boolean
  quartzArea: number
  includeBondprime: boolean
  bondprimeArea: number
  bondprimeApplication: 'mesh' | 'epoxy'
  bondprimeIncludeQuartz: boolean
  includeMagma200: boolean
  magma200Coats: 1 | 2
  magma200Pigment: boolean
  includeMagma300: boolean
  magma300Coats: 1 | 2
  magma300Pigment: boolean
  includeMagma500: boolean
  magma500Coats: 1 | 2
  includeMagma700: boolean
  magma700Coats: 1 | 2
  includeXeroPore: boolean
  includeEpGela: boolean
  includeSeal: boolean
}

export interface LineItem {
  name: string
  qty: string
  units: number
  unitSize: string
  cost: number
}

export interface CalculationResult {
  items: LineItem[]
  pigmentPacks: number
  sealKg: number
}
