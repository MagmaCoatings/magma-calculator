import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Product, ColourSwatch, ColourFamily } from '@/lib/types'

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:product_categories(id, name, display_order)')
        .eq('is_active', true)
        .order('category_id')

      if (error) {
        setError(error.message)
      } else {
        setProducts(data as Product[])
      }
      setLoading(false)
    }

    fetchProducts()
  }, [])

  return { products, loading, error }
}

export function useColours() {
  const [colours, setColours] = useState<ColourSwatch[]>([])
  const [families, setFamilies] = useState<ColourFamily[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchColours() {
      // Fetch families
      const { data: familiesData, error: familiesError } = await supabase
        .from('colour_families')
        .select('*')
        .order('display_order')

      if (familiesError) {
        setError(familiesError.message)
        setLoading(false)
        return
      }

      // Fetch swatches
      const { data: swatchesData, error: swatchesError } = await supabase
        .from('colour_swatches')
        .select('*, family:colour_families(id, name)')
        .eq('is_active', true)
        .order('display_order')

      if (swatchesError) {
        setError(swatchesError.message)
      } else {
        setFamilies(familiesData as ColourFamily[])
        setColours(swatchesData as ColourSwatch[])
      }
      setLoading(false)
    }

    fetchColours()
  }, [])

  // Group colours by family
  const coloursByFamily = families.map(family => ({
    family,
    shades: colours.filter(c => c.family === family.name),
  }))

  return { colours, families, coloursByFamily, loading, error }
}
