import { useMemo, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionHeader } from '@/Components/primitives/Section'
import { StepCallout, PerformanceStepItem } from '../TrainingStepComponents'
import { tcccModules, getTcccModule, type TcccModule } from '../../Data/TcccModules'

export type TcccView = 'tccc' | 'tccc-detail'

// ─── Browse list ─────────────────────────────────────────────────────────────

function TcccList({
    onSelectModule,
    searchQuery,
}: {
    onSelectModule: (moduleKey: string) => void
    searchQuery: string
}) {
    const modules = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return tcccModules
        return tcccModules.filter(
            m => m.name.toLowerCase().includes(q) || (m.module?.toLowerCase().includes(q) ?? false)
        )
    }, [searchQuery])

    const isSearching = searchQuery.trim().length > 0

    return (
        <div className="px-5 py-4 space-y-5">
            <p className="text-[10pt] text-tertiary">
                Tactical Combat Casualty Care — self-contained training modules. Each is a gradable
                component referenced by one or more ICTL tasks.
            </p>

            {isSearching && (
                <p className="text-[9pt] text-tertiary">
                    {modules.length} result{modules.length !== 1 ? 's' : ''}
                </p>
            )}

            {modules.length === 0 ? (
                <EmptyState title={isSearching ? 'No modules match your search' : 'No TCCC modules yet'} />
            ) : (
                <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                    {modules.map((m, idx) => {
                        const ready = !m.pending
                        return (
                            <button
                                key={m.key}
                                onClick={() => ready && onSelectModule(m.key)}
                                disabled={!ready}
                                className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all
                                    ${idx > 0 ? 'border-t border-tertiary/8' : ''}
                                    ${ready
                                        ? 'active:scale-95 hover:bg-themeblue2/5 cursor-pointer'
                                        : 'opacity-50 cursor-not-allowed'
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium truncate ${ready ? 'text-primary' : 'text-tertiary'}`}>
                                        {m.name}
                                    </p>
                                    {m.module && <p className="text-[9pt] text-tertiary mt-0.5">{m.module}</p>}
                                </div>
                                {ready && <ChevronRight size={16} className="text-tertiary shrink-0" />}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

// ─── Shared block label ──────────────────────────────────────────────────────

function SubBlock({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
            {children}
        </div>
    )
}

// ─── Module detail (didactic + sectioned graded steps + check on learning) ───

function TcccModuleDetail({ module }: { module: TcccModule }) {
    const d = module.didactic
    return (
        <div className="px-4 py-3 md:p-5 pb-12">
            {/* Header */}
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-primary">{module.name}</h3>
                {module.module && <p className="text-[10pt] text-tertiary mt-0.5">{module.module}</p>}
            </div>

            {/* One fidelity disclaimer for the whole module. */}
            {module.derived && (
                <div className="mb-4">
                    <StepCallout
                        type="note"
                        text={`Step detail is derived from the TCCC didactic module, not a JTS assessment checklist.${module.source ? ` Source: ${module.source}` : ''}`}
                    />
                </div>
            )}

            {/* Sectioned steps — the gradable performance for this module. */}
            {module.sections.map(section => (
                <div key={section.key} className="mb-5">
                    <SectionHeader>{section.title}</SectionHeader>
                    {section.steps.map(step => (
                        <PerformanceStepItem key={step.number} step={step} />
                    ))}
                </div>
            ))}

            {/* Didactic teaching content. */}
            {d?.complications && d.complications.length > 0 && (
                <div className="mb-5">
                    <SubBlock label="Complications">
                        <ul className="space-y-1">
                            {d.complications.map((c, i) => (
                                <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-orange-500">{c}</li>
                            ))}
                        </ul>
                    </SubBlock>
                </div>
            )}

            {d?.keyPoints && d.keyPoints.length > 0 && (
                <div className="mb-5">
                    <SubBlock label="Key Points">
                        <ul className="space-y-1">
                            {d.keyPoints.map((k, i) => (
                                <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-themeblue2">{k}</li>
                            ))}
                        </ul>
                    </SubBlock>
                </div>
            )}

            {d?.checkOnLearning && d.checkOnLearning.length > 0 && (
                <div className="mb-5">
                    <SubBlock label="Check on Learning">
                        <div className="space-y-2">
                            {d.checkOnLearning.map((qa, i) => (
                                <div key={i}>
                                    <p className="text-[10pt] font-medium text-primary">{qa.q}</p>
                                    <p className="text-[10pt] text-secondary mt-0.5">{qa.a}</p>
                                </div>
                            ))}
                        </div>
                    </SubBlock>
                </div>
            )}
        </div>
    )
}

// ─── Exported panel ──────────────────────────────────────────────────────────

interface TcccModulePanelProps {
    view: TcccView
    selectedModuleKey: string | null
    onSelectModule: (moduleKey: string) => void
    searchQuery: string
}

export function TcccModulePanel({ view, selectedModuleKey, onSelectModule, searchQuery }: TcccModulePanelProps) {
    if (view === 'tccc-detail' && selectedModuleKey) {
        const module = getTcccModule(selectedModuleKey)
        if (module) return <TcccModuleDetail module={module} />
    }
    return <TcccList onSelectModule={onSelectModule} searchQuery={searchQuery} />
}
