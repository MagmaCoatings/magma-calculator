import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Save, RefreshCw } from 'lucide-react'

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
      for (const setting of settings) {
        const newValue = values[setting.key]
        if (newValue !== undefined) {
          // Try to parse as number if it looks like one
          let parsedValue: any = newValue
          if (/^-?\d+\.?\d*$/.test(newValue)) {
            parsedValue = parseFloat(newValue)
          }

          await supabase
            .from('settings')
            .update({ value: parsedValue, updated_at: new Date().toISOString() })
            .eq('key', setting.key)
        }
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
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500">Manage calculator defaults and pricing</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
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
                  <label className="block text-sm font-medium text-gray-700">
                    {config.label}
                    {config.unit && <span className="text-gray-400 ml-1">({config.unit})</span>}
                  </label>
                  <input
                    type={config.type}
                    value={values[setting.key] || ''}
                    onChange={e => updateValue(setting.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step={config.type === 'number' ? 'any' : undefined}
                  />
                  {setting.description && (
                    <p className="text-xs text-gray-400">{setting.description}</p>
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
          <p className="text-sm text-gray-500">
            System families are managed in the Systems admin page. Each system can be assigned a family
            which helps group related floor and wall systems together.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default SettingsPage
