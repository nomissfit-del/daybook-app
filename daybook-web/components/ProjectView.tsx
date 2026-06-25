'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { Project, Task, TaskCompletion, Target, Workspace } from '@/lib/types';
import TaskList from './TaskList';
import TargetList from './TargetList';

export default function ProjectView({
  workspace,
  projectId,
}: {
  workspace: Workspace;
  projectId: string;
}) {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    setUserId(uid);

    const { data: projectData } = await supabase.from('projects').select('*').eq('id', projectId).single();
    setProject(projectData ?? null);

    const { data: tasksData } = await supabase.from('tasks').select('*').eq('project_id', projectId);
    setTasks(tasksData ?? []);

    const taskIds = (tasksData ?? []).map((t) => t.id);
    if (taskIds.length > 0) {
      const { data: completionsData } = await supabase
        .from('task_completions')
        .select('*')
        .in('task_id', taskIds);
      setCompletions(completionsData ?? []);
    } else {
      setCompletions([]);
    }

    const { data: targetsData } = await supabase.from('targets').select('*').eq('project_id', projectId);
    setTargets(targetsData ?? []);

    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function deleteProject() {
    await supabase.from('projects').delete().eq('id', projectId);
    router.push(`/${workspace}`);
  }

  if (loading) return <p className="font-mono text-sm text-ink-muted">Loading…</p>;
  if (!project) return <p className="font-mono text-sm text-ink-muted">Project not found.</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-display text-2xl font-semibold">{project.name}</h1>
        <button
          onClick={deleteProject}
          className="text-xs font-mono uppercase text-ink-muted hover:text-[var(--accent)]"
        >
          Delete folder
        </button>
      </div>

      <section className="mb-10">
        <h2 className="font-display text-sm uppercase tracking-wide border-b border-ink pb-2 mb-3">
          Tasks
        </h2>
        {userId && (
          <TaskList
            projectId={projectId}
            userId={userId}
            tasks={tasks}
            completions={completions}
            onChange={load}
          />
        )}
      </section>

      <section>
        <h2 className="font-display text-sm uppercase tracking-wide border-b border-ink pb-2 mb-3">
          Final targets
        </h2>
        {userId && <TargetList projectId={projectId} userId={userId} targets={targets} onChange={load} />}
      </section>
    </div>
  );
}
