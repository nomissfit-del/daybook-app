'use client'

import type { Goal, Milestone } from '@/lib/types'
import {
  CATEGORY_META, GOALS_ACCENT, HEALTH_META, TONE_COLORS,
  deadlineLabel, formatDate, formatShortDate, goalHealth,
  milestoneProgress, nextMilestone, timeElapsed,
} from '@/lib/goals'

interface Props {
  goal: Goal
  todayStr: string
  onOpen: (goal: Goal) => void
  onToggleMilestone: (goal: Goal, milestone: Milestone) => void
}

export default function GoalCard({ goal, todayStr, onOpen, onToggleMilestone }: Props) {
  const ms = goal.goal_milestones ?? []
  const { total, done, pct } = milestoneProgress(ms)
  const elapsed = timeElapsed(goal, todayStr)
  const health = HEALTH_META[goalHealth(goal, todayStr)]
  const cat = CATEGORY_META[goal.category]
  const due = deadlineLabel(goal, todayStr)
  const next = nextMilestone(ms)
  const isClosed = goal.status === 'achieved' || goal.status === 'dropped'
  const showTimeMarker = !isClosed && goal.status !== 'on_hold' && elapsed > 0 && elapsed < 1

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(goal)}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(goal) }}
      className={`card p-4 flex flex-col gap-3 cursor-pointer hover:border-muted transition-colors text-left
        ${goal.status === 'dropped' ? 'opacity-70' : ''}`}
    >
      {/* Badges */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className="text-[11px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-sm"
          style={{ color: cat.color, backgroundColor: cat.bg }}
        >
          {cat.label}
        </span>
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-sm"
          style={{ color: health.color, backgroundColor: health.bg }}
        >
          {health.label}
        </span>
      </div>

      {/* Title + why */}
      <div>
        <h3 className="font-serif text-lg leading-snug text-ink">{goal.title}</h3>
        {goal.why && (
          <p className="text-xs text-muted mt-1 line-clamp-2 italic">{goal.why}</p>
        )}
      </div>

      {/* Progress */}
      <div>
        <div className="relative h-2 rounded-full bg-[#EDE4D3] overflow-visible">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: GOALS_ACCENT }}
          />
          {showTimeMarker && (
            <div
              className="absolute -top-1 -bottom-1 w-0.5 bg-ink/60 rounded"
              style={{ left: `calc(${elapsed * 100}% - 1px)` }}
              title={`Time used: ${Math.round(elapsed * 100)}%`}
            />
          )}
        </div>
        <div className="flex justify-between mt-1.5 text-[11px] font-mono text-muted">
          <span>
            {total === 0 ? 'No milestones yet' : `${done} of ${total} milestones`}
          </span>
          {showTimeMarker && <span>{Math.round(elapsed * 100)}% of time used</span>}
        </div>
      </div>

      {/* Next milestone with quick tick */}
      {next && !isClosed && (
        <div
          className="flex items-center gap-2 bg-paper border border-border rounded-sm px-2.5 py-2"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onToggleMilestone(goal, next)}
            className="w-4 h-4 rounded-sm border border-border hover:border-ink flex-shrink-0 bg-white"
            aria-label={`Mark "${next.title}" done`}
            title="Mark done"
          />
          <span className="text-xs text-muted uppercase tracking-wide flex-shrink-0">Next</span>
          <span className="text-sm text-ink truncate flex-1">{next.title}</span>
          {next.target_date && (
            <span
              className="text-[11px] font-mono flex-shrink-0"
              style={{ color: next.target_date < todayStr ? TONE_COLORS.danger : TONE_COLORS.muted }}
            >
              {formatShortDate(next.target_date)}
            </span>
          )}
        </div>
      )}

      {/* Deadline */}
      <div className="flex items-center justify-between text-xs mt-auto pt-1 border-t border-border/70">
        <span className="text-muted font-mono pt-2">Due {formatDate(goal.deadline)}</span>
        <span className="font-medium pt-2" style={{ color: TONE_COLORS[due.tone] }}>{due.text}</span>
      </div>
    </div>
  )
}
