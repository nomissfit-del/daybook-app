'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Goal, GoalCategory, Milestone } from '@/lib/types'
import { ATTENTION, GOALS_ACCENT, GOALS_ACCENT_LIGHT, goalHealth } from '@/lib/goals'
import NavBar from './NavBar'
import GoalCard from './GoalCard'
import GoalModal from './GoalModal'

type CategoryFilter = 'all' | GoalCategory
type View = 'active' | 'achieved' | 'dropped'

interface Props {
  userId: string
  userEmail: string
  initialGoals: Goal[]
  todayStr: string
  loadError: string | null
}

export default function GoalsBoard({ userId, userEmail, initialGoals, todayStr, loadError }: Props) {
  const supabase = createClient()
  const [goals, setGoals] = useState<Goal[]>(
    initialGoals.map(g => ({ ...g, goal_milestones: g.goal_milestones ?? [] }))
  )
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [view, setView] = useState<View>('active')
  const [editing, setEditing] = useState<Goal | 'new' | null>(null)

  const inCategory = useMemo(
    () => goals.filter(g => category === 'all' || g.category === category),
    [goals, category]
  )

  const counts = useMemo(() => {
    const active = inCategory.filter(g => g.status === 'active' || g.status === 'on_hold')
    const year = todayStr.slice(0, 4)
    return {
      active: active.length,
      onTrack: active.filter(g => goalHealth(g, todayStr) === 'on_track').length,
      attention: active.filter(g => ATTENTION.includes(goalHealth(g, todayStr))).length,
      achievedThisYear: inCategory.filter(g => g.status === 'achieved' && (g.achieved_at ?? '').startsWith(year)).length,
      achieved: inCategory.filter(g => g.status === 'achieved').length,
      dropped: inCategory.filter(g => g.status === 'dropped').length,
    }
  }, [inCategory, todayStr])

  const visible = useMemo(() => {
    if (view === 'achieved') {
      return inCategory
        .filter(g => g.status === 'achieved')
        .sort((a, b) => (b.achieved_at ?? '').localeCompare(a.achieved_at ?? ''))
    }
    if (view === 'dropped') return inCategory.filter(g => g.status === 'dropped')
    // Active first (soonest deadline first), on hold goals after
    return inCategory
      .filter(g => g.status === 'active' || g.status === 'on_hold')
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1
        return a.deadline.localeCompare(b.deadline)
      })
  }, [inCategory, view])

  // ── Mutations ──────────────────────────────────────────────────
  function handleSaved(saved: Goal) {
    setGoals(prev => prev.some(g => g.id === saved.id)
      ? prev.map(g => g.id === saved.id ? saved : g)
      : [...prev, saved])
  }

  function handleDeleted(id: string) {
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  async function handleToggleMilestone(goal: Goal, m: Milestone) {
    const done = !m.done
    const done_at = done ? todayStr : null
    // Optimistic update
    const apply = (val: boolean, at: string | null) => setGoals(prev => prev.map(g => g.id !== goal.id ? g : {
      ...g,
      goal_milestones: g.goal_milestones.map(x => x.id === m.id ? { ...x, done: val, done_at: at } : x),
    }))
    apply(done, done_at)
    const { error } = await supabase.from('goal_milestones').update({ done, done_at }).eq('id', m.id)
    if (error) apply(m.done, m.done_at)
  }

  // ── Render ─────────────────────────────────────────────────────
  const pill = (active: boolean) =>
    `px-3 py-1 text-xs rounded-sm border transition-colors ${active ? 'font-medium' : 'border-border text-muted hover:text-ink'}`
  const pillStyle = (active: boolean) =>
    active ? { color: GOALS_ACCENT, backgroundColor: GOALS_ACCENT_LIGHT, borderColor: GOALS_ACCENT_LIGHT } : {}

  return (
    <div className="min-h-screen">
      <NavBar active="goals" userEmail={userEmail} />

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-serif text-3xl" style={{ color: GOALS_ACCENT }}>Goals</h1>
            <p className="text-sm text-muted mt-1">The bigger things you are working towards, and the steps to get there.</p>
          </div>
          <button
            onClick={() => setEditing('new')}
            className="text-sm font-medium px-4 py-2 rounded-sm text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: GOALS_ACCENT }}
          >
            + New goal
          </button>
        </div>

        {loadError && (
          <div className="card p-4 text-sm text-red-700 border-red-200 bg-red-50">
            Could not load goals: {loadError}. If this is the first time, run <span className="font-mono">supabase/goals_migration.sql</span> in the Supabase SQL Editor.
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active', value: counts.active, color: '#2A2118' },
            { label: 'On track', value: counts.onTrack, color: '#2F6B43' },
            { label: 'Need attention', value: counts.attention, color: counts.attention > 0 ? '#B42318' : '#2A2118' },
            { label: `Achieved in ${todayStr.slice(0, 4)}`, value: counts.achievedThisYear, color: GOALS_ACCENT },
          ].map(s => (
            <div key={s.label} className="card px-4 py-3">
              <div className="text-2xl font-serif" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-muted uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5">
            {(['active', 'achieved', 'dropped'] as View[]).map(v => (
              <button key={v} onClick={() => setView(v)} className={pill(view === v)} style={pillStyle(view === v)}>
                {v === 'active' ? 'Active' : v === 'achieved' ? `Achieved (${counts.achieved})` : `Dropped (${counts.dropped})`}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(['all', 'personal', 'work'] as CategoryFilter[]).map(c => (
              <button key={c} onClick={() => setCategory(c)} className={pill(category === c)} style={pillStyle(category === c)}>
                {c === 'all' ? 'All' : c === 'personal' ? 'Personal' : 'Work'}
              </button>
            ))}
          </div>
        </div>

        {/* Goals */}
        {visible.length === 0 ? (
          <div className="text-center py-14 text-muted text-sm border border-dashed border-border rounded-sm">
            {view === 'active' && (
              <>
                <p>No active goals{category !== 'all' ? ' in this category' : ''} yet.</p>
                <button onClick={() => setEditing('new')} className="mt-3 text-sm font-medium underline" style={{ color: GOALS_ACCENT }}>
                  Set your first goal
                </button>
              </>
            )}
            {view === 'achieved' && <p>Nothing achieved yet. Your finished goals will collect here.</p>}
            {view === 'dropped' && <p>No dropped goals.</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visible.map(goal => (
              <GoalCard
                key={goal.id}
                goal={goal}
                todayStr={todayStr}
                onOpen={g => setEditing(g)}
                onToggleMilestone={handleToggleMilestone}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <GoalModal
          goal={editing === 'new' ? null : editing}
          userId={userId}
          todayStr={todayStr}
          defaultCategory={category === 'work' ? 'work' : 'personal'}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
