'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Task, TaskCompletion } from '@/lib/types'

const REPEAT_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  once: 'One-time',
}

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function repeatLabel(task: Task): string {
  if (task.repeat_type === 'weekly' && task.repeat_config.weekday !== undefined) {
    return `Every ${WEEKDAY_NAMES[task.repeat_config.weekday]}`
  }
  if (task.repeat_type === 'monthly' && task.repeat_config.day_of_month !== undefined) {
    return `Monthly (${task.repeat_config.day_of_month}${ordinal(task.repeat_config.day_of_month)})`
  }
  if (task.repeat_type === 'once' && task.repeat_config.date) {
    return new Date(task.repeat_config.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
  return REPEAT_LABELS[task.repeat_type] ?? task.repeat_type
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}

interface Props {
  task: Task
  todayStr: string
  completedToday: boolean
  userId: string
  onCompletionToggled: (completion: TaskCompletion | null, taskId: string, date: string) => void
  onDeleted: (taskId: string) => void
}

export default function TaskItem({
  task,
  todayStr,
  completedToday,
  userId,
  onCompletionToggled,
  onDeleted,
}: Props) {
  const supabase = createClient()
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [saving, setSaving] = useState(false)

  const todayDate = new Date(todayStr + 'T00:00:00')
  const dow = todayDate.getDay()
  const dom = todayDate.getDate()

  const dueToday =
    task.repeat_type === 'daily' ||
    (task.repeat_type === 'weekly' && task.repeat_config.weekday === dow) ||
    (task.repeat_type === 'monthly' && task.repeat_config.day_of_month === dom) ||
    (task.repeat_type === 'once' && task.repeat_config.date === todayStr)

  async function handleToggle() {
    if (!dueToday || toggling) return
    setToggling(true)
    if (!completedToday) {
      const { data, error } = await supabase
        .from('task_completions')
        .insert({ user_id: userId, task_id: task.id, completed_date: todayStr })
        .select()
        .single()
      if (!error && data) onCompletionToggled(data as TaskCompletion, task.id, todayStr)
    } else {
      const { error } = await supabase
        .from('task_completions')
        .delete()
        .eq('task_id', task.id)
        .eq('completed_date', todayStr)
      if (!error) onCompletionToggled(null, task.id, todayStr)
    }
    setToggling(false)
  }

  async function handleSaveEdit() {
    if (!editTitle.trim() || editTitle === task.title) { setEditing(false); return }
    setSaving(true)
    await supabase.from('tasks').update({ title: editTitle.trim() }).eq('id', task.id)
    task.title = editTitle.trim()
    setSaving(false)
    setEditing(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete task "${task.title}"?`)) return
    setDeleting(true)
    await supabase.from('tasks').delete().eq('id', task.id)
    onDeleted(task.id)
  }

  if (editing) {
    return (
      <li className="flex items-center gap-2 py-1">
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false) }}
          autoFocus
          className="flex-1 text-sm border border-border rounded-sm px-2 py-1 outline-none focus:border-ink bg-transparent"
        />
        <button onClick={handleSaveEdit} disabled={saving} className="text-xs px-2 py-1 border border-border rounded-sm hover:border-ink">
          {saving ? '…' : 'Save'}
        </button>
        <button onClick={() => setEditing(false)} className="text-xs text-muted">Cancel</button>
      </li>
    )
  }

  return (
    <li className="flex items-center gap-3 py-1 group">
      {/* Checkbox */}
      <button
        onClick={handleToggle}
        disabled={!dueToday || toggling}
        className={`w-5 h-5 rounded-sm border flex-shrink-0 transition-colors
          ${dueToday ? 'cursor-pointer' : 'cursor-default opacity-40'}
          ${completedToday ? 'bg-ink border-ink' : 'border-border bg-paper hover:border-muted'}`}
        aria-label={completedToday ? 'Mark incomplete' : 'Mark complete'}
      >
        {completedToday && (
          <svg viewBox="0 0 12 12" className="w-full h-full text-paper">
            <polyline points="2,6 5,9 10,3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Title */}
      <span className={`text-sm flex-1 font-mono ${completedToday ? 'line-through text-muted' : dueToday ? 'text-ink' : 'text-muted'}`}>
        {task.title}
      </span>

      {/* Repeat label */}
      <span className="text-xs text-muted hidden sm:block">{repeatLabel(task)}</span>

      {/* Edit & Delete — always visible on mobile, hover on desktop */}
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => { setEditTitle(task.title); setEditing(true) }}
          className="text-xs text-muted hover:text-ink px-1"
          aria-label="Edit task"
        >✎</button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-muted hover:text-red-500 px-1"
          aria-label="Delete task"
        >✕</button>
      </div>
    </li>
  )
}
