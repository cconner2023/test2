import { useMemo, type ReactNode } from 'react'
import { Check, ChevronRight, Lock } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionHeader, SectionCard } from '@/Components/primitives/Section'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { StepCallout, PerformanceStepItem } from '../TrainingStepComponents'
import { ictl68wSL1, ICTL_APPROVED_DATE } from '../../Data/ICTL'
import {
    getIctlTaskData,
    resolveSkillSheetRef,
    type IctlTaskData,
    type IctlSkillSheet,
    type IctlSkillSheetSection,
} from '../../Data/ICTLContent'

export type IctlView = 'ictl' | 'ictl-detail'

interface IctlTaskRow {
    taskId: string
    title: string
    areaName: string
}

/** Flatten the ICTL roster into { subjectArea -> tasks }, preserving packet order. */
function buildIctlByArea(): Map<string, IctlTaskRow[]> {
    const grouped = new Map<string, IctlTaskRow[]>()
    ictl68wSL1.forEach(level => {
        level.subjectArea.forEach(area => {
            if (!grouped.has(area.name)) grouped.set(area.name, [])
            area.tasks.forEach(task => {
                grouped.get(area.name)!.push({ taskId: task.id, title: task.title, areaName: area.name })
            })
        })
    })
    return grouped
}

// ─── Browse list (nested by subject area) ────────────────────────────────────

function IctlList({
    onSelectTask,
    searchQuery,
}: {
    onSelectTask: (taskId: string) => void
    searchQuery: string
}) {
    const byArea = useMemo(() => buildIctlByArea(), [])

    const displayAreas = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return byArea
        const filtered = new Map<string, IctlTaskRow[]>()
        for (const [area, tasks] of byArea) {
            const matched = tasks.filter(
                t => t.title.toLowerCase().includes(q) || t.taskId.toLowerCase().includes(q)
            )
            if (matched.length > 0) filtered.set(area, matched)
        }
        return filtered
    }, [searchQuery, byArea])

    const totalResults = useMemo(() => {
        let n = 0
        for (const tasks of displayAreas.values()) n += tasks.length
        return n
    }, [displayAreas])

    const isSearching = searchQuery.trim().length > 0

    return (
        <div className="px-5 py-4 space-y-5">
            <p className="text-[10pt] text-tertiary">
                Individual Critical Task List — approved {ICTL_APPROVED_DATE}. Tasks fill in as content is added.
            </p>

            {isSearching && (
                <p className="text-[9pt] text-tertiary">
                    {totalResults} result{totalResults !== 1 ? 's' : ''}
                </p>
            )}

            {totalResults === 0 && isSearching ? (
                <EmptyState title="No tasks match your search" />
            ) : (
                Array.from(displayAreas).map(([areaName, tasks]) => (
                    <div key={areaName}>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="text-[9pt] font-semibold text-primary uppercase tracking-wider">
                                {areaName}
                            </p>
                            <span className="text-[9pt] text-tertiary">{tasks.length}</span>
                        </div>
                        <div className="rounded-2xl bg-themewhite2 overflow-hidden">
                            {tasks.map((task, idx) => {
                                const hasData = !!getIctlTaskData(task.taskId)
                                return (
                                    <button
                                        key={task.taskId}
                                        onClick={() => hasData && onSelectTask(task.taskId)}
                                        disabled={!hasData}
                                        className={`flex items-center gap-3 w-full px-4 py-3.5 text-left transition-all
                                            ${idx > 0 ? 'border-t border-tertiary/8' : ''}
                                            ${hasData
                                                ? 'active:scale-95 hover:bg-themeblue2/5 cursor-pointer'
                                                : 'opacity-50 cursor-not-allowed'
                                            }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${hasData ? 'text-primary' : 'text-tertiary'}`}>
                                                {task.title}
                                            </p>
                                            <p className="text-[9pt] text-tertiary font-mono mt-0.5">{task.taskId}</p>
                                            {!hasData && (
                                                <p className="text-[9pt] text-tertiary flex items-center gap-1 mt-0.5">
                                                    <Lock size={9} /> Coming soon
                                                </p>
                                            )}
                                        </div>
                                        {hasData && <ChevronRight size={16} className="text-tertiary shrink-0" />}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))
            )}
        </div>
    )
}

// ─── Skill-sheet expansion ───────────────────────────────────────────────────

/**
 * Label for a run of sheet content. Always open — a medic walking the task needs the steps
 * and complications in front of them, not behind a tap.
 */
function SubBlock({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
            {children}
        </div>
    )
}

/** A section-scoped ref (`<sheet>#<section>`) — the branch's steps, under its substep. */
function SkillSheetSectionBlock({ section }: { section: IctlSkillSheetSection }) {
    return (
        <div className="ml-6 mt-1.5 mb-2">
            <SubBlock label={section.title}>
                {section.steps.map(step => (
                    <PerformanceStepItem key={step.number} step={step} />
                ))}
            </SubBlock>
        </div>
    )
}

/**
 * A bare ref (whole sheet) — the general-principles branch plus the module's teaching content,
 * fronted by a single fidelity disclaimer. The sheet's name and source document are NOT
 * repeated here: the parent step's own text names the sheet, and the source has a row in
 * Supporting References.
 */
function SkillSheetOverview({ sheet }: { sheet: IctlSkillSheet }) {
    const d = sheet.didactic
    // The general-principles branch applies to every wound the sheet covers, so it belongs on
    // the parent step rather than under any one wound-pattern substep.
    const general = sheet.sections.find(s => s.key === 'general')
    return (
        <div className="mt-1.5 mb-2 space-y-1.5">
            {/* ONE fidelity disclaimer for the whole sheet. The source document itself is not
                repeated here — it already has a row in Supporting References below. */}
            {sheet.derived && (
                <StepCallout
                    type="note"
                    text="Step detail is derived from the TCCC didactic module, not a JTS assessment checklist. See Supporting References."
                />
            )}

            {general && general.steps.length > 0 && (
                <SubBlock label={general.title}>
                    {general.steps.map(step => (
                        <PerformanceStepItem key={step.number} step={step} />
                    ))}
                </SubBlock>
            )}

            {d?.complications && d.complications.length > 0 && (
                <SubBlock label="Complications">
                    <ul className="space-y-1">
                        {d.complications.map((c, i) => (
                            <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-orange-500">{c}</li>
                        ))}
                    </ul>
                </SubBlock>
            )}

            {d?.keyPoints && d.keyPoints.length > 0 && (
                <SubBlock label="Key Points">
                    <ul className="space-y-1">
                        {d.keyPoints.map((k, i) => (
                            <li key={i} className="text-[10pt] text-primary pl-3 border-l-2 border-themeblue2">{k}</li>
                        ))}
                    </ul>
                </SubBlock>
            )}

            {d?.checkOnLearning && d.checkOnLearning.length > 0 && (
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
            )}
        </div>
    )
}

// ─── Read-only task detail (the approved ICTL packet) ────────────────────────

function IctlTaskDetail({ taskData }: { taskData: IctlTaskData }) {
    return (
        <div className="px-4 py-3 md:p-5 pb-12">
            {/* Header */}
            <div className="mb-4">
                <p className="text-[9pt] text-tertiary font-mono">{taskData.taskNumber}</p>
                <h3 className="text-lg font-semibold text-primary">{taskData.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[9pt] text-themegreen">
                        <Check size={12} /> {taskData.status}
                    </span>
                    <span className="text-tertiary text-[9pt]">·</span>
                    <span className="text-[9pt] text-tertiary">Report {taskData.reportDate}</span>
                </div>
            </div>

            {/* Conditions */}
            <div className="mb-5">
                <SectionHeader>Conditions</SectionHeader>
                <p className="text-sm text-primary leading-relaxed">{taskData.conditions}</p>
            </div>

            {/* Standards */}
            <div className="mb-5">
                <SectionHeader>Standards</SectionHeader>
                <p className="text-sm text-primary leading-relaxed">{taskData.standards}</p>
            </div>

            {/* Warning / Caution callouts */}
            {(taskData.warning || taskData.caution) && (
                <div className="mb-5 space-y-2">
                    {taskData.warning && <StepCallout type="warning" text={taskData.warning} />}
                    {taskData.caution && <StepCallout type="caution" text={taskData.caution} />}
                </div>
            )}

            {/* Graded performance measures — same numbered-row grammar as the steps below,
                so the measure and the step that satisfies it read as one sequence. */}
            <div className="mb-5">
                <SectionHeader>Performance Measures</SectionHeader>
                {taskData.performanceMeasures.map(m => (
                    <PerformanceStepItem key={m.number} step={m} />
                ))}
            </div>

            {/* Performance steps (narrative; some defer to a JTS skill sheet) */}
            <div className="mb-5">
                <SectionHeader>Performance Steps</SectionHeader>
                <div className="divide-y divide-tertiary/8">
                    {taskData.performanceSteps.map((step, i) => {
                        const resolved = step.skillSheetRef ? resolveSkillSheetRef(step.skillSheetRef) : undefined
                        return (
                            <div key={i}>
                                <PerformanceStepItem step={step} />
                                {resolved?.sheet.pending && !step.isSubStep && (
                                    <StepCallout
                                        type="note"
                                        text={`Detailed steps come from the ${resolved.sheet.name}${resolved.sheet.module ? ` (${resolved.sheet.module})` : ''} — coming soon.`}
                                    />
                                )}
                                {/* A section-scoped ref shows that branch's steps; a bare ref (the
                                    parent step) shows sheet identity + module teaching content. */}
                                {resolved && !resolved.sheet.pending && (
                                    resolved.section
                                        ? <SkillSheetSectionBlock section={resolved.section} />
                                        : <SkillSheetOverview sheet={resolved.sheet} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Knowledges */}
            {taskData.knowledges && taskData.knowledges.length > 0 && (
                <div className="mb-5">
                    <SectionHeader>Knowledges</SectionHeader>
                    <SectionCard>
                        {taskData.knowledges.map((k, idx) => (
                            <div key={k.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}>
                                <p className="text-sm text-primary">{k.name}</p>
                                <p className="text-[9pt] text-tertiary font-mono mt-0.5">{k.id}</p>
                            </div>
                        ))}
                    </SectionCard>
                </div>
            )}

            {/* Skills */}
            {taskData.skills && taskData.skills.length > 0 && (
                <div className="mb-5">
                    <SectionHeader>Skills</SectionHeader>
                    <SectionCard>
                        {taskData.skills.map((s, idx) => (
                            <div key={s.id} className={`px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}>
                                <p className="text-sm text-primary">{s.name}</p>
                                <p className="text-[9pt] text-tertiary font-mono mt-0.5">{s.id}</p>
                            </div>
                        ))}
                    </SectionCard>
                </div>
            )}

            {/* Supporting references */}
            {taskData.references && taskData.references.length > 0 && (
                <div className="mb-5">
                    <SectionHeader>Supporting References</SectionHeader>
                    <SectionCard>
                        {[...taskData.references]
                            // Primary references first, then the rest alphabetically by name.
                            .sort((a, b) => (a.primary === b.primary ? a.refName.localeCompare(b.refName) : a.primary ? -1 : 1))
                            .map((r, idx) => (
                                <ListItemRow
                                    key={r.refId + idx}
                                    as="div"
                                    className={`px-4 py-3 ${idx > 0 ? 'border-t border-tertiary/8' : ''}`}
                                    left={r.primary ? (
                                        <span className="w-4 shrink-0 text-center text-[10pt] font-bold text-themeblue2">P</span>
                                    ) : undefined}
                                    center={
                                        <>
                                            <p className="text-sm text-primary">{r.refName}</p>
                                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                <span className="text-[9pt] text-tertiary font-mono">{r.refId}</span>
                                                {r.source && (
                                                    <span className="text-[9pt] text-tertiary truncate">{r.source}</span>
                                                )}
                                            </div>
                                        </>
                                    }
                                />
                            ))}
                    </SectionCard>
                </div>
            )}
        </div>
    )
}

// ─── Exported panel ──────────────────────────────────────────────────────────

interface IctlPanelProps {
    view: IctlView
    selectedTaskId: string | null
    onSelectTask: (taskId: string) => void
    searchQuery: string
}

export function IctlPanel({ view, selectedTaskId, onSelectTask, searchQuery }: IctlPanelProps) {
    if (view === 'ictl-detail' && selectedTaskId) {
        const taskData = getIctlTaskData(selectedTaskId)
        if (taskData) return <IctlTaskDetail taskData={taskData} />
    }
    return <IctlList onSelectTask={onSelectTask} searchQuery={searchQuery} />
}
