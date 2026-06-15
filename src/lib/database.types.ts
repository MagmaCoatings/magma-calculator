// Stopgap Database types for Supabase
// TODO: Replace with `supabase gen types typescript` output

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          company_name: string | null
          role: 'admin' | 'installer'
          status: 'active' | 'suspended' | 'pending'
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      systems: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['systems']['Row']>
        Update: Partial<Database['public']['Tables']['systems']['Row']>
      }
      system_products: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['system_products']['Row']>
        Update: Partial<Database['public']['Tables']['system_products']['Row']>
      }
      products: {
        Row: {
          id: string
          name: string
          sku: string | null
          description: string | null
          pack_size: number
          pack_unit: string
          price: number
          category: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']>
        Update: Partial<Database['public']['Tables']['products']['Row']>
      }
      stages: {
        Row: {
          id: string
          name: string
          description: string | null
          display_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['stages']['Row']>
        Update: Partial<Database['public']['Tables']['stages']['Row']>
      }
      quotes: {
        Row: {
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
          created_at: string
          updated_at: string
          custom_colour_name: string | null
          custom_colour_hex: string | null
          custom_colour_brand: string | null
        }
        Insert: Partial<Database['public']['Tables']['quotes']['Row']>
        Update: Partial<Database['public']['Tables']['quotes']['Row']>
      }
      quote_items: {
        Row: {
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
        Insert: Partial<Database['public']['Tables']['quote_items']['Row']>
        Update: Partial<Database['public']['Tables']['quote_items']['Row']>
      }
      quote_history: {
        Row: {
          id: string
          quote_id: string
          changed_by: string | null
          change_type: string
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['quote_history']['Row']>
        Update: Partial<Database['public']['Tables']['quote_history']['Row']>
      }
      login_logs: {
        Row: {
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
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['login_logs']['Row']>
        Update: Partial<Database['public']['Tables']['login_logs']['Row']>
      }
      settings: {
        Row: {
          id: string
          key: string
          value: Json
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['settings']['Row']>
        Update: Partial<Database['public']['Tables']['settings']['Row']>
      }
      colours: {
        Row: {
          id: string
          name: string
          hex_code: string
          family: string
          display_order: number
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['colours']['Row']>
        Update: Partial<Database['public']['Tables']['colours']['Row']>
      }
      custom_colours: {
        Row: {
          id: string
          name: string
          hex: string
          brand: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['custom_colours']['Row']>
        Update: Partial<Database['public']['Tables']['custom_colours']['Row']>
      }
    }
    Functions: {
      generate_quote_reference: {
        Args: Record<string, never>
        Returns: string
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
  }
}

// Re-export Profile type for useAuth
export type Profile = Database['public']['Tables']['profiles']['Row']
