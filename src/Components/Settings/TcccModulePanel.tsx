import { useMemo, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionHeader, SectionCard, CardLabel } from '@/Components/primitives/Section'
import { Sheet } from '@/Components/primitives/Sheet'
import { PreviewOverlay } from '../PreviewOverlay'
import { useIsMobile } from '@/Hooks/useIsMobile'
import { StepCallout, PerformanceStepItem, TcccSheetHeader } from '../TrainingStepComponents'
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
                <SectionCard>
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
                </SectionCard>
            )}
        </div>
    )
}

// ─── Shared block label ──────────────────────────────────────────────────────

// ─── Check on learning ───────────────────────────────────────────────────────

/**
 * The module's check-on-learning, as a card of questions that each open their own answer.
 *
 * Question and answer are deliberately NOT shown together in the list: a visible answer turns a
 * self-test into a read-through. Tapping commits to the question first, then reveals the answer.
 *
 * Desktop opens a PreviewOverlay anchored to the tapped row; mobile opens a Sheet. Both put the
 * question in the header and the answer in the body, and both carry prev/next so a medic can walk
 * the whole set without returning to the list. No action footer — there is nothing to submit.
 */
function CheckOnLearning({ items }: { items: { q: string; a: string }[] }) {
    const isMobile = useIsMobile()
    // `open` is tracked separately from `index` on purpose: clearing the index on close would
    // blank the header while the overlay is still animating out.
    const [open, setOpen] = useState(false)
    const [index, setIndex] = useState(0)
    const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

    const current = items[Math.min(index, items.length - 1)]
    // Wrap at both ends instead of stopping. Every arrow stays usable, so neither ever needs a
    // dimmed/disabled state — see the no-disabled-actions rule.
    const step = (delta: number) => setIndex(i => (i + delta + items.length) % items.length)

    const navCx =
        'w-8 h-8 rounded-full flex items-center justify-center text-tertiary hover:text-primary active:scale-95 transition-all'
    const nav = (
        <>
            <button onClick={() => step(-1)} className={navCx} aria-label="Previous question">
                <ChevronLeft size={16} />
            </button>
            <button onClick={() => step(1)} className={navCx} aria-label="Next question">
                <ChevronRight size={16} />
            </button>
        </>
    )
    // Wraps rather than truncates — a truncated question cannot be answered.
    const heading = <p className="text-sm font-medium text-primary leading-snug">{current.q}</p>
    const answer = (
        <div className="px-4 pb-4">
            <p className="text-[10pt] text-primary leading-relaxed">{current.a}</p>
        </div>
    )

    return (
        <>
            <SectionCard>
                {items.map((qa, i) => (
                    <button
                        key={i}
                        onClick={e => {
                            setAnchorRect(e.currentTarget.getBoundingClientRect())
                            setIndex(i)
                            setOpen(true)
                        }}
                        className={`flex items-center gap-3 w-full px-4 py-3 text-left transition-all
                            active:scale-95 hover:bg-themeblue2/5 ${i > 0 ? 'border-t border-tertiary/8' : ''}`}
                    >
                        <p className="flex-1 min-w-0 text-[10pt] text-primary leading-snug">{qa.q}</p>
                        <ChevronRight size={16} className="text-tertiary shrink-0" />
                    </button>
                ))}
            </SectionCard>

            {isMobile ? (
                <Sheet isOpen={open} onClose={() => setOpen(false)} titleNode={heading} rightContent={nav} height="fit">
                    {answer}
                </Sheet>
            ) : (
                <PreviewOverlay
                    isOpen={open}
                    onClose={() => setOpen(false)}
                    anchorRect={anchorRect}
                    titleNode={heading}
                    headerActions={nav}
                >
                    {answer}
                </PreviewOverlay>
            )}
        </>
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
                    <TcccSheetHeader section={section} />
                    {section.steps.map(step => (
                        <PerformanceStepItem key={step.number} step={step} />
                    ))}
                </div>
            ))}

            {/* Didactic teaching content. */}
            {d?.complications && d.complications.length > 0 && (
                <div className="mb-5">
                    <CardLabel label="Complications">
                        <ul className="space-y-1">
                            {d.complications.map((c, i) => (
                                <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-orange-500">{c}</li>
                            ))}
                        </ul>
                    </CardLabel>
                </div>
            )}

            {d?.keyPoints && d.keyPoints.length > 0 && (
                <div className="mb-5">
                    <CardLabel label="Key Points">
                        <ul className="space-y-1">
                            {d.keyPoints.map((k, i) => (
                                <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-themeblue2">{k}</li>
                            ))}
                        </ul>
                    </CardLabel>
                </div>
            )}

            {d?.checkOnLearning && d.checkOnLearning.length > 0 && (
                <div className="mb-5">
                    <CardLabel label="Check on Learning">
                        <CheckOnLearning items={d.checkOnLearning} />
                    </CardLabel>
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
