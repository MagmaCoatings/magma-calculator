import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logCreate, logUpdate, logDelete } from '@/lib/activityLog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Layers, Plus, Pencil, Trash2, ChevronUp, ChevronDown } from 'lucide-react'

interface Stage {
  id: string
  name: string
  display_order: number
  description: string | null
  created_at: string
}

export function StagesPage() {
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '' })
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStage, setNewStage] = useState({ name: '', description: '' })

  useEffect(() => {
    fetchStages()
  }, [])

  async function fetchStages() {
    const { data, error } = await supabase
      .from('stages')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      console.error('Error fetching stages:', error)
    } else {
      setStages(data || [])
    }
    setLoading(false)
  }

  async function moveStage(id: string, direction: 'up' | 'down') {
    const currentIndex = stages.findIndex(s => s.id === id)
    if (currentIndex === -1) return
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    if (newIndex < 0 || newIndex >= stages.length) return

    const newStages = [...stages]
    const temp = newStages[currentIndex]
    newStages[currentIndex] = newStages[newIndex]
    newStages[newIndex] = temp

    setStages(newStages)

    // Persist new order
    for (let i = 0; i < newStages.length; i++) {
      await supabase.from('stages').update({ display_order: i }).eq('id', newStages[i].id)
    }

    // Log the reorder in the audit trail
    const moved = stages.find(s => s.id === id)
    if (moved) logUpdate('stage', id, `${moved.name} (reordered ${direction})`)
  }

  async function addStage() {
    if (!newStage.name.trim()) return

    const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.display_order)) : 0

    const { data, error } = await supabase
      .from('stages')
      .insert({
        name: newStage.name.trim(),
        description: newStage.description.trim() || null,
        display_order: maxOrder + 1
      })
      .select()
      .single()

    if (error) {
      console.error('Error adding stage:', error)
      alert('Failed to add stage')
    } else {
      // Log activity
      logCreate('stage', data?.id || '', newStage.name.trim())
      
      setNewStage({ name: '', description: '' })
      setShowAddForm(false)
      fetchStages()
    }
  }

  async function updateStage(id: string) {
    if (!editForm.name.trim()) return

    const { error } = await supabase
      .from('stages')
      .update({
        name: editForm.name.trim(),
        description: editForm.description.trim() || null
      })
      .eq('id', id)

    if (error) {
      console.error('Error updating stage:', error)
      alert('Failed to update stage')
    } else {
      // Log activity
      logUpdate('stage', id, editForm.name.trim())
      
      setEditingId(null)
      fetchStages()
    }
  }

  async function deleteStage(id: string) {
    const stage = stages.find(s => s.id === id)
    if (!confirm('Are you sure you want to delete this stage? This may affect system configurations.')) return

    const { error } = await supabase
      .from('stages')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting stage:', error)
      alert('Failed to delete stage. It may be in use.')
    } else {
      // Log activity
      logDelete('stage', id, stage?.name || 'Unknown')
      
      fetchStages()
    }
  }

  function startEditing(stage: Stage) {
    setEditingId(stage.id)
    setEditForm({ name: stage.name, description: stage.description || '' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="w-8 h-8 border-4 border-molten border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-basalt">Application Stages</h1>
          <p className="text-stone text-sm mt-1">{stages.length} stages defined</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Stage
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="p-4 mb-6 border-2 border-dashed border-molten">
          <h3 className="font-medium text-basalt mb-3">New Stage</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Stage name (e.g., Primer, Base Coat, Seal)"
              className="w-full px-3 py-2 rounded-lg border border-line"
              value={newStage.name}
              onChange={e => setNewStage({ ...newStage, name: e.target.value })}
            />
            <input
              type="text"
              placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg border border-line"
              value={newStage.description}
              onChange={e => setNewStage({ ...newStage, description: e.target.value })}
            />
            <div className="flex gap-2">
              <Button onClick={addStage}>Add Stage</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Stages List */}
      {stages.length === 0 ? (
        <Card className="p-12 text-center">
          <Layers className="w-12 h-12 text-ash mx-auto mb-4" />
          <h3 className="text-lg font-medium text-basalt mb-2">No stages defined</h3>
          <p className="text-stone mb-4">Stages define the order of product application</p>
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add First Stage
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {stages.map((stage, index) => (
            <Card key={stage.id} className="p-4">
              {editingId === stage.id ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    className="w-full px-3 py-2 rounded-lg border border-line"
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 rounded-lg border border-line"
                    value={editForm.description}
                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateStage(stage.id)}>Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveStage(stage.id, 'up')}
                        disabled={index === 0}
                        className="text-ash hover:text-basalt disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => moveStage(stage.id, 'down')}
                        disabled={index === stages.length - 1}
                        className="text-ash hover:text-basalt disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-molten/10 flex items-center justify-center text-sm font-bold text-molten-ink">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-basalt">{stage.name}</p>
                      {stage.description && (
                        <p className="text-sm text-stone">{stage.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => startEditing(stage)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteStage(stage.id)}>
                      <Trash2 className="w-4 h-4 text-danger" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
