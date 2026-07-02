import { useState, useRef, useEffect, useMemo } from 'react'

// Searchable, grouped product picker.
// - Type to filter by product name, family, category, or code.
// - With no query it shows every product grouped into sections (browse mode).
// - Keyboard: ↑/↓ to move, Enter to select, Esc to close.

export interface PickerProduct {
  id: string
  name: string
  code?: string
  price: number
  pack_size: number
  pack_unit: string
  category: string | null
  display_order: number | null
  is_consumable: boolean | null
  consumable_group: string | null
}

interface Props {
  products: PickerProduct[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
}

const fmt = (n: number) => n.toFixed(2)

export function ProductPicker({ products, value, onChange, placeholder = 'Search or select a product…' }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const selected = products.find(p => p.id === value) || null

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (p: PickerProduct) => {
      if (!q) return true
      return `${p.name} ${p.consumable_group || ''} ${p.category || ''} ${p.code || ''}`
        .toLowerCase()
        .includes(q)
    }
    const g: Record<string, { order: number; items: PickerProduct[] }> = {}
    for (const p of products) {
      if (!match(p)) continue
      const key = p.is_consumable ? (p.consumable_group || 'Extras') : (p.category || 'Other')
      if (!g[key]) g[key] = { order: p.display_order ?? 9999, items: [] }
      g[key].order = Math.min(g[key].order, p.display_order ?? 9999)
      g[key].items.push(p)
    }
    return Object.entries(g)
      .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
      .map(([label, v]) => ({
        label,
        items: v.items.sort(
          (x, y) => (x.display_order ?? 0) - (y.display_order ?? 0) || x.name.localeCompare(y.name)
        ),
      }))
  }, [products, query])

  const flat = useMemo(() => groups.flatMap(gr => gr.items), [groups])
  useEffect(() => setActiveIdx(0), [query])

  function choose(p: PickerProduct) {
    onChange(p.id)
    setOpen(false)
    setQuery('')
  }

  const displayText = selected
    ? `${selected.name} — £${fmt(selected.price)} / ${selected.pack_size}${selected.pack_unit}`
    : ''

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        className="w-full px-3 py-2 border border-line rounded-lg bg-bone"
        placeholder={placeholder}
        value={open ? query : displayText}
        onFocus={() => { setOpen(true); setQuery('') }}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onKeyDown={e => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIdx(i => Math.min(i + 1, flat.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); if (flat[activeIdx]) choose(flat[activeIdx]) }
          else if (e.key === 'Escape') { setOpen(false) }
        }}
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-auto bg-bone border border-line rounded-lg shadow-lg">
          {flat.length === 0 ? (
            <div className="px-3 py-3 text-sm text-stone">No matches for “{query}”</div>
          ) : (
            groups.map(gr => (
              <div key={gr.label}>
                <div className="px-3 py-1.5 text-xs font-semibold text-stone bg-limestone sticky top-0">
                  {gr.label}
                </div>
                {gr.items.map(p => {
                  const idx = flat.indexOf(p)
                  return (
                    <button
                      type="button"
                      key={p.id}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => choose(p)}
                      className={`w-full text-left px-3 py-2 text-sm ${
                        idx === activeIdx ? 'bg-molten-tint text-molten-ink' : 'text-ink hover:bg-limestone'
                      }`}
                    >
                      {p.name} <span className="text-ash">— £{fmt(p.price)} / {p.pack_size}{p.pack_unit}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
