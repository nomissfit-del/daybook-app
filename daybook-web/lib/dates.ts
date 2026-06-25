import { Task } from './types';

export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isTaskDueOnDate(task: Task, date: Date): boolean {
  if (task.recurrence === 'daily') return true;
  if (task.recurrence === 'weekly') return task.day_of_week === date.getDay();
  if (task.recurrence === 'monthly') return task.day_of_month === date.getDate();
  return false;
}

export type DayStatus = 'green' | 'red' | 'empty';

/**
 * Determines the heatmap color for a given day:
 * - 'green'  -> every task due that day was completed
 * - 'red'    -> at least one task due that day (in the past) was missed
 * - 'empty'  -> nothing was due that day, or it's today/in the future and not yet due to be judged
 */
export function computeDayStatus(
  date: Date,
  tasks: Task[],
  completedKeys: Set<string>, // keys formatted as `${taskId}_${dateKey}`
  today: Date
): DayStatus {
  const dateKey = toDateKey(date);
  const dueTasks = tasks.filter((t) => !t.archived && isTaskDueOnDate(t, date));
  if (dueTasks.length === 0) return 'empty';

  const isFutureOrToday = date >= today;
  const allDone = dueTasks.every((t) => completedKeys.has(`${t.id}_${dateKey}`));

  if (allDone) return 'green';
  if (isFutureOrToday) return 'empty';
  return 'red';
}
