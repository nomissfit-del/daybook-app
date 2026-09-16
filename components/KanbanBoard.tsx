'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Ticket, Subtask, TicketStatus, TicketPriority } from '@/lib/types'
import TicketModal from './TicketModal'

// ── Column definitions ──────────────────────────────────────────
const COLUMNS: { id: TicketStatus; label: string; dotColor: string }[] = [
  { id: 'todo',        label: 'To Do',       dotColor: '#9CA3AF' },
  { id: 'in_progress', label: 'In Progress',  dotColor: '#F59E0B' },
  { id: 'done',        label: 'Done',         dotColor: '#10B981' },
]

const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#9CA3AF',
  medium: '#F59E0B',
  high: '#EF4444',
}

// ── Helper ──────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function formatDeadline(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Props ───────────────────────────────────────────────────────
interface Props {
  boardId: string
  boardName: string
  userId: string
  accentColor: string
  accentLight: string
  onBoardDeleted: (id: string) => void
}

// ── Component ───────────────────────────────────────────────────
export default function KanbanBoard({
  boardId,
  boardName,
  userId,
  accentColor,
  accentLight,
  onBoardDeleted,
}: Props) {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [subtasks, setSubtasks] = useState<Record<string, Subtask[]>>({})
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null)
  const [addingTo, setAddingTo] = useState<TicketStatus | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ─────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from('tickets')
      .select('*, ticket_subtasks(*)')
      .eq('board_id', boardId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (data) {
      const ts: Ticket[] = []
      const ss: Record<string, Subtask[]> = {}
      for (const row of data) {
        const { ticket_subtasks, ...ticket } = row
        ts.push(ticket as Ticket)
        ss[ticket.id] = (ticket_subtasks as Subtask[]) ?? []
      }
      setTickets(ts)
      setSubtasks(ss)
    }
    setLoading(false)
  }, [boardId, supabase])

  useEffect(() => { fetchData() }, [fetchData])

  // Focus the input when a column's add bar opens
  useEffect(() => {
    if (addingTo) setTimeout(() => addInputRef.current?.focus(), 50)
  }, [addingTo])

  // ── Add ticket ─────────────────────────────────────────────────
  async function handleAddTicket(status: TicketStatus) {
    const title = newTitle.trim()
    if (!title) { setAddingTo(null); return }
    setAdding(true)
    const { data, error } = await supabase
      .from('tickets')
      .insert({
        user_id: userId,
        board_id: boardId,
        title,
        status,
        sort_order: tickets.filter(t => t.status === status).length,
      })
      .select()
      .single()
    setAdding(false)
    if (!error && data) {
      setTickets(prev => [...prev, data as Ticket])
      setSubtasks(prev => ({ ...prev, [data.id]: [] }))
      setNewTitle('')
      setAddingTo(null)
    }
  }

  // ── Move ticket between columns ────────────────────────────────
  async function moveTicket(ticketId: string, direction: 'prev' | 'next') {
    const idx = COLUMNS.findIndex(c => c.id === tickets.find(t => t.id === ticketId)?.status)
    const nextIdx = direction === 'next' ? idx + 1 : idx - 1
    if (nextIdx < 0 || nextIdx >= COLUMNS.length) return
    const newStatus = COLUMNS[nextIdx].id
    await supabase.from('tickets').update({ status: newStatus }).eq('id', ticketId)
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t))
    // If the open modal is this ticket, update it too
    if (activeTicket?.id === ticketId) setActiveTicket(t => t ? { ...t, status: newStatus } : t)
  }

  // ── Delete board ───────────────────────────────────────────────
  async function handleDeleteBoard() {
    if (!confirm(`Delete board "${boardName}" and all its tickets?`)) return
    setDeleting(true)
    await supabase.from('project_folders').delete().eq('id', boardId)
    onBoardDeleted(boardId)
  }

  // ── Ticket update from modal ───────────────────────────────────
  function handleTicketUpdated(updated: Ticket) {
    setTickets(prev => prev.map(t => t.id === updated.id ? updated : t))
    setActiveTicket(updated)
  }

  function handleTicketDeleted(id: string) {
    setTickets(prev => prev.filter(t => t.id !== id))
    setSubtasks(prev => { const n = { ...prev }; delete n[id]; return n })
    setActiveTicket(null)
  }

  function handleSubtasksChanged(ticketId: string, ss: Subtask[]) {
    setSubtasks(prev => ({ ...prev, [ticketId]: ss }))
  }

  // ── Render ─────────────────────────────────────────────────────
  const today = todayStr()

  return (
    <div className="card overflow-hidden">
      {/* Board header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer select-none"
        style={{ backgroundColor: accentLight }}
        onClick={() => setCollapsed(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>{collapsed ? '▸' : '▾'}</span>
          <h3 className="font-serif text-lg" style={{ color: accentColor }}>{boardName}</h3>
          <span className="text-xs font-mono text-muted ml-1">
            {tickets.length > 0 && `${tickets.filter(t => t.status === 'done').length}/${tickets.length}`}
          </span>
        </div>
        <button
          onClick={e => { e.stopPropagation(); handleDeleteBoard() }}
          disabled={deleting}
          className="text-xs text-muted hover:text-red-500 transition-colors px-2 py-1"
        >
          Delete board
        </button>
      </div>

      {!collapsed && (
        <div className="p-4">
          {loading ? (
            <p className="text-xs text-muted text-center py-4">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {COLUMNS.map((col, colIdx) => {
                const colTickets = tickets.filter(t => t.status === col.id)
                return (
                  <div key={col.id} className="flex flex-col gap-2">
                    {/* Column header */}
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dotColor }} />
                      <span className="text-xs font-medium text-muted uppercase tracking-wide">{col.label}</span>
                      <span className="text-xs font-mono text-muted ml-auto">{colTickets.length}</span>
                    </div>

                    {/* Ticket cards */}
                    <div className="flex flex-col gap-2 min-h-[60px]">
                      {colTickets.map(ticket => {
                        const ss = subtasks[ticket.id] ?? []
                        const doneCount = ss.filter(s => s.done).length
                        const isOverdue = ticket.deadline && ticket.deadline < today && ticket.status !== 'done'
                        return (
                          <div
                            key={ticket.id}
                            className="bg-white border border-border rounded-sm p-3 cursor-pointer hover:border-muted transition-colors group"
                            onClick={() => setActiveTicket(ticket)}
                          >
                            {/* Priority + title */}
                            <div className="flex items-start gap-2 mb-2">
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
                                style={{ backgroundColor: PRIORITY_COLORS[ticket.priority] }}
                                title={ticket.priority}
                              />
                              <span className="text-sm font-medium text-ink leading-snug flex-1">
                                {ticket.title}
                              </span>
                            </div>

                            {/* Deadline + subtask count */}
                            <div className="flex items-center justify-between mt-1">
                              {ticket.deadline ? (
                                <span
                                  className="text-xs font-mono px-1.5 py-0.5 rounded-sm"
                                  style={
                                    isOverdue
                                      ? { backgroundColor: '#FEE2E2', color: '#DC2626' }
                                      : { backgroundColor: '#F3F4F6', color: '#6B7280' }
                                  }
                                >
                                  {isOverdue ? '⚠ ' : ''}{formatDeadline(ticket.deadline)}
                                </span>
                              ) : <span />}

                              {ss.length > 0 && (
                                <span className="text-xs text-muted font-mono">
                                  {doneCount}/{ss.length} ✓
                                </span>
                              )}
                            </div>

                            {/* Move arrows */}
                            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {colIdx > 0 && (
                                <button
                                  onClick={e => { e.stopPropagation(); moveTicket(ticket.id, 'prev') }}
                                  className="text-xs text-muted hover:text-ink px-1.5 py-0.5 border border-border rounded-sm hover:border-ink transition-colors"
                                  title={`Move to ${COLUMNS[colIdx - 1].label}`}
                                >
                                  ← {COLUMNS[colIdx - 1].label}
                                </button>
                              )}
                              {colIdx < COLUMNS.length - 1 && (
                                <button
                                  onClick={e => { e.stopPropagation(); moveTicket(ticket.id, 'next') }}
                                  className="text-xs text-muted hover:text-ink px-1.5 py-0.5 border border-border rounded-sm hover:border-ink transition-colors ml-auto"
                                  title={`Move to ${COLUMNS[colIdx + 1].label}`}
                                >
                                  {COLUMNS[colIdx + 1].label} →
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Add ticket row */}
                    {addingTo === col.id ? (
                      <div className="flex flex-col gap-1">
                        <input
                          ref={addInputRef}
                          type="text"
                          className="text-sm border border-border rounded-sm px-2 py-1.5 outline-none focus:border-ink font-mono w-full"
                          placeholder="Ticket title…"
                          value={newTitle}
                          onChange={e => setNewTitle(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleAddTicket(col.id)
                            if (e.key === 'Escape') { setAddingTo(null); setNewTitle('') }
                          }}
                        />
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleAddTicket(col.id)}
                            disabled={adding}
                            className="flex-1 text-xs py-1 rounded-sm text-white transition-opacity disabled:opacity-60"
                            style={{ backgroundColor: accentColor }}
                          >
                            {adding ? 'Adding…' : 'Add ticket'}
                          </button>
                          <button
                            onClick={() => { setAddingTo(null); setNewTitle('') }}
                            className="text-xs px-2 py-1 border border-border rounded-sm hover:border-ink text-muted"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingTo(col.id); setNewTitle('') }}
                        className="text-xs text-muted hover:text-ink border border-dashed border-border hover:border-muted rounded-sm py-1.5 transition-colors text-center w-full"
                      >
                        + Add ticket
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Ticket detail modal */}
      {activeTicket && (
        <TicketModal
          ticket={activeTicket}
          subtasks={subtasks[activeTicket.id] ?? []}
          userId={userId}
          accentColor={accentColor}
          onClose={() => setActiveTicket(null)}
          onUpdated={handleTicketUpdated}
          onDeleted={handleTicketDeleted}
          onSubtasksChanged={handleSubtasksChanged}
        />
      )}
    </div>
  )
}
