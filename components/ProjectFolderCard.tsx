'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ProjectFolder, Task, TaskCompletion, Target } from '@/lib/types'
import TaskItem from './TaskItem'
import TargetItem from './TargetItem'
import AddTaskModal from './AddTaskModal'
import AddTargetModal from './AddTargetModal'

interface Props {
  folder: ProjectFolder
  tasks: Task[]
  targets: Target[]
  completions: TaskCompletion[]
  todayStr: string
  userId: string
  accentColor: string
  accentLight: string
  onFolderDeleted: (id: string) => void
  onTaskAdded: (task: Task) => void
  onTaskDeleted: (taskId: string) => void
  onCompletionToggled: (completion: TaskCompletion | null, taskId: string, date: string) => void
  onTargetAdded: (target: Target) => void
  onTargetUpdated: (target: Target) => void
  onTargetDeleted: (targetId: string) => void
}

export default function ProjectFolderCard({
  folder,
  tasks,
  targets,
  completions,
  todayStr,
  userId,
  accentColor,
  accentLight,
  onFolderDeleted,
  onTaskAdded,
  onTaskDeleted,
  onCompletionToggled,
  onTargetAdded,
  onTargetUpdated,
  onTargetDeleted,
}: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showAddTarget, setShowAddTarget] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDeleteFolder() {
    if (!confirm(`Delete folder "${folder.name}" and all its tasks and targets?`)) return
    setDeleting(true)
    await supabase.from('project_folders').delete().eq('id', folder.id)
    onFolderDeleted(folder.id)
  }

  // Tasks due today
  const todayDow = new Date(todayStr + 'T00:00:00').getDay()
  const todayDom = new Date(todayStr + 'T00:00:00').getDate()

  const dueTodayTasks = tasks.filter(t => {
    if (t.repeat_type === 'daily') return true
    if (t.repeat_type === 'weekly') return t.repeat_config.weekday === todayDow
    if (t.repeat_type === 'monthly') return t.repeat_config.day_of_month === todayDom
    return false
  })

  const completedTodayIds = new Set(
    completions
      .filter(c => c.completed_date === todayStr)
      .map(c => c.task_id)
  )

  return (
    <div className="card overflow-hidden">
      {/* Folder header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-border cursor-pointer select-none"
        style={{ backgroundColor: accentLight }}
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden>
            {open ? '▾' : '▸'}
          </span>
          <h3 className="font-serif text-lg" style={{ color: accentColor }}>
            {folder.name}
          </h3>
          {dueTodayTasks.length > 0 && (
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded-sm ml-1"
              style={{ backgroundColor: accentColor, color: '#fff' }}
            >
              {completedTodayIds.size}/{dueTodayTasks.length} today
            </span>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); handleDeleteFolder() }}
          disabled={deleting}
          className="text-xs text-muted hover:text-red-500 transition-colors px-2 py-1"
        >
          Delete folder
        </button>
      </div>

      {open && (
        <div className="divide-y divide-border">
          {/* Tasks section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted font-medium">Tasks</span>
              <button
                onClick={() => setShowAddTask(true)}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                + Add task
              </button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-muted italic py-1">No tasks yet.</p>
            ) : (
              <ul className="space-y-1">
                {tasks.map(task => (
                  <TaskItem
                    key={task.id}
                    task={task}
                    todayStr={todayStr}
                    completedToday={completedTodayIds.has(task.id)}
                    userId={userId}
                    onCompletionToggled={onCompletionToggled}
                    onDeleted={onTaskDeleted}
                  />
                ))}
              </ul>
            )}
          </div>

          {/* Targets section */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-wide text-muted font-medium">Targets</span>
              <button
                onClick={() => setShowAddTarget(true)}
                className="text-xs text-muted hover:text-ink transition-colors"
              >
                + Add target
              </button>
            </div>

            {targets.length === 0 ? (
              <p className="text-xs text-muted italic py-1">No targets yet.</p>
            ) : (
              <ul className="space-y-2">
                {targets.map(target => (
                  <TargetItem
                    key={target.id}
                    target={target}
                    accentColor={accentColor}
                    onUpdated={onTargetUpdated}
                    onDeleted={onTargetDeleted}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {showAddTask && (
        <AddTaskModal
          folderId={folder.id}
          userId={userId}
          accentColor={accentColor}
          onClose={() => setShowAddTask(false)}
          onAdded={onTaskAdded}
        />
      )}

      {showAddTarget && (
        <AddTargetModal
          folderId={folder.id}
          userId={userId}
          accentColor={accentColor}
          onClose={() => setShowAddTarget(false)}
          onAdded={onTargetAdded}
        />
      )}
    </div>
  )
}
