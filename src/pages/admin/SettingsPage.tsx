import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logUpdate } from '@/lib/activityLog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'

interface Setting {
  id: string
  key: string
  value: string
  description: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Editable values
  const [values, setValues] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    setLoading(true)
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .order('key')

    if (data) {
      setSettings(data)
      const vals: { [key: string]: string } = {}
      data.forEach(s => {
        vals[s.key] = typeof s.value === 'string' ? s.value : JSON.stringify(s.value)
      })
      setValues(vals)
    }
    if (error) {
      setMessage({ type: 'error', text: error.message })
    }
    setLoading(false)
  }

  async function saveSettings() {
    setSaving(true)
    setMessage(null)

    try {
      const changedSettings: Record<string, any> = {}
      
      for (const setting of settings) {
        const newValue = values[setting.key]
        if (newValue !== undefined) {
          // Try to parse as number if it looks like one
          let parsedValue: any = newValue
          if (/^-?\d+\.?\d*$/.test(newValue)) {
            parsedValue = parseFloat(newValue)
          }
          
          // Track changed values
          if (String(setting.value) !== String(parsedValue)) {
            changedSettings[setting.key] = parsedValue
          }

          await supabase
            .from('settings')
            .update({ value: parsedValue, updated_at: new Date().toISOString() })
            .eq('key', setting.key)
        }
      }
      
      // Log activity if any settings changed
      if (Object.keys(changedSettings).length > 0) {
        logUpdate('settings', 'global', 'System Settings', changedSettings)
      }
      
      setMessage({ type: 'success', text: 'Settings saved successfully' })
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message })
    }

    setSaving(false)
  }

  function updateValue(key: string, value: string) {
    setValues(prev => ({ ...prev, [key]: value }))
  }

  const settingLabels: { [key: string]: { label: string; unit?: string; type: 'number' | 'text' } } = {
    default_floor_area: { label: 'Default Floor Area', unit: 'm²', type: 'number' },
    default_wall_area: { label: 'Default Wall Area', unit: 'm²', type: 'number' },
    default_wastage_percent: { label: 'Default Wastage', unit: '%', type: 'number' },
    pigment_price: { label: 'Pigment Pot Price', unit: '£', type: 'number' },
    vat_rate: { label: 'VAT Rate', unit: '(0.2 = 20%)', type: 'number' }
  }

  if (loading) {
    return (
      <Spinner />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-basalt">Settings</h1>
          <p className="text-stone">Manage calculator defaults and pricing</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-sage-tint text-sage' : 'bg-danger-tint text-danger'}`}>
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Calculator Defaults</CardTitle>
          <CardDescription>These values are used as defaults when the calculator loads</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {settings.map(setting => {
              const config = settingLabels[setting.key] || { label: setting.key, type: 'text' }
              return (
                <div key={setting.id} className="space-y-2">
                  <label className="block text-sm font-medium text-ink">
                    {config.label}
                    {config.unit && <span className="text-ash ml-1">({config.unit})</span>}
                  </label>
                  <input
                    type={config.type}
                    value={values[setting.key] || ''}
                    onChange={e => updateValue(setting.key, e.target.value)}
                    className="w-full px-3 py-2 border border-line rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step={config.type === 'number' ? 'any' : undefined}
                  />
                  {setting.description && (
                    <p className="text-xs text-ash">{setting.description}</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Families</CardTitle>
          <CardDescription>Group systems by product family (Microcement, Terrazzo, etc.)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-stone">
            System families are managed in the Systems admin page. Each system can be assigned a family
            which helps group related floor and wall systems together.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
