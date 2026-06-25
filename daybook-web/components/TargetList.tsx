'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Target } from '@/lib/types';

interface Props {
  projectId: string;
  userId: string;
  targets: Target[];
  onChange: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
}

export default function TargetList({ projectId, userId, targets, onChange }: Props) {
  const [title, setTitle] = useState('');
  const [unit, setUnit] = useState('');
  const [targetValue, setTargetValue] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  async function addTarget(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await supabase.from('targets').insert({
      project_id: projectId,
      user_id: userId,
      title: title.trim(),
      unit: unit.trim() || null,
      target_value: targetValue,
      current_value: 0,
      start_date: startDate || null,
      end_date: endDate || null,
    });
    setTitle('');
    setUnit('');
    setTargetValue(100);
    setStartDate('');
    setEndDate('');
    onChange();
  }

  async function updateProgress(target: Target, value: number) {
    await supabase.from('targets').update({ current_value: value }).eq('id', target.id);
    onChange();
  }

  async function removeTarget(target: Target) {
    await supabase.from('targets').delete().eq('id', target.id);
    onChange();
  }

  return (
    <div>
      <ul className="space-y-4 mb-4">
        {targets.map((t) => {
          const pct = Math.min(100, Math.round((t.current_value / t.target_value) * 100) || 0);
          return (
            <li key={t.id} className="border-b border-line/60 pb-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{t.title}</span>
                <button
                  onClick={() => removeTarget(t)}
                  className="text-ink-muted hover:text-[var(--accent)] text-xs font-mono"
                >
                  remove
                </button>
              </div>

              {(t.start_date || t.end_date) && (
                <p className="text-xs font-mono text-ink-muted mb-1">
                  {t.start_date ? formatDate(t.start_date) : '—'}
                  {' → '}
                  {t.end_date ? formatDate(t.end_date) : '—'}
                </p>
              )}

              <div className="w-full h-2 bg-line/40 rounded-full overflow-hidden mb-1">
                <div className="h-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-ink-muted">
                <input
                  type="number"
                  defaultValue={t.current_value}
                  onBlur={(e) => updateProgress(t, Number(e.target.value))}
                  className="w-16 bg-transparent border-b border-line"
                />
                <span>
                  / {t.target_value} {t.unit ?? ''} ({pct}%)
                </span>
              </div>
            </li>
          );
        })}
        {targets.length === 0 && <p className="text-ink-muted italic text-sm">No targets yet.</p>}
      </ul>

      <form onSubmit={addTarget} className="space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a target…"
            className="flex-1 min-w-[140px] bg-transparent border-b border-line focus:border-[var(--accent)] outline-none py-1 text-sm"
          />
          <input
            type="number"
            value={targetValue}
            onChange={(e) => setTargetValue(Number(e.target.value))}
            className="w-20 text-sm bg-transparent border-b border-line py-1"
          />
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit"
            className="w-20 text-sm bg-transparent border-b border-line py-1"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-mono text-ink-muted">Start</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-xs font-mono bg-transparent border-b border-line py-1"
          />
          <label className="text-xs font-mono text-ink-muted">End</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-xs font-mono bg-transparent border-b border-line py-1"
          />
          <button type="submit" className="text-xs font-mono uppercase text-[var(--accent)] ml-auto">
            Add
          </button>
        </div>
      </form>
    </div>
  );
}
