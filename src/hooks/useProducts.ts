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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchColours() {
      try {
        const { data, error: queryError } = await supabase
          .from('colours')
          .select('*')
          .order('display_order')

        if (queryError) {
          setError(queryError.message)
        } else if (data) {
          setColours(data as ColourSwatch[])
        }
      } catch {
        setError('Failed to load colours')
      } finally {
        setLoading(false)
      }
    }

    fetchColours()
  }, [])

  // Get unique family names
  const familyNames = [...new Set(colours.map(c => c.family))].filter(Boolean)
  
  // Group colours by family
  const coloursByFamily = familyNames.map(familyName => ({
    family: { id: familyName, name: familyName, display_order: 0 } as ColourFamily,
    shades: colours.filter(c => c.family === familyName),
  }))

  return { colours, coloursByFamily, loading, error }
}
