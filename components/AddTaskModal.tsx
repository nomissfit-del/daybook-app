'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, RepeatType } from '@/lib/types'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  folderId: string
  userId: string
  accentColor: string
  onClose: () => void
  onAdded: (task: Task) => void
}

export default function AddTaskModal({ folderId, userId, accentColor, onClose, onAdded }: Props) {
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [repeatType, setRepeatType] = useState<RepeatType>('once')
  const [weekday, setWeekday] = useState(1) // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1)
  const [onceDate, setOnceDate] = useState(new Date().toLocaleDateString('en-CA'))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const repeatConfig =
      repeatType === 'weekly'
        ? { weekday }
        : repeatType === 'monthly'
        ? { day_of_month: dayOfMonth }
        : repeatType === 'once'
        ? { date: onceDate }
        : {}

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        project_folder_id: folderId,
        title: title.trim(),
        repeat_type: repeatType,
        repeat_config: repeatConfig,
      })
      .select()
      .single()

    if (error) {
      setError(error.message)
      setSaving(false)
    } else {
      onAdded(data as Task)
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
          Add task
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}

          <div>
            <label className="label">Task name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Morning run"
              value={title}
              onChange={e => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="label">Repeats</label>
            <div className="flex gap-2 flex-wrap">
              {(['once', 'daily', 'weekly', 'monthly'] as RepeatType[]).map(rt => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setRepeatType(rt)}
                  className={`flex-1 py-1.5 text-sm rounded-sm border transition-colors capitalize
                    ${repeatType === rt
                      ? 'text-white border-transparent'
                      : 'border-border text-muted hover:border-ink'
                    }`}
                  style={repeatType === rt ? { backgroundColor: accentColor } : {}}
                >
                  {rt === 'once' ? 'One-time' : rt}
                </button>
              ))}
            </div>
          </div>

          {repeatType === 'once' && (
            <div>
              <label className="label">Date</label>
              <input
                type="date"
                className="input"
                value={onceDate}
                onChange={e => setOnceDate(e.target.value)}
              />
            </div>
          )}

          {repeatType === 'weekly' && (
            <div>
              <label className="label">Day of week</label>
              <select
                className="input"
                value={weekday}
                onChange={e => setWeekday(Number(e.target.value))}
              >
                {WEEKDAYS.map((day, i) => (
                  <option key={day} value={i}>{day}</option>
                ))}
              </select>
            </div>
          )}

          {repeatType === 'monthly' && (
            <div>
              <label className="label">Day of month</label>
              <input
                type="number"
                className="input"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={e => setDayOfMonth(Number(e.target.value))}
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="px-4 py-2 text-sm font-medium text-white rounded-sm disabled:opacity-60 transition-colors"
              style={{ backgroundColor: accentColor }}
            >
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
