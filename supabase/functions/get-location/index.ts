// Supabase Edge Function: get-location
// Handles IP/geo lookup server-side to protect user privacy

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GeoLocation {
  ip: string
  city?: string
  region?: string
  country?: string
  country_code?: string
  timezone?: string
  latitude?: number
  longitude?: number
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Extract client IP from headers (in order of preference)
    const ip = 
      req.headers.get('cf-connecting-ip') ||      // Cloudflare
      req.headers.get('x-real-ip') ||             // Nginx
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||  // Proxy chain
      'unknown'

    // If we have Cloudflare headers, use them directly (faster, no external call)
    const cfCountry = req.headers.get('cf-ipcountry')
    const cfCity = req.headers.get('cf-ipcity')
    const cfRegion = req.headers.get('cf-region')
    const cfTimezone = req.headers.get('cf-timezone')
    const cfLatitude = req.headers.get('cf-ipllatitude')
    const cfLongitude = req.headers.get('cf-iplongitude')

    if (cfCountry) {
      // Use Cloudflare geo headers
      const location: GeoLocation = {
        ip,
        country_code: cfCountry,
        city: cfCity || undefined,
        region: cfRegion || undefined,
        timezone: cfTimezone || undefined,
        latitude: cfLatitude ? parseFloat(cfLatitude) : undefined,
        longitude: cfLongitude ? parseFloat(cfLongitude) : undefined,
      }

      return new Response(
        JSON.stringify({ success: true, location }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fallback: use ip-api.com (free, no API key, 45 req/min limit)
    // Only for non-local IPs
    if (ip === 'unknown' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          location: { ip, city: 'Local', country: 'Local', country_code: 'XX' } 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,region,regionName,city,timezone,lat,lon`)
    const geoData = await geoResponse.json()

    if (geoData.status === 'success') {
      const location: GeoLocation = {
        ip,
        city: geoData.city,
        region: geoData.regionName,
        country: geoData.country,
        country_code: geoData.countryCode,
        timezone: geoData.timezone,
        latitude: geoData.lat,
        longitude: geoData.lon,
      }

      return new Response(
        JSON.stringify({ success: true, location }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Geo lookup failed, return IP only
    return new Response(
      JSON.stringify({ success: true, location: { ip } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in get-location:', error)
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to get location' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
