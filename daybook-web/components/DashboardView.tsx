'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Project, Task, TaskCompletion, Workspace } from '@/lib/types';
import Heatmap from './Heatmap';

export default function DashboardView({ workspace }: { workspace: Workspace }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completions, setCompletions] = useState<TaskCompletion[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    setUserId(uid);

    const { data: projectsData } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', uid)
      .eq('workspace', workspace)
      .order('created_at', { ascending: true });
    setProjects(projectsData ?? []);

    const projectIds = (projectsData ?? []).map((p) => p.id);
    if (projectIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .in('project_id', projectIds)
        .eq('archived', false);
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
    } else {
      setTasks([]);
      setCompletions([]);
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    load();
  }, [load]);

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !userId) return;
    await supabase.from('projects').insert({ user_id: userId, workspace, name: newName.trim() });
    setNewName('');
    load();
  }

  if (loading) return <p className="font-mono text-sm text-ink-muted">Loading…</p>;

  return (
    <div>
      <section className="mb-10">
        <h2 className="font-display text-sm uppercase tracking-wide border-b border-ink pb-2 mb-3">
          Daily tasks
        </h2>
        <Heatmap tasks={tasks} completions={completions} />
      </section>

      <section>
        <h2 className="font-display text-sm uppercase tracking-wide border-b border-ink pb-2 mb-3">
          Project folders
        </h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/${workspace}/${p.id}`}
              className="block border border-line rounded-lg p-4 hover:border-[var(--accent)] transition-colors"
            >
              <span className="font-display text-base">{p.name}</span>
            </Link>
          ))}
        </div>
        <form onSubmit={addProject} className="flex items-center gap-2 border-t border-line pt-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New project folder…"
            className="flex-1 bg-transparent border-b border-line focus:border-[var(--accent)] outline-none py-1 text-sm"
          />
          <button type="submit" className="text-xs font-mono uppercase text-[var(--accent)]">
            Create
          </button>
        </form>
      </section>
    </div>
  );
}
