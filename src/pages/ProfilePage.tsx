import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, User, Building, MapPin, Phone, Globe, Check } from 'lucide-react'

interface ProfileFormData {
  first_name: string
  last_name: string
  company_name: string
  address_line1: string
  address_line2: string
  address_line3: string
  town_city: string
  postcode: string
  phone: string
  mobile: string
  instagram_handle: string
  facebook_url: string
  website_url: string
  show_tooltips: boolean
}

export function ProfilePage() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState<ProfileFormData>({
    first_name: '',
    last_name: '',
    company_name: '',
    address_line1: '',
    address_line2: '',
    address_line3: '',
    town_city: '',
    postcode: '',
    phone: '',
    mobile: '',
    instagram_handle: '',
    facebook_url: '',
    website_url: '',
    show_tooltips: true
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      fetchFullProfile()
    }
  }, [profile])

  async function fetchFullProfile() {
    if (!user) return
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
    } else if (data) {
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        company_name: data.company_name || '',
        address_line1: data.address_line1 || '',
        address_line2: data.address_line2 || '',
        address_line3: data.address_line3 || '',
        town_city: data.town_city || '',
        postcode: data.postcode || '',
        phone: data.phone || '',
        mobile: data.mobile || '',
        instagram_handle: data.instagram_handle || '',
        facebook_url: data.facebook_url || '',
        website_url: data.website_url || '',
        show_tooltips: data.show_tooltips ?? true
      })
    }
    setLoading(false)
  }

  function normaliseInstagramHandle(value: string): string {
    return value
      .replace(/^@/, '')
      .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
      .replace(/\/$/, '')
  }

  function handleChange(field: keyof ProfileFormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        company_name: form.company_name || null,
        full_name: [form.first_name, form.last_name].filter(Boolean).join(' ') || null,
        address_line1: form.address_line1 || null,
        address_line2: form.address_line2 || null,
        address_line3: form.address_line3 || null,
        town_city: form.town_city || null,
        postcode: form.postcode?.toUpperCase() || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        instagram_handle: normaliseInstagramHandle(form.instagram_handle) || null,
        facebook_url: form.facebook_url || null,
        website_url: form.website_url || null,
        show_tooltips: form.show_tooltips
      })
      .eq('id', user.id)

    if (error) {
      console.error('Error saving profile:', error)
      setError('Failed to save profile. Please try again.')
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-molten border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-basalt">My Profile</h1>
        <p className="text-stone text-sm mt-1">Manage your account details</p>
      </div>

      <div className="space-y-6">
        {/* Personal Details */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-5 h-5 text-ash" />
            <h2 className="font-medium text-basalt">Personal Details</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">First Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.first_name}
                onChange={e => handleChange('first_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Last Name</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.last_name}
                onChange={e => handleChange('last_name', e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-ink mb-1">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 rounded-lg border border-line bg-limestone text-stone"
              value={profile?.email || ''}
              disabled
            />
            <p className="text-xs text-ash mt-1">Contact support to change your email</p>
          </div>
        </Card>

        {/* Company Details */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Building className="w-5 h-5 text-ash" />
            <h2 className="font-medium text-basalt">Company Details</h2>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1">Company Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
              value={form.company_name}
              onChange={e => handleChange('company_name', e.target.value)}
            />
          </div>
        </Card>

        {/* Address */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-5 h-5 text-ash" />
            <h2 className="font-medium text-basalt">Address</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Address Line 1</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.address_line1}
                onChange={e => handleChange('address_line1', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Address Line 2</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.address_line2}
                onChange={e => handleChange('address_line2', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Address Line 3</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.address_line3}
                onChange={e => handleChange('address_line3', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Town / City</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                  value={form.town_city}
                  onChange={e => handleChange('town_city', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Postcode</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent uppercase"
                  value={form.postcode}
                  onChange={e => handleChange('postcode', e.target.value)}
                  placeholder="CM2 8RF"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Contact */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Phone className="w-5 h-5 text-ash" />
            <h2 className="font-medium text-basalt">Contact Numbers</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Phone</label>
              <input
                type="tel"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Mobile (if different)</label>
              <input
                type="tel"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.mobile}
                onChange={e => handleChange('mobile', e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Social / Web */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-5 h-5 text-ash" />
            <h2 className="font-medium text-basalt">Online Presence</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">Website</label>
              <input
                type="url"
                className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                value={form.website_url}
                onChange={e => handleChange('website_url', e.target.value)}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Instagram</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ash">@</span>
                  <input
                    type="text"
                    className="w-full pl-8 pr-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                    value={form.instagram_handle}
                    onChange={e => handleChange('instagram_handle', normaliseInstagramHandle(e.target.value))}
                    placeholder="yourhandle"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Facebook</label>
                <input
                  type="url"
                  className="w-full px-3 py-2 rounded-lg border border-line focus:outline-none focus:ring-2 focus:ring-molten focus:border-transparent"
                  value={form.facebook_url}
                  onChange={e => handleChange('facebook_url', e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Preferences */}
        <Card className="p-6">
          <h2 className="font-medium text-basalt mb-4">Preferences</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="w-5 h-5 rounded border-stone text-molten-ink focus:ring-molten"
              checked={form.show_tooltips}
              onChange={e => handleChange('show_tooltips', e.target.checked)}
            />
            <div>
              <p className="text-sm font-medium text-basalt">Show product tooltips</p>
              <p className="text-xs text-stone">Display helpful info icons next to products in the calculator</p>
            </div>
          </label>
        </Card>

        {/* Save */}
        {error && (
          <div className="p-3 bg-danger-tint text-danger rounded-lg text-sm">{error}</div>
        )}
        
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
