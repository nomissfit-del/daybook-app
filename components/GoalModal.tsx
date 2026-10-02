'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalCategory, GoalStatus, Milestone } from '@/lib/types'
import { CATEGORY_META, GOALS_ACCENT, STATUS_LABELS, sortMilestones, TONE_COLORS } from '@/lib/goals'

interface DraftMilestone {
  key: string
  id: string | null   // null until saved
  title: string
  target_date: string | null
  done: boolean
  done_at: string | null
}

interface Props {
  goal: Goal | null   // null means creating a new goal
  userId: string
  todayStr: string
  defaultCategory: GoalCategory
  onClose: () => void
  onSaved: (goal: Goal) => void
  onDeleted: (goalId: string) => void
}

let keySeq = 0
const newKey = () => `tmp_${++keySeq}`

function toDraft(m: Milestone): DraftMilestone {
  return { key: m.id, id: m.id, title: m.title, target_date: m.target_date, done: m.done, done_at: m.done_at }
}

export default function GoalModal({ goal, userId, todayStr, defaultCategory, onClose, onSaved, onDeleted }: Props) {
  const supabase = createClient()
  const isNew = goal === null

  const [title, setTitle] = useState(goal?.title ?? '')
  const [why, setWhy] = useState(goal?.why ?? '')
  const [category, setCategory] = useState<GoalCategory>(goal?.category ?? defaultCategory)
  const [startDate, setStartDate] = useState(goal?.start_date ?? todayStr)
  const [deadline, setDeadline] = useState(goal?.deadline ?? '')
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'active')
  const [milestones, setMilestones] = useState<DraftMilestone[]>(
    sortMilestones(goal?.goal_milestones ?? []).map(toDraft)
  )
  const [newMsTitle, setNewMsTitle] = useState('')
  const [newMsDate, setNewMsDate] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const msInputRef = useRef<HTMLInputElement>(null)

  const touch = () => setDirty(true)

  // ── Milestone draft editing ────────────────────────────────────
  function addMilestone() {
    const t = newMsTitle.trim()
    if (!t) return
    setMilestones(prev => [...prev, { key: newKey(), id: null, title: t, target_date: newMsDate || null, done: false, done_at: null }])
    setNewMsTitle('')
    setNewMsDate('')
    touch()
    msInputRef.current?.focus()
  }

  function patchMilestone(key: string, changes: Partial<DraftMilestone>) {
    setMilestones(prev => prev.map(m => m.key === key ? { ...m, ...changes } : m))
    touch()
  }

  function toggleMilestone(m: DraftMilestone) {
    patchMilestone(m.key, { done: !m.done, done_at: !m.done ? todayStr : null })
  }

  function moveMilestone(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= milestones.length) return
    setMilestones(prev => {
      const next = [...prev]
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
    touch()
  }

  function removeMilestone(key: string) {
    setMilestones(prev => prev.filter(m => m.key !== key))
    touch()
  }

  const doneCount = milestones.filter(m => m.done).length
  const allDone = milestones.length > 0 && doneCount === milestones.length
  const suggestAchieved = allDone && status === 'active'

  // ── Save ───────────────────────────────────────────────────────
  async function handleSave() {
    setError(null)
    if (!title.trim()) { setError('Give the goal a title.'); return }
    if (!deadline) { setError('Set a deadline.'); return }
    if (deadline < startDate) { setError('The deadline must be on or after the start date.'); return }

    setSaving(true)
    const payload = {
      title: title.trim(),
      why: why.trim() || null,
      category,
      start_date: startDate,
      deadline,
      status,
      achieved_at: status === 'achieved'
        ? (goal?.status === 'achieved' && goal.achieved_at ? goal.achieved_at : new Date().toISOString())
        : null,
    }

    const goalRes = isNew
      ? await supabase.from('goals').insert({ ...payload, user_id: userId }).select().single()
      : await supabase.from('goals').update(payload).eq('id', goal.id).select().single()

    if (goalRes.error || !goalRes.data) {
      setSaving(false)
      setError(goalRes.error?.message ?? 'Could not save the goal.')
      return
    }
    const goalId: string = goalRes.data.id

    // Milestones: delete removed, update existing, insert new
    const keptIds = new Set(milestones.filter(m => m.id).map(m => m.id as string))
    const removedIds = (goal?.goal_milestones ?? []).map(m => m.id).filter(id => !keptIds.has(id))

    const ops: PromiseLike<{ error: { message: string } | null }>[] = []
    if (removedIds.length > 0) {
      ops.push(supabase.from('goal_milestones').delete().in('id', removedIds))
    }
    milestones.forEach((m, i) => {
      const row = { title: m.title.trim() || 'Untitled milestone', target_date: m.target_date, done: m.done, done_at: m.done_at, sort_order: i }
      if (m.id) ops.push(supabase.from('goal_milestones').update(row).eq('id', m.id))
    })
    const inserts = milestones
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !m.id)
      .map(({ m, i }) => ({
        user_id: userId, goal_id: goalId, title: m.title.trim() || 'Untitled milestone',
        target_date: m.target_date, done: m.done, done_at: m.done_at, sort_order: i,
      }))
    if (inserts.length > 0) ops.push(supabase.from('goal_milestones').insert(inserts))

    const results = await Promise.all(ops)
    const failed = results.find(r => r.error)

    const { data: freshMs } = await supabase
      .from('goal_milestones')
      .select('*')
      .eq('goal_id', goalId)
      .order('sort_order', { ascending: true })

    setSaving(false)
    const saved: Goal = { ...(goalRes.data as Goal), goal_milestones: (freshMs ?? []) as Milestone[] }
    onSaved(saved)

    if (failed?.error) {
      setError(`Goal saved, but some milestones failed: ${failed.error.message}`)
      setMilestones(sortMilestones(saved.goal_milestones).map(toDraft))
      setDirty(false)
      return
    }
    onClose()
  }

  async function handleDelete() {
    if (!goal) return
    if (!confirm(`Delete goal "${goal.title}" and all its milestones?`)) return
    setDeleting(true)
    const { error } = await supabase.from('goals').delete().eq('id', goal.id)
    setDeleting(false)
    if (error) { setError(error.message); return }
    onDeleted(goal.id)
    onClose()
  }

  function handleClose() {
    if (dirty && !confirm('Discard your unsaved changes?')) return
    onClose()
  }

  const fieldCls = 'text-sm border border-border rounded-sm px-2 py-1 bg-white outline-none focus:border-ink'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={handleClose}>
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />

      <div
        className="relative bg-white border border-border rounded-sm shadow-xl w-full max-w-xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-border"
          style={{ backgroundColor: `${GOALS_ACCENT}14` }}
        >
          <span className="text-xs font-mono text-muted uppercase tracking-wide">
            {isNew ? 'New goal' : 'Edit goal'}
          </span>
          <button onClick={handleClose} className="text-muted hover:text-ink text-lg leading-none px-1" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Title */}
          <input
            type="text"
            className="w-full font-serif text-xl text-ink border-0 outline-none border-b border-transparent focus:border-border pb-1 bg-transparent"
            value={title}
            onChange={e => { setTitle(e.target.value); touch() }}
            placeholder="What do you want to achieve?"
            autoFocus={isNew}
          />

          {/* Why */}
          <div>
            <label className="text-xs text-muted block mb-1 uppercase tracking-wide">Why it matters</label>
            <textarea
              className="w-full text-sm border border-border rounded-sm px-3 py-2 outline-none focus:border-ink bg-white resize-none"
              rows={2}
              placeholder="Your motivation, so future you remembers…"
              value={why}
              onChange={e => { setWhy(e.target.value); touch() }}
            />
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Category</label>
              <select className={`${fieldCls} w-full`} value={category} onChange={e => { setCategory(e.target.value as GoalCategory); touch() }}>
                {(Object.keys(CATEGORY_META) as GoalCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Status</label>
              <select className={`${fieldCls} w-full`} value={status} onChange={e => { setStatus(e.target.value as GoalStatus); touch() }}>
                {(Object.keys(STATUS_LABELS) as GoalStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Start</label>
              <input type="date" className={`${fieldCls} w-full`} value={startDate} onChange={e => { setStartDate(e.target.value); touch() }} />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Deadline</label>
              <input type="date" className={`${fieldCls} w-full`} value={deadline} min={startDate} onChange={e => { setDeadline(e.target.value); touch() }} />
            </div>
          </div>

          {/* Achieved suggestion */}
          {suggestAchieved && (
            <div className="flex items-center justify-between gap-3 rounded-sm px-3 py-2 text-sm" style={{ backgroundColor: '#E2ECDF', color: GOALS_ACCENT }}>
              <span>Every milestone is done. Mark this goal as achieved?</span>
              <button
                onClick={() => { setStatus('achieved'); touch() }}
                className="text-xs px-3 py-1 rounded-sm text-white flex-shrink-0"
                style={{ backgroundColor: GOALS_ACCENT }}
              >
                Mark achieved
              </button>
            </div>
          )}

          {/* Milestones */}
          <div>
            <label className="text-xs text-muted uppercase tracking-wide block mb-2">
              Milestones
              {milestones.length > 0 && <span className="ml-1 font-mono">({doneCount}/{milestones.length})</span>}
            </label>

            {milestones.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {milestones.map((m, i) => {
                  const late = !m.done && m.target_date && m.target_date < todayStr
                  return (
                    <li key={m.key} className="flex items-center gap-2 group">
                      <button
                        onClick={() => toggleMilestone(m)}
                        className={`w-4 h-4 rounded-sm border flex-shrink-0 transition-colors
                          ${m.done ? 'border-ink bg-ink' : 'border-border hover:border-muted'}`}
                        aria-label={m.done ? 'Mark not done' : 'Mark done'}
                      >
                        {m.done && (
                          <svg viewBox="0 0 12 12" className="w-full h-full text-white">
                            <polyline points="2,6 5,9 10,3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        )}
                      </button>
                      <input
                        type="text"
                        className={`flex-1 min-w-0 text-sm bg-transparent outline-none border-b border-transparent focus:border-border
                          ${m.done ? 'line-through text-muted' : 'text-ink'}`}
                        value={m.title}
                        onChange={e => patchMilestone(m.key, { title: e.target.value })}
                      />
                      <input
                        type="date"
                        className="text-xs font-mono border border-transparent hover:border-border focus:border-ink rounded-sm px-1 py-0.5 outline-none bg-transparent w-[8.5rem]"
                        style={late ? { color: TONE_COLORS.danger } : {}}
                        value={m.target_date ?? ''}
                        onChange={e => patchMilestone(m.key, { target_date: e.target.value || null })}
                        aria-label="Target date"
                      />
                      <div className="flex items-center sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => moveMilestone(i, -1)} disabled={i === 0} className="text-xs text-muted hover:text-ink disabled:opacity-30 px-1" aria-label="Move up">▲</button>
                        <button onClick={() => moveMilestone(i, 1)} disabled={i === milestones.length - 1} className="text-xs text-muted hover:text-ink disabled:opacity-30 px-1" aria-label="Move down">▼</button>
                        <button onClick={() => removeMilestone(m.key)} className="text-xs text-muted hover:text-red-500 px-1" aria-label="Remove milestone">✕</button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <div className="flex gap-2">
              <input
                ref={msInputRef}
                type="text"
                className="flex-1 min-w-0 text-sm border border-border rounded-sm px-2 py-1 outline-none focus:border-ink"
                placeholder="Add a milestone…"
                value={newMsTitle}
                onChange={e => setNewMsTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addMilestone() }}
              />
              <input
                type="date"
                className="text-xs font-mono border border-border rounded-sm px-1.5 py-1 outline-none focus:border-ink w-[8.5rem]"
                value={newMsDate}
                min={startDate}
                max={deadline || undefined}
                onChange={e => setNewMsDate(e.target.value)}
                aria-label="Milestone target date"
              />
              <button onClick={addMilestone} className="text-xs px-3 py-1 border border-border rounded-sm hover:border-ink transition-colors">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-gray-50/50">
          {isNew ? <span /> : (
            <button onClick={handleDelete} disabled={deleting} className="text-xs text-muted hover:text-red-500 transition-colors">
              {deleting ? 'Deleting…' : 'Delete goal'}
            </button>
          )}
          <div className="flex items-center gap-2">
            <button onClick={handleClose} className="btn-ghost">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving || (!isNew && !dirty)}
              className="text-sm px-4 py-1.5 rounded-sm text-white disabled:opacity-40 transition-opacity"
              style={{ backgroundColor: GOALS_ACCENT }}
            >
              {saving ? 'Saving…' : isNew ? 'Create goal' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
