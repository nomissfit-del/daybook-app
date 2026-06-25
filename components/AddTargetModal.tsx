'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Target } from '@/lib/types'

interface Props {
  folderId: string
  userId: string
  accentColor: string
  onClose: () => void
  onAdded: (target: Target) => void
}

export default function AddTargetModal({ folderId, userId, accentColor, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [targetValue, setTargetValue] = useState('')
  const [unit, setUnit] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const val = parseFloat(targetValue)
    if (!title.trim() || isNaN(val)) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('targets')
      .insert({
        user_id: userId,
        project_folder_id: folderId,
        title: title.trim(),
        target_value: val,
        current_value: 0,
        unit: unit.trim() || null,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      onAdded(data as Target)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-sm" />
      <div
        className="relative bg-white border border-border rounded-sm shadow-lg w-full max-w-sm p-6"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="font-serif text-xl mb-4" style={{ color: accentColor }}>
          Add target
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="label">Target name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Run 500 km"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="label">Target value</label>
              <input
                type="number"
                className="input"
                placeholder="500"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                step="any"
                min="0"
              />
            </div>
            <div className="w-28">
              <label className="label">Unit (optional)</label>
              <input
                type="text"
                className="input"
                placeholder="km"
                value={unit}
                onChange={e => setUnit(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !targetValue}
              className="px-4 py-2 text-sm font-medium text-white rounded-sm disabled:opacity-60 transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? 'Adding…' : 'Add target'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
