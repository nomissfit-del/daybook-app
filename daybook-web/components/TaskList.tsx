'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Task, TaskCompletion, Recurrence } from '@/lib/types';
import { isTaskDueOnDate, toDateKey } from '@/lib/dates';

interface Props {
  projectId: string;
  userId: string;
  tasks: Task[];
  completions: TaskCompletion[];
  onChange: () => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function TaskList({ projectId, userId, tasks, completions, onChange }: Props) {
  const [title, setTitle] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence>('daily');
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [saving, setSaving] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);
  const completedTodaySet = new Set(
    completions.filter((c) => c.date === todayKey && c.completed).map((c) => c.task_id)
  );

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    await supabase.from('tasks').insert({
      project_id: projectId,
      user_id: userId,
      title: title.trim(),
      recurrence,
      day_of_week: recurrence === 'weekly' ? dayOfWeek : null,
      day_of_month: recurrence === 'monthly' ? dayOfMonth : null,
      tracked: false,
    });
    setTitle('');
    setSaving(false);
    onChange();
  }

  async function toggleToday(task: Task) {
    const isDone = completedTodaySet.has(task.id);
    if (isDone) {
      await supabase.from('task_completions').delete().eq('task_id', task.id).eq('date', todayKey);
    } else {
      await supabase
        .from('task_completions')
        .upsert({ task_id: task.id, user_id: userId, date: todayKey, completed: true });
    }
    onChange();
  }

  async function toggleTrack(task: Task) {
    await supabase.from('tasks').update({ tracked: !task.tracked }).eq('id', task.id);
    onChange();
  }

  async function removeTask(task: Task) {
    await supabase.from('tasks').update({ archived: true }).eq('id', task.id);
    onChange();
  }

  const activeTasks = tasks.filter((t) => !t.archived);

  return (
    <div>
      <ul className="space-y-2 mb-4">
        {activeTasks.map((task) => {
          const dueToday = isTaskDueOnDate(task, today);
          const done = completedTodaySet.has(task.id);
          return (
            <li
              key={task.id}
              className="flex items-center justify-between gap-3 border-b border-line/60 pb-2"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggleToday(task)}
                  disabled={!dueToday}
                  aria-label={done ? 'Mark not done' : 'Mark done'}
                  className={`w-5 h-5 rounded border flex items-center justify-center text-xs
                    ${done ? 'bg-[var(--accent)] border-[var(--accent)] text-white' : 'border-line'}
                    ${!dueToday ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {done ? '✓' : ''}
                </button>
                <span className={done ? 'line-through text-ink-muted' : ''}>{task.title}</span>
                <span className="text-xs font-mono text-ink-muted">
                  {task.recurrence === 'weekly'
                    ? `· ${WEEKDAYS[task.day_of_week ?? 0]}`
                    : task.recurrence === 'monthly'
                    ? `· day ${task.day_of_month}`
                    : '· daily'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleTrack(task)}
                  title={task.tracked ? 'Remove from graph' : 'Add to graph'}
                  className={`text-xs font-mono px-1.5 py-0.5 rounded border transition-colors
                    ${task.tracked
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : 'border-line text-ink-muted hover:border-ink-muted'
                    }`}
                >
                  {task.tracked ? 'tracked' : 'track'}
                </button>
                <button
                  onClick={() => removeTask(task)}
                  className="text-ink-muted hover:text-[var(--accent)] text-xs font-mono"
                >
                  remove
                </button>
              </div>
            </li>
          );
        })}
        {activeTasks.length === 0 && (
          <p className="text-ink-muted italic text-sm">No tasks yet.</p>
        )}
      </ul>

      <form onSubmit={addTask} className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 min-w-[140px] bg-transparent border-b border-line focus:border-[var(--accent)] outline-none py-1 text-sm"
        />
        <select
          value={recurrence}
          onChange={(e) => setRecurrence(e.target.value as Recurrence)}
          className="text-sm bg-transparent border-b border-line py-1"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        {recurrence === 'weekly' && (
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(Number(e.target.value))}
            className="text-sm bg-transparent border-b border-line py-1"
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        )}
        {recurrence === 'monthly' && (
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(Number(e.target.value))}
            className="w-16 text-sm bg-transparent border-b border-line py-1"
          />
        )}
        <button disabled={saving} type="submit" className="text-xs font-mono uppercase text-[var(--accent)]">
          Add
        </button>
      </form>
    </div>
  );
}
