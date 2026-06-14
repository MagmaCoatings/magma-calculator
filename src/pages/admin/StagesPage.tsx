import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, GripVertical, Pencil, Trash2, Check, X } from 'lucide-react'

interface Stage {
  id: string
  name: string
  display_order: number
  is_active: boolean
}

export function StagesPage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [newStageName, setNewStageName] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    fetchStages()
  }, [])

  async function fetchStages() {
    const { data } = await supabase
      .from('stages')
      .select('*')
      .order('display_order')
    setStages(data || [])
    setLoading(false)
  }

  async function addStage() {
    if (!newStageName.trim()) return

    const maxOrder = Math.max(...stages.map(s => s.display_order), 0)
    await supabase.from('stages').insert({
      name: newStageName.trim(),
      display_order: maxOrder + 1,
    })
    setNewStageName('')
    setShowAdd(false)
    fetchStages()
  }

  async function updateStage(id: string) {
    if (!editName.trim()) return

    await supabase
      .from('stages')
      .update({ name: editName.trim() })
      .eq('id', id)
    setEditingId(null)
    fetchStages()
  }

  async function deleteStage(id: string) {
    if (!confirm('Delete this stage? Products using it will have no stage assigned.')) return
    await supabase.from('stages').delete().eq('id', id)
    fetchStages()
  }

  async function moveStage(id: string, direction: 'up' | 'down') {
    const index = stages.findIndex(s => s.id === id)
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === stages.length - 1) return

    const swapIndex = direction === 'up' ? index - 1 : index + 1
    const current = stages[index]
    const swap = stages[swapIndex]

    await supabase.from('stages').update({ display_order: swap.display_order }).eq('id', current.id)
    await supabase.from('stages').update({ display_order: current.display_order }).eq('id', swap.id)
    fetchStages()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-magma border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stages</h1>
          <p className="text-gray-500 text-sm">Define the stages/layers for system build-ups</p>
        </div>
        <Button onClick={() => setShowAdd(true)} disabled={showAdd}>
          <Plus className="w-4 h-4 mr-2" /> Add Stage
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {showAdd && (
            <div className="flex items-center gap-2 p-4 bg-orange-50 border-b border-orange-100">
              <Input
                placeholder="Stage name (e.g., Base Coats)"
                value={newStageName}
                onChange={e => setNewStageName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addStage()}
                autoFocus
                className="flex-1"
              />
              <Button size="sm" onClick={addStage}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowAdd(false); setNewStageName('') }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {stages.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No stages defined yet. Add your first stage to get started.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stages.map((stage, index) => (
                <div key={stage.id} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveStage(stage.id, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveStage(stage.id, 'down')}
                      disabled={index === stages.length - 1}
                      className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  <GripVertical className="w-4 h-4 text-gray-300" />

                  <div className="flex-1">
                    {editingId === stage.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && updateStage(stage.id)}
                          autoFocus
                          className="max-w-xs"
                        />
                        <Button size="sm" onClick={() => updateStage(stage.id)}>
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <span className="font-medium text-gray-900">{stage.name}</span>
                    )}
                  </div>

                  {editingId !== stage.id && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(stage.id); setEditName(stage.name) }}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteStage(stage.id)}
                        className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
