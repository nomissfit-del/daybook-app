'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { buildHeatmap } from '@/lib/heatmap'
import type { Dashboard as DashboardType, ProjectFolder, Task, TaskCompletion, Target } from '@/lib/types'
import Heatmap from './Heatmap'
import ProjectFolderCard from './ProjectFolderCard'
import AddProjectModal from './AddProjectModal'
import WeeklyPlanner from './WeeklyPlanner'

interface Props {
  dashboard: DashboardType
  userId: string
  userEmail: string
  folders: ProjectFolder[]
  tasks: Task[]
  completions: TaskCompletion[]
  targets: Target[]
  todayStr: string
}

export default function Dashboard({
  dashboard,
  userId,
  userEmail,
  folders: initialFolders,
  tasks: initialTasks,
  completions: initialCompletions,
  targets: initialTargets,
  todayStr,
}: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [folders, setFolders] = useState(initialFolders)
  const [tasks, setTasks] = useState(initialTasks)
  const [completions, setCompletions] = useState(initialCompletions)
  const [targets, setTargets] = useState(initialTargets)
  const [showAddProject, setShowAddProject] = useState(false)

  const isPersonal = dashboard === 'personal'
  const accent = isPersonal ? 'personal' : 'work'
  const accentColor = isPersonal ? '#B85C38' : '#1B3A6B'
  const accentLight = isPersonal ? '#F5E6DF' : '#DDE6F2'

  const heatmapDays = buildHeatmap(tasks, completions)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleFolderAdded = (folder: ProjectFolder) => {
    setFolders(prev => [...prev, folder])
  }

  const handleFolderDeleted = (folderId: string) => {
    setFolders(prev => prev.filter(f => f.id !== folderId))
    setTasks(prev => prev.filter(t => t.project_folder_id !== folderId))
    setTargets(prev => prev.filter(t => t.project_folder_id !== folderId))
  }

  const handleTaskAdded = (task: Task) => {
    setTasks(prev => [...prev, task])
  }

  const handleTaskDeleted = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    setCompletions(prev => prev.filter(c => c.task_id !== taskId))
  }

  const handleCompletionToggled = (completion: TaskCompletion | null, taskId: string, date: string) => {
    if (completion) {
      setCompletions(prev => [...prev, completion])
    } else {
      setCompletions(prev => prev.filter(c => !(c.task_id === taskId && c.completed_date === date)))
    }
  }

  const handleTargetAdded = (target: Target) => {
    setTargets(prev => [...prev, target])
  }

  const handleTargetUpdated = (updated: Target) => {
    setTargets(prev => prev.map(t => t.id === updated.id ? updated : t))
  }

  const handleTargetDeleted = (targetId: string) => {
    setTargets(prev => prev.filter(t => t.id !== targetId))
  }

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="border-b border-border bg-white sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="font-serif text-xl text-ink mr-4">Daybook</span>
            <a
              href="/personal"
              className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                isPersonal
                  ? 'font-medium'
                  : 'text-muted hover:text-ink'
              }`}
              style={isPersonal ? { color: accentColor, backgroundColor: accentLight } : {}}
            >
              Personal
            </a>
            <a
              href="/work"
              className={`px-3 py-1.5 text-sm rounded-sm transition-colors ${
                !isPersonal
                  ? 'font-medium'
                  : 'text-muted hover:text-ink'
              }`}
              style={!isPersonal ? { color: accentColor, backgroundColor: accentLight } : {}}
            >
              Work
            </a>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted hidden sm:block font-mono">{userEmail}</span>
            <button onClick={handleSignOut} className="btn-ghost text-xs">
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Weekly Planner */}
        <WeeklyPlanner userId={userId} />

        {/* Project Folders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-muted uppercase tracking-wide">
              Projects
            </h3>
            <button
              onClick={() => setShowAddProject(true)}
              className="text-sm font-medium px-3 py-1.5 rounded-sm border border-border
                         hover:border-ink transition-colors text-ink"
            >
              + New folder
            </button>
          </div>

          {folders.length === 0 ? (
            <div className="text-center py-12 text-muted text-sm border border-dashed border-border rounded-sm">
              No folders yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {folders.map(folder => (
                <ProjectFolderCard
                  key={folder.id}
                  folder={folder}
                  tasks={tasks.filter(t => t.project_folder_id === folder.id)}
                  targets={targets.filter(t => t.project_folder_id === folder.id)}
                  completions={completions}
                  todayStr={todayStr}
                  userId={userId}
                  accentColor={accentColor}
                  accentLight={accentLight}
                  onFolderDeleted={handleFolderDeleted}
                  onTaskAdded={handleTaskAdded}
                  onTaskDeleted={handleTaskDeleted}
                  onCompletionToggled={handleCompletionToggled}
                  onTargetAdded={handleTargetAdded}
                  onTargetUpdated={handleTargetUpdated}
                  onTargetDeleted={handleTargetDeleted}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {showAddProject && (
        <AddProjectModal
          dashboard={dashboard}
          userId={userId}
          accentColor={accentColor}
          onClose={() => setShowAddProject(false)}
          onAdded={handleFolderAdded}
        />
      )}
    </div>
  )
}
