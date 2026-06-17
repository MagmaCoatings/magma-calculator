import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Using untyped client - generates proper types later with `supabase gen types typescript`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(supabaseUrl, supabaseAnonKey)

// Types for location data from Edge Function
interface LocationData {
  ip: string
  city?: string
  region?: string
  country?: string
  country_code?: string
  timezone?: string
  latitude?: number
  longitude?: number
}

// Cache location to avoid repeated calls
let cachedLocation: LocationData | null = null

/**
 * Get client location from Edge Function (server-side IP/geo lookup)
 * More reliable than client-side as it gets real IP from request headers
 */
export async function getClientLocation(): Promise<LocationData | null> {
  // Return cached if available
  if (cachedLocation) return cachedLocation

  try {
    const { data, error } = await supabase.functions.invoke('get-location')
    
    if (error) {
      console.warn('Edge function error:', error)
      return null
    }

    if (data?.success && data?.location) {
      cachedLocation = data.location
      return data.location
    }

    return null
  } catch (err) {
    console.warn('Failed to get location:', err)
    return null
  }
}

// Legacy functions for backward compatibility
export async function getClientIP(): Promise<string | null> {
  const location = await getClientLocation()
  return location?.ip || null
}

export async function getGeoFromIP(_ip: string): Promise<{ city?: string; region?: string; country?: string }> {
  const location = await getClientLocation()
  return {
    city: location?.city,
    region: location?.region,
    country: location?.country,
  }
}

export function getDeviceType(): string {
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'Tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

export function getBrowser(): string {
  const ua = navigator.userAgent
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('Edge')) return 'Edge'
  if (ua.includes('Opera')) return 'Opera'
  return 'Unknown'
}

export function getOS(): string {
  const ua = navigator.userAgent
  if (ua.includes('Windows')) return 'Windows'
  if (ua.includes('Mac')) return 'macOS'
  if (ua.includes('Linux')) return 'Linux'
  if (ua.includes('Android')) return 'Android'
  if (ua.includes('iOS')) return 'iOS'
  return 'Unknown'
}
