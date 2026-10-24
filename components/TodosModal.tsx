'use client'

import { useEffect, useState } from 'react'

export interface TodoItem {
  text: string            // kept in sync with title (Telegram reminders read it)
  done: boolean
  title?: string
  description?: string
  created_at?: string     // ISO timestamp
  url?: string
  source?: string
  thread_id?: string
}

export const todoTitle = (t: TodoItem) => (t.title ?? t.text ?? '')

function formatCreated(iso?: string): string {
  if (!iso) return 'No date'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'No date'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TodosModal({
  todos,
  weekLabel,
  initialIndex,
  onChange,
  onClose,
}: {
  todos: TodoItem[]
  weekLabel: string
  initialIndex?: number | null
  onChange: (todos: TodoItem[]) => void
  onClose: () => void
}) {
  const [expanded, setExpanded] = useState<number | null>(initialIndex ?? null)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Only real items (skip empty placeholder rows), keeping their original index
  const items = todos
    .map((t, index) => ({ t, index }))
    .filter(({ t }) => todoTitle(t).trim() || (t.description ?? '').trim())

  const patch = (index: number, p: Partial<TodoItem>) => {
    onChange(todos.map((t, i) => {
      if (i !== index) return t
      const next = { ...t, ...p }
      if (p.title !== undefined) next.text = p.title
      return next
    }))
  }

  const remove = (index: number) => {
    const next = todos.filter((_, i) => i !== index)
    onChange(next.length ? next : [{ text: '', done: false }])
    setExpanded(null)
  }

  const add = () => {
    const title = newTitle.trim()
    if (!title) return
    const item: TodoItem = {
      text: title, title, done: false,
      description: newDesc.trim(),
      created_at: new Date().toISOString(),
    }
    // insert before trailing empty placeholder rows
    const next = [...todos]
    let i = next.length
    while (i > 0 && !todoTitle(next[i - 1]).trim()) i--
    next.splice(i, 0, item)
    onChange(next)
    setNewTitle('')
    setNewDesc('')
  }

  const open = items.filter(({ t }) => !t.done).length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

      <div
        className="relative bg-white border border-border rounded-sm shadow-xl w-full max-w-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border" style={{ backgroundColor: '#F5F0E8' }}>
          <div>
            <p className="font-serif text-lg italic text-ink">to do</p>
            <p className="text-xs text-muted font-mono">{weekLabel} · {open} open / {items.length}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink text-lg leading-none px-1">✕</button>
        </div>

        {/* List */}
        <div className="divide-y divide-border">
          {items.length === 0 && (
            <p className="px-5 py-6 text-sm text-muted/60 italic text-center">No to-dos this week.</p>
          )}
          {items.map(({ t, index }) => {
            const isOpen = expanded === index
            return (
              <div key={index} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={t.done}
                    onChange={() => patch(index, { done: !t.done })}
                    className="mt-1 w-4 h-4 rounded-sm flex-shrink-0 accent-[#B85C38]"
                  />
                  <div className="flex-1 min-w-0">
                    {isOpen ? (
                      <input
                        type="text"
                        value={todoTitle(t)}
                        onChange={e => patch(index, { title: e.target.value })}
                        placeholder="Title"
                        autoFocus
                        className="w-full text-sm font-medium text-ink border-b border-border focus:border-ink outline-none bg-transparent pb-1"
                      />
                    ) : (
                      <button
                        onClick={() => setExpanded(index)}
                        className={`text-left w-full text-sm font-medium break-words ${t.done ? 'line-through text-muted' : 'text-ink'}`}
                      >
                        {todoTitle(t) || <span className="italic text-muted">Untitled</span>}
                      </button>
                    )}
                    <p className="text-xs text-muted font-mono mt-0.5">
                      Created {formatCreated(t.created_at)}
                      {t.source === 'email' && ' · 📧 from email'}
                    </p>

                    {isOpen ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          value={t.description ?? ''}
                          onChange={e => patch(index, { description: e.target.value })}
                          placeholder="Description…"
                          rows={Math.max(3, (t.description ?? '').split('\n').length + 1)}
                          className="w-full text-sm text-ink border border-border rounded-sm p-2 outline-none focus:border-ink bg-transparent leading-relaxed resize-y"
                        />
                        <div className="flex items-center justify-between">
                          <button onClick={() => remove(index)} className="text-xs text-muted hover:text-red-500">Delete</button>
                          <button onClick={() => setExpanded(null)} className="text-xs px-3 py-1 border border-border rounded-sm hover:border-ink">Done</button>
                        </div>
                      </div>
                    ) : (
                      t.description?.trim() && (
                        <p
                          onClick={() => setExpanded(index)}
                          className="mt-1 text-sm text-ink/80 whitespace-pre-wrap break-words cursor-text leading-relaxed"
                        >
                          {t.description}
                        </p>
                      )
                    )}

                    {t.url && (
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-xs text-[#B85C38] hover:underline">
                        Open email ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add new */}
        <div className="px-5 py-4 border-t border-border bg-paper/40 space-y-2">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add() }}
            placeholder="New to-do title…"
            className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-white"
          />
          <textarea
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink bg-white resize-y"
          />
          <div className="flex justify-end">
            <button
              onClick={add}
              disabled={!newTitle.trim()}
              className="text-xs px-3 py-1.5 rounded-sm text-white disabled:opacity-40"
              style={{ backgroundColor: '#B85C38' }}
            >Add to-do</button>
          </div>
        </div>
      </div>
    </div>
  )
}
