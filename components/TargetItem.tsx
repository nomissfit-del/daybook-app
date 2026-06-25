'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Target } from '@/lib/types'

interface Props {
  target: Target
  accentColor: string
  onUpdated: (target: Target) => void
  onDeleted: (id: string) => void
}

export default function TargetItem({ target, accentColor, onUpdated, onDeleted }: Props) {
  const supabase = createClient()
  const [editing, setEditing] = useState(false)
  const [newValue, setNewValue] = useState(String(target.current_value))
  const [saving, setSaving] = useState(false)

  const pct = Math.min(100, Math.round((target.current_value / target.target_value) * 100))

  async function handleSave() {
    const val = parseFloat(newValue)
    if (isNaN(val)) return
    setSaving(true)
    const { data, error } = await supabase
      .from('targets')
      .update({ current_value: val })
      .eq('id', target.id)
      .select()
      .single()
    if (!error && data) {
      onUpdated(data as Target)
    }
    setEditing(false)
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete target "${target.title}"?`)) return
    await supabase.from('targets').delete().eq('id', target.id)
    onDeleted(target.id)
  }

  return (
    <li className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-mono text-ink">{target.title}</span>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <input
                type="number"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                className="input w-24 py-0.5 text-xs"
                step="any"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false) }}
              />
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs font-medium text-white px-2 py-0.5 rounded-sm"
                style={{ backgroundColor: accentColor }}
              >
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-xs text-muted"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <span className="text-xs font-mono text-muted">
                {target.current_value}{target.unit ? ` ${target.unit}` : ''} / {target.target_value}{target.unit ? ` ${target.unit}` : ''}
              </span>
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-ink transition-all"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="text-xs text-muted opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: accentColor }}
        />
      </div>
      <div className="text-right text-xs text-muted mt-0.5 font-mono">{pct}%</div>
    </li>
  )
}
