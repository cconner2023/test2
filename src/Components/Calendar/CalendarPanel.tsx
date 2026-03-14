import { useState, useCallback, useMemo } from 'react'
import { CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from '../EmptyState'

type CalendarViewMode = 'month' | 'agenda'

interface CalendarPanelProps {
  onBack: () => void
}

// ── Month Grid ──────────────────────────────────────────────────────────

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function MonthView({ currentDate, onSelectDate, selectedDate }: {
  currentDate: Date
  onSelectDate: (date: Date) => void
  selectedDate: Date
}) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells = useMemo(() => {
    const result: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) result.push(null)
    for (let d = 1; d <= daysInMonth; d++) result.push(d)
    return result
  }, [firstDay, daysInMonth])

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const isSelected = (day: number) =>
    day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()

  return (
    <div className="px-3 pt-2">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-xs font-medium text-tertiary/50 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => (
          <button
            key={i}
            disabled={day === null}
            onClick={() => day && onSelectDate(new Date(year, month, day))}
            className={`aspect-square flex items-center justify-center text-sm rounded-full transition-all duration-200 ${
              day === null
                ? ''
                : isSelected(day)
                  ? 'bg-themeblue3 text-white font-semibold'
                  : isToday(day)
                    ? 'bg-themeblue3/15 text-themeblue3 font-semibold'
                    : 'text-secondary hover:bg-primary/5 active:scale-95'
            }`}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Agenda View (placeholder) ───────────────────────────────────────────

function AgendaView({ selectedDate }: { selectedDate: Date }) {
  const dateLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="flex-1 overflow-y-auto px-3 pt-3">
      <p className="text-xs font-medium text-tertiary/50 uppercase tracking-wider mb-3">
        {dateLabel}
      </p>
      <EmptyState
        icon={<CalendarDays className="w-10 h-10" />}
        title="No events"
        subtitle="Events for this day will appear here"
      />
    </div>
  )
}

// ── Main Panel ──────────────────────────────────────────────────────────

export function CalendarPanel({ onBack }: CalendarPanelProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month')
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => new Date())

  const monthLabel = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  }, [])

  const nextMonth = useCallback(() => {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
  }, [])

  const goToToday = useCallback(() => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDate(today)
  }, [])

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToToday}
            className="text-sm font-semibold text-primary min-w-[140px] text-center"
          >
            {monthLabel}
          </button>
          <button
            onClick={nextMonth}
            className="w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:bg-primary/5 active:scale-95 transition-all duration-200"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-full bg-themewhite border border-tertiary/20 p-0.5">
          <button
            onClick={() => setViewMode('month')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'month' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Month view"
          >
            <CalendarDays className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('agenda')}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
              viewMode === 'agenda' ? 'bg-themeblue3 text-white' : 'text-tertiary hover:text-primary'
            }`}
            title="Agenda view"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month grid */}
      {viewMode === 'month' && (
        <MonthView
          currentDate={currentDate}
          selectedDate={selectedDate}
          onSelectDate={handleSelectDate}
        />
      )}

      {/* Agenda / day detail */}
      <AgendaView selectedDate={selectedDate} />
    </div>
  )
}
