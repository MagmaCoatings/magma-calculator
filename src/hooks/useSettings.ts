import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface AppSettings {
  default_floor_area: number
  default_wall_area: number
  default_wastage_percent: number
  pigment_price: number
  vat_rate: number
}

const DEFAULTS: AppSettings = {
  default_floor_area: 20,
  default_wall_area: 10,
  default_wastage_percent: 10,
  pigment_price: 15,
  vat_rate: 0.2,
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('settings').select('key, value').then(({ data, error }) => {
      if (data && !error) {
        const map: Record<string, number> = {}
        data.forEach((r: { key: string; value: unknown }) => {
          const n = Number(r.value)
          if (!Number.isNaN(n)) map[r.key] = n
        })
        setSettings({ ...DEFAULTS, ...map })
      }
      setLoading(false)
    })
  }, [])

  return { settings, loading }
}
