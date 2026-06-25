import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { today } from '@/lib/heatmap'
import Dashboard from '@/components/Dashboard'

export default async function PersonalPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch all folders for this dashboard
  const { data: folders } = await supabase
    .from('project_folders')
    .select('*')
    .eq('user_id', user.id)
    .eq('dashboard', 'personal')
    .order('created_at', { ascending: true })

  // Fetch all tasks for personal dashboard (via folders)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)

  // Filter to tasks belonging to personal folders
  const folderIds = new Set((folders ?? []).map(f => f.id))
  const personalTasks = (tasks ?? []).filter(t => folderIds.has(t.project_folder_id))

  // Fetch completions for last 365 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 365)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: completions } = await supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', user.id)
    .gte('completed_date', cutoffStr)
    .in('task_id', personalTasks.map(t => t.id).length > 0 ? personalTasks.map(t => t.id) : ['none'])

  // Fetch targets
  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', user.id)
    .in('project_folder_id', folderIds.size > 0 ? [...folderIds] : ['none'])
    .order('created_at', { ascending: true })

  const todayStr = today()

  return (
    <Dashboard
      dashboard="personal"
      userId={user.id}
      userEmail={user.email ?? ''}
      folders={folders ?? []}
      tasks={personalTasks}
      completions={completions ?? []}
      targets={targets ?? []}
      todayStr={todayStr}
    />
  )
}
