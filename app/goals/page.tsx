import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { today } from '@/lib/heatmap'
import GoalsBoard from '@/components/GoalsBoard'
import type { Goal } from '@/lib/types'

export default async function GoalsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: goals, error } = await supabase
    .from('goals')
    .select('*, goal_milestones(*)')
    .eq('user_id', user.id)
    .order('deadline', { ascending: true })

  return (
    <GoalsBoard
      userId={user.id}
      userEmail={user.email ?? ''}
      initialGoals={(goals ?? []) as Goal[]}
      todayStr={today()}
      loadError={error ? error.message : null}
    />
  )
}
