'use client'

import { HeatmapDay } from '@/lib/types'

interface Props {
  days: HeatmapDay[]
  accentColor: string
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function cellColor(status: HeatmapDay['status']): string {
  switch (status) {
    case 'complete': return '#4A7C59'
    case 'missed':   return '#C0392B'
    default:         return '#EDE4D3'
  }
}

export default function Heatmap({ days, accentColor }: Props) {
  const todayStr = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  // days is 365 entries, oldest first
  // Arrange into weeks (columns), starting on Sunday
  // Find the Sunday on or before the first day
  const firstDate = new Date(days[0].date + 'T00:00:00')
  const startDow = firstDate.getDay() // 0=Sun

  // Pad the start so the grid lines up on Sunday columns
  const paddedDays = [
    ...Array(startDow).fill(null),
    ...days,
  ]

  // Chunk into weeks
  const weeks: (HeatmapDay | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  // Month labels: find the week index where each month first appears
  const monthLabels: { weekIdx: number; label: string }[] = []
  weeks.forEach((week, wi) => {
    const firstReal = week.find(d => d !== null) as HeatmapDay | undefined
    if (firstReal) {
      const d = new Date(firstReal.date + 'T00:00:00')
      if (d.getDate() <= 7) {
        // First week of the month
        const prev = monthLabels[monthLabels.length - 1]
        if (!prev || prev.weekIdx !== wi) {
          monthLabels.push({ weekIdx: wi, label: MONTHS[d.getMonth()] })
        }
      }
    }
  })

  const cellSize = 13
  const gap = 2
  const totalW = weeks.length * (cellSize + gap)

  return (
    <div className="card p-4 overflow-x-auto">
      <svg
        width={totalW + 32}
        height={7 * (cellSize + gap) + 24}
        aria-label="Activity heatmap"
      >
        {/* Month labels */}
        {monthLabels.map(({ weekIdx, label }) => (
          <text
            key={`${weekIdx}-${label}`}
            x={32 + weekIdx * (cellSize + gap)}
            y={10}
            className="font-mono"
            fontSize={9}
            fill="#8C7B6A"
          >
            {label}
          </text>
        ))}

        {/* Day-of-week labels */}
        {['M', 'W', 'F'].map((label, i) => (
          <text
            key={label}
            x={14}
            y={24 + (i * 2 + 1) * (cellSize + gap) + cellSize / 2 + 3}
            fontSize={9}
            fill="#8C7B6A"
            textAnchor="middle"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (!day) return null
            const x = 32 + wi * (cellSize + gap)
            const y = 16 + di * (cellSize + gap)
            return (
              <rect
                key={day.date}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={cellColor(day.status)}
                suppressHydrationWarning
              opacity={day.date > todayStr ? 0.3 : 1}
              >
                <title>
                  {day.date}
                  {day.dueCount > 0
                    ? ` — ${day.completedCount}/${day.dueCount} tasks`
                    : ' — no tasks due'}
                </title>
              </rect>
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2">
        <span className="text-xs text-muted">Less</span>
        {['empty', 'missed', 'complete'].map(s => (
          <span key={s} className="flex items-center gap-1 text-xs text-muted">
            <span
              className="inline-block rounded-sm"
              style={{ width: 11, height: 11, backgroundColor: cellColor(s as HeatmapDay['status']) }}
            />
            {s === 'empty' ? 'None due' : s === 'missed' ? 'Missed' : 'All done'}
          </span>
        ))}
      </div>
    </div>
  )
}
