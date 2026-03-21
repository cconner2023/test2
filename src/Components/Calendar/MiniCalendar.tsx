import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { CalendarEvent } from '../../Types/CalendarTypes'
import { toDateKey } from '../../Types/CalendarTypes'

interface MiniCalendarProps {
  selectedDate: string        // dateKey format "YYYY-MM-DD"
  onSelectDate: (dateKey: string) => void
  events: CalendarEvent[]
}

const DOW_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function buildMonthGrid(displayMonth: Date): Date[] {
  const year = displayMonth.getFullYear()
  const month = displayMonth.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  // getDay(): 0=Sun, 1=Mon … 6=Sat — we want Mon-first grid
  const firstDow = firstOfMonth.getDay() // 0-6
  const leadingDays = firstDow === 0 ? 6 : firstDow - 1

  const grid: Date[] = []
  for (let i = leadingDays; i > 0; i--) {
    grid.push(new Date(year, month, 1 - i))
  }
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    grid.push(new Date(year, month, d))
  }
  const remaining = 42 - grid.length // always render 6 rows
  for (let d = 1; d <= remaining; d++) {
    grid.push(new Date(year, month + 1, d))
  }
  return grid
}

function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function MiniCalendar({ selectedDate, onSelectDate, events }: MiniCalendarProps) {
  const todayKey = useMemo(() => toDateKey(new Date()), [])

  // displayMonth tracks which month is shown in the mini calendar
  const [displayMonth, setDisplayMonth] = useState(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })

  // Sync displayMonth when selectedDate changes to a different month
  useEffect(() => {
    const [y, m] = selectedDate.split('-').map(Number)
    const selected = new Date(y, m - 1, 1)
    if (!isSameMonth(selected, displayMonth)) {
      setDisplayMonth(selected)
    }
  // Only react to selectedDate changes, not displayMonth (would cause loop)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Build event key set for dot indicators
  const eventDateSet = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) {
      set.add(e.start_time.slice(0, 10))
    }
    return set
  }, [events])

  const grid = useMemo(() => buildMonthGrid(displayMonth), [displayMonth])

  const monthHeaderLabel = displayMonth.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const prevMonth = useCallback(() => {
    setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const nextMonth = useCallback(() => {
    setDisplayMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const jumpToToday = useCallback(() => {
    const now = new Date()
    setDisplayMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }, [])

  const handleDayClick = useCallback((date: Date) => {
    onSelectDate(toDateKey(date))
  }, [onSelectDate])

  return (
    <div className="p-3 select-none">
      {/* Month header */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={prevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <button
          onClick={jumpToToday}
          className="text-sm font-semibold text-primary hover:text-themeblue3 transition-colors active:scale-95"
          title="Jump to today"
        >
          {monthHeaderLabel}
        </button>

        <button
          onClick={nextMonth}
          className="w-7 h-7 flex items-center justify-center rounded-full text-tertiary hover:text-primary transition-colors active:scale-95"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 mb-1">
        {DOW_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-tertiary/50 uppercase py-0.5">
            {label}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {grid.map((date, i) => {
          const key = toDateKey(date)
          const isCurrentMonth = isSameMonth(date, displayMonth)
          const isToday = key === todayKey
          const isSelected = key === selectedDate
          const hasEvents = eventDateSet.has(key)

          return (
            <div
              key={i}
              className={`flex flex-col items-center rounded ${
                isToday && !isSelected ? 'bg-themeblue3/60 border border-themeblue2/30' : ''
              } ${isSelected ? 'bg-themeblue3 border border-themeblue2/30' : ''}`}
            >
              <button
                onClick={() => handleDayClick(date)}
                className={`w-7 h-7 flex items-center justify-center text-xs transition-transform active:scale-95 ${
                  isSelected
                    ? 'text-white font-semibold'
                    : isToday
                      ? 'text-white font-semibold'
                      : isCurrentMonth
                        ? 'text-primary hover:bg-primary/8 rounded'
                        : 'text-tertiary/30 hover:bg-primary/5 rounded'
                }`}
              >
                {date.getDate()}
              </button>
              {/* Event dot — hidden when selected to keep it clean */}
              {hasEvents && !isSelected && (
                <div className="w-1 h-1 rounded-full bg-themeblue3 -mt-0.5" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
