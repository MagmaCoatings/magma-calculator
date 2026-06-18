// Basic types for the app - loosely typed to match actual DB schema
// TODO: Generate proper types with `supabase gen types typescript`

export interface Profile {
  id: string
  email: string
  full_name: string | null
  company_name: string | null
  role: 'admin' | 'installer'
  status: 'active' | 'suspended' | 'pending'
  show_tooltips?: boolean
  created_at: string
  updated_at: string
  // Extended contact details (from the Profile page)
  first_name?: string | null
  last_name?: string | null
  address_line1?: string | null
  address_line2?: string | null
  address_line3?: string | null
  town_city?: string | null
  postcode?: string | null
  phone?: string | null
  mobile?: string | null
  instagram_handle?: string | null
  facebook_url?: string | null
  website_url?: string | null
}

export interface Product {
  id: string
  name: string
  code: string
  sku: string | null
  description: string | null
  pack_size: number
  pack_unit: string
  price: number
  category_id: string | null
  category: string | null
  is_active: boolean
  display_order: number
  created_at: string
  // Coverage & coats defaults (inherited by systems unless overridden)
  coverage_sqm: number | null
  coverage_sqm_over_mesh: number | null
  default_coats: number | null
  min_coats: number | null
  max_coats: number | null
  coverage_note: string | null
}

export interface ProductCategory {
  id: string
  name: string
  display_order: number
  created_at?: string
}

export interface ColourSwatch {
  id: string
  name: string
  hex_code: string
  family: string
  family_id?: string
  display_order: number
  created_at: string
}

export interface ColourFamily {
  id: string
  name: string
  display_order: number
}

export interface LoginLog {
  id: string
  user_id: string
  ip_address: string | null
  city: string | null
  country: string | null
  user_agent: string | null
  device_type: string | null
  browser: string | null
  os: string | null
  is_suspicious: boolean
  suspicious_reason: string | null
  logged_in_at: string
  created_at: string
}

export interface Quote {
  id: string
  reference: string
  project_name: string | null
  client_name: string | null
  client_email: string | null
  surface_type: string
  floor_area: number | null
  wall_area: number | null
  notes: string | null
  subtotal: number
  vat: number
  total: number
  status: string
  created_by: string | null
  creator_name?: string
  creator_email?: string
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  quote_id: string
  product_code: string | null
  product_name: string
  quantity: number
  unit_price: number
  line_total: number
  display_order: number
  created_at: string
}

export interface Stage {
  id: string
  name: string
  description: string | null
  display_order: number
  created_at: string
}

export interface System {
  id: string
  name: string
  description: string | null
  surface_type: 'floor' | 'wall' | 'both'
  is_active: boolean
  display_order: number
  family: string | null
  build_type: string | null
  created_at: string
}

export interface SystemProduct {
  id: string
  system_id: string
  product_id: string
  stage_id: string | null
  coverage_sqm: number | null
  applications: number | null
  is_optional: boolean
  display_order: number
  notes: string | null
  coverage_kg_per_sqm: number | null
  coverage_sqm_per_pack: number | null
  option_group: string | null
  is_default_option: boolean
  coverage_note: string | null
  has_pigment: boolean
  min_coats: number | null
  max_coats: number | null
  default_coats: number | null
  pigment_default_on: boolean
  depends_on_product_id: string | null
  created_at: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any

