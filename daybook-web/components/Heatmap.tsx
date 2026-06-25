'use client';

import { Task, TaskCompletion } from '@/lib/types';
import { isTaskDueOnDate, toDateKey } from '@/lib/dates';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CELL = 28;
const GAP = 4;
const NAME_W = 150;

interface Props {
  tasks: Task[];
  completions: TaskCompletion[];
}

export default function Heatmap({ tasks, completions }: Props) {
  const trackedTasks = tasks.filter((t) => t.tracked && !t.archived);

  if (trackedTasks.length === 0) {
    return (
      <p className="text-ink-muted italic text-sm">
        No tracked tasks yet — open a project folder and click <strong>track</strong> on a task to add it here.
      </p>
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toDateKey(today);

  // Current week: Sunday → Saturday
  const sunday = new Date(today);
  sunday.setDate(today.getDate() - today.getDay());

  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });

  const completedKeys = new Set(
    completions.filter((c) => c.completed).map((c) => `${c.task_id}_${c.date}`)
  );

  function cellColor(task: Task, date: Date): string {
    const due = isTaskDueOnDate(task, date);
    if (!due) return '#E8DCC8';
    if (date > today) return '#E8DCC8';
    const done = completedKeys.has(`${task.id}_${toDateKey(date)}`);
    return done ? '#4A7C59' : '#C0392B';
  }

  return (
    <div>
      <div style={{ minWidth: 'max-content' }}>

        {/* Day-of-week header */}
        <div className="flex mb-1" style={{ paddingLeft: NAME_W + 8 }}>
          {days.map((d, i) => {
            const isToday = toDateKey(d) === todayKey;
            return (
              <div
                key={i}
                style={{ width: CELL, minWidth: CELL, marginRight: i < 6 ? GAP : 0, textAlign: 'center' }}
              >
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: 'var(--font-mono, monospace)',
                    color: isToday ? '#2B3328' : '#767E70',
                    fontWeight: isToday ? 600 : 400,
                  }}
                >
                  {DAYS[d.getDay()]}
                </span>
              </div>
            );
          })}
        </div>

        {/* One row per tracked task */}
        {trackedTasks.map((task) => (
          <div key={task.id} className="flex items-center mb-1">
            {/* Task name */}
            <div
              style={{ width: NAME_W, minWidth: NAME_W, paddingRight: 8 }}
              className="text-xs font-mono text-ink truncate text-right"
              title={task.title}
            >
              {task.title}
            </div>

            {/* Day cells */}
            <div className="flex">
              {days.map((d, i) => {
                const isToday = toDateKey(d) === todayKey;
                return (
                  <div
                    key={i}
                    title={`${toDateKey(d)} — ${task.title}`}
                    style={{
                      width: CELL,
                      height: CELL,
                      backgroundColor: cellColor(task, d),
                      marginRight: i < days.length - 1 ? GAP : 0,
                      borderRadius: 4,
                      outline: isToday ? '2px solid #2B3328' : 'none',
                      outlineOffset: 1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3" style={{ paddingLeft: NAME_W + 8 }}>
          {[
            { color: '#E8DCC8', label: 'Not due' },
            { color: '#4A7C59', label: 'Completed' },
            { color: '#C0392B', label: 'Missed' },
          ].map(({ color, label }) => (
            <span key={label} className="flex items-center gap-1 text-xs text-ink-muted font-mono">
              <span style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 2, display: 'inline-block', flexShrink: 0 }} />
              {label}
            </span>
          ))}
        </div>

      </div>
    </div>
  );
}
