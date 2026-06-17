export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      colour_families: {
        Row: {
          display_order: number
          id: string
          name: string
        }
        Insert: {
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      colour_swatches: {
        Row: {
          display_order: number
          family_id: string
          hex_code: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          display_order?: number
          family_id: string
          hex_code: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          display_order?: number
          family_id?: string
          hex_code?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "colour_swatches_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "colour_families"
            referencedColumns: ["id"]
          },
        ]
      }
      colours: {
        Row: {
          created_at: string | null
          display_order: number | null
          family: string
          hex_code: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          family: string
          hex_code: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          family?: string
          hex_code?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      custom_colours: {
        Row: {
          brand: string | null
          created_at: string | null
          created_by: string | null
          hex: string
          id: string
          name: string
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          hex: string
          id?: string
          name: string
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          created_by?: string | null
          hex?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      finish_preset_products: {
        Row: {
          coverage_note: string | null
          coverage_sqm: number | null
          created_at: string | null
          default_coats: number | null
          display_order: number | null
          has_pigment: boolean | null
          id: string
          max_coats: number | null
          min_coats: number | null
          preset_id: string
          product_id: string
          stage_id: string | null
        }
        Insert: {
          coverage_note?: string | null
          coverage_sqm?: number | null
          created_at?: string | null
          default_coats?: number | null
          display_order?: number | null
          has_pigment?: boolean | null
          id?: string
          max_coats?: number | null
          min_coats?: number | null
          preset_id: string
          product_id: string
          stage_id?: string | null
        }
        Update: {
          coverage_note?: string | null
          coverage_sqm?: number | null
          created_at?: string | null
          default_coats?: number | null
          display_order?: number | null
          has_pigment?: boolean | null
          id?: string
          max_coats?: number | null
          min_coats?: number | null
          preset_id?: string
          product_id?: string
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finish_preset_products_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "finish_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finish_preset_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finish_preset_products_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      finish_presets: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          system_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          system_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finish_presets_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          device_type: string | null
          id: string
          ip_address: unknown
          is_suspicious: boolean | null
          logged_in_at: string
          os: string | null
          suspicious_reason: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          logged_in_at?: string
          os?: string | null
          suspicious_reason?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          device_type?: string | null
          id?: string
          ip_address?: unknown
          is_suspicious?: boolean | null
          logged_in_at?: string
          os?: string | null
          suspicious_reason?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "login_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          new_price: number
          old_price: number
          product_id: string
          reason: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price: number
          old_price: number
          product_id: string
          reason?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_price?: number
          old_price?: number
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          code: string
          coverage_note: string | null
          coverage_rate: number | null
          coverage_sqm: number | null
          coverage_sqm_over_mesh: number | null
          coverage_unit: string | null
          created_at: string
          default_coats: number | null
          default_coverage_sqm: number | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean
          max_coats: number | null
          min_coats: number | null
          name: string
          pack_size: number
          pack_unit: string
          price: number
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          code: string
          coverage_note?: string | null
          coverage_rate?: number | null
          coverage_sqm?: number | null
          coverage_sqm_over_mesh?: number | null
          coverage_unit?: string | null
          created_at?: string
          default_coats?: number | null
          default_coverage_sqm?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          max_coats?: number | null
          min_coats?: number | null
          name: string
          pack_size: number
          pack_unit: string
          price: number
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          code?: string
          coverage_note?: string | null
          coverage_rate?: number | null
          coverage_sqm?: number | null
          coverage_sqm_over_mesh?: number | null
          coverage_unit?: string | null
          created_at?: string
          default_coats?: number | null
          default_coverage_sqm?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean
          max_coats?: number | null
          min_coats?: number | null
          name?: string
          pack_size?: number
          pack_unit?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          address_line3: string | null
          company_name: string | null
          created_at: string
          email: string
          facebook_url: string | null
          first_name: string | null
          full_name: string
          id: string
          instagram_handle: string | null
          last_name: string | null
          latitude: number | null
          longitude: number | null
          mobile: string | null
          notes: string | null
          phone: string | null
          postcode: string | null
          role: string
          show_tooltips: boolean | null
          status: string
          town_city: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          company_name?: string | null
          created_at?: string
          email: string
          facebook_url?: string | null
          first_name?: string | null
          full_name: string
          id: string
          instagram_handle?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          role?: string
          show_tooltips?: boolean | null
          status?: string
          town_city?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          address_line3?: string | null
          company_name?: string | null
          created_at?: string
          email?: string
          facebook_url?: string | null
          first_name?: string | null
          full_name?: string
          id?: string
          instagram_handle?: string | null
          last_name?: string | null
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          role?: string
          show_tooltips?: boolean | null
          status?: string
          town_city?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      quote_history: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          field_name: string | null
          id: string
          new_value: string | null
          old_value: string | null
          quote_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          quote_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          field_name?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          quote_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_history_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          display_order: number | null
          id: string
          line_total: number
          product_code: string
          product_name: string
          quantity: number
          quote_id: string | null
          unit_price: number
        }
        Insert: {
          display_order?: number | null
          id?: string
          line_total: number
          product_code: string
          product_name: string
          quantity: number
          quote_id?: string | null
          unit_price: number
        }
        Update: {
          display_order?: number | null
          id?: string
          line_total?: number
          product_code?: string
          product_name?: string
          quantity?: number
          quote_id?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_name: string | null
          created_at: string | null
          created_by: string | null
          custom_colour_brand: string | null
          custom_colour_hex: string | null
          custom_colour_id: string | null
          custom_colour_name: string | null
          floor_area: number | null
          id: string
          notes: string | null
          project_name: string | null
          reference: string
          status: string | null
          subtotal: number
          surface_type: string
          total: number
          updated_at: string | null
          vat: number
          wall_area: number | null
        }
        Insert: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_colour_brand?: string | null
          custom_colour_hex?: string | null
          custom_colour_id?: string | null
          custom_colour_name?: string | null
          floor_area?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          reference: string
          status?: string | null
          subtotal: number
          surface_type: string
          total: number
          updated_at?: string | null
          vat: number
          wall_area?: number | null
        }
        Update: {
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          custom_colour_brand?: string | null
          custom_colour_hex?: string | null
          custom_colour_id?: string | null
          custom_colour_name?: string | null
          floor_area?: number | null
          id?: string
          notes?: string | null
          project_name?: string | null
          reference?: string
          status?: string | null
          subtotal?: number
          surface_type?: string
          total?: number
          updated_at?: string | null
          vat?: number
          wall_area?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_custom_colour_id_fkey"
            columns: ["custom_colour_id"]
            isOneToOne: false
            referencedRelation: "custom_colours"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      stages: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      system_products: {
        Row: {
          applications: number
          coverage_kg_per_sqm: number | null
          coverage_note: string | null
          coverage_sqm: number | null
          coverage_sqm_over_mesh: number | null
          coverage_sqm_per_pack: number | null
          created_at: string | null
          default_coats: number | null
          depends_on_product_id: string | null
          depends_on_product_ids: string[] | null
          display_order: number | null
          has_pigment: boolean | null
          id: string
          is_default_option: boolean | null
          is_optional: boolean | null
          max_coats: number | null
          min_coats: number | null
          notes: string | null
          option_group: string | null
          pigment_default_on: boolean | null
          product_id: string
          shared_across_surfaces: boolean | null
          stage_id: string | null
          system_id: string
        }
        Insert: {
          applications?: number
          coverage_kg_per_sqm?: number | null
          coverage_note?: string | null
          coverage_sqm?: number | null
          coverage_sqm_over_mesh?: number | null
          coverage_sqm_per_pack?: number | null
          created_at?: string | null
          default_coats?: number | null
          depends_on_product_id?: string | null
          depends_on_product_ids?: string[] | null
          display_order?: number | null
          has_pigment?: boolean | null
          id?: string
          is_default_option?: boolean | null
          is_optional?: boolean | null
          max_coats?: number | null
          min_coats?: number | null
          notes?: string | null
          option_group?: string | null
          pigment_default_on?: boolean | null
          product_id: string
          shared_across_surfaces?: boolean | null
          stage_id?: string | null
          system_id: string
        }
        Update: {
          applications?: number
          coverage_kg_per_sqm?: number | null
          coverage_note?: string | null
          coverage_sqm?: number | null
          coverage_sqm_over_mesh?: number | null
          coverage_sqm_per_pack?: number | null
          created_at?: string | null
          default_coats?: number | null
          depends_on_product_id?: string | null
          depends_on_product_ids?: string[] | null
          display_order?: number | null
          has_pigment?: boolean | null
          id?: string
          is_default_option?: boolean | null
          is_optional?: boolean | null
          max_coats?: number | null
          min_coats?: number | null
          notes?: string | null
          option_group?: string | null
          pigment_default_on?: boolean | null
          product_id?: string
          shared_across_surfaces?: boolean | null
          stage_id?: string | null
          system_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_products_depends_on_product_id_fkey"
            columns: ["depends_on_product_id"]
            isOneToOne: false
            referencedRelation: "system_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_depends_on_product_id_fkey"
            columns: ["depends_on_product_id"]
            isOneToOne: false
            referencedRelation: "system_products_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
      systems: {
        Row: {
          build_type: string | null
          created_at: string | null
          description: string | null
          display_order: number | null
          family: string | null
          id: string
          is_active: boolean | null
          name: string
          surface_type: string
          updated_at: string | null
        }
        Insert: {
          build_type?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          family?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          surface_type: string
          updated_at?: string | null
        }
        Update: {
          build_type?: string | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          family?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          surface_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      system_products_view: {
        Row: {
          applications: number | null
          coverage_kg_per_sqm: number | null
          coverage_note: string | null
          coverage_sqm: number | null
          coverage_sqm_per_pack: number | null
          default_coverage_sqm: number | null
          has_pigment: boolean | null
          id: string | null
          is_default_option: boolean | null
          is_optional: boolean | null
          max_coats: number | null
          min_coats: number | null
          notes: string | null
          option_group: string | null
          pack_size: number | null
          pack_unit: string | null
          price: number | null
          product_description: string | null
          product_id: string | null
          product_name: string | null
          product_order: number | null
          stage_id: string | null
          stage_name: string | null
          stage_order: number | null
          surface_type: string | null
          system_id: string | null
          system_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_products_system_id_fkey"
            columns: ["system_id"]
            isOneToOne: false
            referencedRelation: "systems"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      generate_quote_reference: { Args: never; Returns: string }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_ip_address?: unknown
          p_metadata?: Json
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
