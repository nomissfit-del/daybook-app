import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { today } from '@/lib/heatmap'
import Dashboard from '@/components/Dashboard'

export default async function WorkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: folders } = await supabase
    .from('project_folders')
    .select('*')
    .eq('user_id', user.id)
    .eq('dashboard', 'work')
    .order('created_at', { ascending: true })

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('user_id', user.id)
    .is('archived_at', null)

  const folderIds = new Set((folders ?? []).map(f => f.id))
  const workTasks = (tasks ?? []).filter(t => folderIds.has(t.project_folder_id))

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 365)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const { data: completions } = await supabase
    .from('task_completions')
    .select('*')
    .eq('user_id', user.id)
    .gte('completed_date', cutoffStr)
    .in('task_id', workTasks.map(t => t.id).length > 0 ? workTasks.map(t => t.id) : ['none'])

  const { data: targets } = await supabase
    .from('targets')
    .select('*')
    .eq('user_id', user.id)
    .in('project_folder_id', folderIds.size > 0 ? [...folderIds] : ['none'])
    .order('created_at', { ascending: true })

  const todayStr = today()

  return (
    <Dashboard
      dashboard="work"
      userId={user.id}
      userEmail={user.email ?? ''}
      folders={folders ?? []}
      tasks={workTasks}
      completions={completions ?? []}
      targets={targets ?? []}
      todayStr={todayStr}
    />
  )
}
