'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Dashboard, ProjectFolder } from '@/lib/types'

interface Props {
  dashboard: Dashboard
  userId: string
  accentColor: string
  onClose: () => void
  onAdded: (folder: ProjectFolder) => void
}

export default function AddProjectModal({ dashboard, userId, accentColor, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)

    const { data, error } = await supabase
      .from('project_folders')
      .insert({ user_id: userId, name: name.trim(), dashboard })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      onAdded(data as ProjectFolder)
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
          New project folder
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <div>
            <label className="label">Folder name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Marathon training"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 text-sm font-medium text-white rounded-sm disabled:opacity-60 transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? 'Creating…' : 'Create folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
