'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Ticket, Subtask, TicketStatus, TicketPriority } from '@/lib/types'

const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#6B7280',
  medium: '#B45309',
  high: '#DC2626',
}

interface Props {
  ticket: Ticket
  subtasks: Subtask[]
  userId: string
  accentColor: string
  onClose: () => void
  onUpdated: (ticket: Ticket) => void
  onDeleted: (ticketId: string) => void
  onSubtasksChanged: (ticketId: string, subtasks: Subtask[]) => void
}

export default function TicketModal({
  ticket: initial,
  subtasks: initialSubtasks,
  userId,
  accentColor,
  onClose,
  onUpdated,
  onDeleted,
  onSubtasksChanged,
}: Props) {
  const supabase = createClient()
  const [ticket, setTicket] = useState<Ticket>(initial)
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks)
  const [newSubtask, setNewSubtask] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [dirty, setDirty] = useState(false)
  const subtaskInputRef = useRef<HTMLInputElement>(null)

  // Sync subtasks if parent updates
  useEffect(() => { setSubtasks(initialSubtasks) }, [initialSubtasks])

  function update(changes: Partial<Ticket>) {
    setTicket(t => ({ ...t, ...changes }))
    setDirty(true)
  }

  async function handleSave() {
    if (!ticket.title.trim()) return
    setSaving(true)
    const { data, error } = await supabase
      .from('tickets')
      .update({
        title: ticket.title.trim(),
        description: ticket.description?.trim() || null,
        status: ticket.status,
        priority: ticket.priority,
        deadline: ticket.deadline || null,
      })
      .eq('id', ticket.id)
      .select()
      .single()
    setSaving(false)
    if (!error && data) {
      onUpdated(data as Ticket)
      setDirty(false)
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ticket "${ticket.title}"?`)) return
    setDeleting(true)
    await supabase.from('tickets').delete().eq('id', ticket.id)
    onDeleted(ticket.id)
    onClose()
  }

  async function addSubtask() {
    const title = newSubtask.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('ticket_subtasks')
      .insert({
        ticket_id: ticket.id,
        user_id: userId,
        title,
        sort_order: subtasks.length,
      })
      .select()
      .single()
    if (!error && data) {
      const next = [...subtasks, data as Subtask]
      setSubtasks(next)
      onSubtasksChanged(ticket.id, next)
      setNewSubtask('')
      subtaskInputRef.current?.focus()
    }
  }

  async function toggleSubtask(st: Subtask) {
    const { data, error } = await supabase
      .from('ticket_subtasks')
      .update({ done: !st.done })
      .eq('id', st.id)
      .select()
      .single()
    if (!error && data) {
      const next = subtasks.map(s => s.id === st.id ? data as Subtask : s)
      setSubtasks(next)
      onSubtasksChanged(ticket.id, next)
    }
  }

  async function deleteSubtask(stId: string) {
    await supabase.from('ticket_subtasks').delete().eq('id', stId)
    const next = subtasks.filter(s => s.id !== stId)
    setSubtasks(next)
    onSubtasksChanged(ticket.id, next)
  }

  const isOverdue = ticket.deadline
    ? ticket.deadline < new Date().toISOString().slice(0, 10) && ticket.status !== 'done'
    : false

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

      <div
        className="relative bg-white border border-border rounded-sm shadow-xl w-full max-w-lg"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-border"
          style={{ backgroundColor: `${accentColor}14` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: PRIORITY_COLORS[ticket.priority] }}
              title={`Priority: ${PRIORITY_LABELS[ticket.priority]}`}
            />
            <span className="text-xs font-mono text-muted uppercase tracking-wide">
              {STATUS_LABELS[ticket.status]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-xs px-3 py-1.5 rounded-sm text-white transition-opacity"
                style={{ backgroundColor: accentColor }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-muted hover:text-ink text-lg leading-none px-1"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Title */}
          <input
            type="text"
            className="w-full font-serif text-xl text-ink border-0 outline-none border-b border-transparent focus:border-border pb-1 bg-transparent"
            value={ticket.title}
            onChange={e => update({ title: e.target.value })}
            onBlur={() => dirty && handleSave()}
            placeholder="Ticket title"
          />

          {/* Meta row: status, priority, deadline */}
          <div className="flex flex-wrap gap-3 items-center">
            <div>
              <label className="text-xs text-muted block mb-1">Status</label>
              <select
                className="text-sm border border-border rounded-sm px-2 py-1 bg-white outline-none focus:border-ink"
                value={ticket.status}
                onChange={e => update({ status: e.target.value as TicketStatus })}
              >
                {(Object.keys(STATUS_LABELS) as TicketStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Priority</label>
              <select
                className="text-sm border border-border rounded-sm px-2 py-1 bg-white outline-none focus:border-ink"
                value={ticket.priority}
                onChange={e => update({ priority: e.target.value as TicketPriority })}
              >
                {(Object.keys(PRIORITY_LABELS) as TicketPriority[]).map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Deadline</label>
              <input
                type="date"
                className="text-sm border border-border rounded-sm px-2 py-1 bg-white outline-none focus:border-ink"
                value={ticket.deadline ?? ''}
                onChange={e => update({ deadline: e.target.value || null })}
                style={isOverdue ? { borderColor: '#DC2626', color: '#DC2626' } : {}}
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted block mb-1 uppercase tracking-wide">Description</label>
            <textarea
              className="w-full text-sm border border-border rounded-sm px-3 py-2 outline-none focus:border-ink bg-white resize-none font-mono"
              rows={4}
              placeholder="Add a description…"
              value={ticket.description ?? ''}
              onChange={e => update({ description: e.target.value })}
              onBlur={() => dirty && handleSave()}
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted uppercase tracking-wide">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1 font-mono">
                    ({subtasks.filter(s => s.done).length}/{subtasks.length})
                  </span>
                )}
              </label>
            </div>

            {subtasks.length > 0 && (
              <ul className="space-y-1 mb-2">
                {subtasks.map(st => (
                  <li key={st.id} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleSubtask(st)}
                      className={`w-4 h-4 rounded-sm border flex-shrink-0 transition-colors
                        ${st.done ? 'border-ink bg-ink' : 'border-border hover:border-muted'}`}
                      aria-label={st.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {st.done && (
                        <svg viewBox="0 0 12 12" className="w-full h-full text-white">
                          <polyline points="2,6 5,9 10,3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      )}
                    </button>
                    <span className={`text-sm flex-1 font-mono ${st.done ? 'line-through text-muted' : 'text-ink'}`}>
                      {st.title}
                    </span>
                    <button
                      onClick={() => deleteSubtask(st.id)}
                      className="text-xs text-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity px-1"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Add subtask */}
            <div className="flex gap-2">
              <input
                ref={subtaskInputRef}
                type="text"
                className="flex-1 text-sm border border-border rounded-sm px-2 py-1 outline-none focus:border-ink font-mono"
                placeholder="Add subtask…"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
              />
              <button
                onClick={addSubtask}
                className="text-xs px-3 py-1 border border-border rounded-sm hover:border-ink transition-colors"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-gray-50/50">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-muted hover:text-red-500 transition-colors"
          >
            {deleting ? 'Deleting…' : 'Delete ticket'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className="text-sm px-4 py-1.5 rounded-sm text-white disabled:opacity-40 transition-opacity"
            style={{ backgroundColor: accentColor }}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
