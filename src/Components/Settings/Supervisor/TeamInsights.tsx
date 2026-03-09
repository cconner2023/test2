import { useState, useCallback } from 'react'
import { TeamReporting } from './TeamReporting'
import { PerformanceTrends } from './PerformanceTrends'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type {
  TeamMetrics,
  TrendPeriod,
  TrendBucket,
} from './supervisorHelpers'

interface TeamInsightsProps {
  medics: ClinicMedic[]
  teamMetrics: TeamMetrics
  computeTrends: (period: TrendPeriod, groupBy: 'week' | 'month', soldierId?: string) => TrendBucket[]
  resolveName: (id: string | null) => string
  onViewSoldier: (soldier: ClinicMedic) => void
}

type InsightTab = 'overview' | 'trends'

const tabs: { key: InsightTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'trends', label: 'Trends' },
]

export function TeamInsights({
  medics,
  teamMetrics,
  computeTrends,
  resolveName,
  onViewSoldier,
}: TeamInsightsProps) {
  const [activeTab, setActiveTab] = useState<InsightTab>('overview')

  const handleTabChange = useCallback((tab: InsightTab) => {
    setActiveTab(tab)
  }, [])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Tab bar — pinned at top */}
      <div className="shrink-0 px-4 pt-3 pb-2 md:px-5 md:pt-5 md:pb-3">
        <div role="tablist" className="flex border-b border-tertiary/10">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex-1 pb-2.5 text-sm font-medium transition-colors relative
                ${activeTab === tab.key ? 'text-primary' : 'text-tertiary/50 hover:text-tertiary/80'}`}
            >
              {tab.label}
              <span
                className={`absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full transition-all duration-300
                  ${activeTab === tab.key
                    ? 'w-8 h-0.5 bg-themeblue2'
                    : 'w-1.5 h-1.5 bg-tertiary/25'}`}
              />
            </button>
          ))}
        </div>
      </div>

      {/*
        Tab content — each tab renders direct flex children of this root.
        Overview gets a single scroll wrapper (flex-1 overflow-y-auto).
        Trends renders a fragment: scroll area + summary bar as siblings,
        matching AdminUsersList's pattern (scroll area + CardActionBar).
      */}

      {activeTab === 'overview' && (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-5 md:py-5 pb-8">
          <TeamReporting
            metrics={teamMetrics}
            medics={medics}
            resolveName={resolveName}
            onViewSoldier={onViewSoldier}
          />
        </div>
      )}

      {/* PerformanceTrends returns a fragment: scroll div (flex-1) + summary div (shrink-0) */}
      {activeTab === 'trends' && (
        <PerformanceTrends
          computeTrends={computeTrends}
          medics={medics}
          resolveName={resolveName}
        />
      )}
    </div>
  )
}
