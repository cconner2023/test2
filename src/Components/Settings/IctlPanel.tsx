import { useMemo, type ReactNode } from 'react'
import { Check, ChevronRight, Lock, BookOpen } from 'lucide-react'
import { EmptyState } from '@/Components/primitives/EmptyState'
import { SectionHeader, SectionCard } from '@/Components/primitives/Section'
import { ListItemRow } from '@/Components/primitives/ListItemRow'
import { StepCallout, PerformanceStepItem, TcccSheetHeader } from '../TrainingStepComponents'
import { ictl68wSL1, ICTL_APPROVED_DATE } from '../../Data/ICTL'
import { getIctlTaskData, type IctlTaskData } from '../../Data/ICTLContent'
import { resolveTcccModuleRef, type TcccModule, type TcccSection } from '../../Data/TcccModules'

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

// ─── TCCC module expansion (inline graded steps) ─────────────────────────────

/**
 * Always-open label for a run of section steps. A medic walking the task needs the steps in
 * front of them, not behind a tap.
 */
function SubBlock({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div>
            <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
            {children}
        </div>
    )
}

/**
 * A section-scoped ref (`<module>#<section>`) — the skill sheet's graded steps rendered inline
 * under its substep. This is the ICTL's referenced TCCC component; the module's didactic teaching
 * (complications, key points, check-on-learning) lives only in the TCCC module surface.
 */
function TcccSectionBlock({ section }: { section: TcccSection }) {
    return (
        <div className="ml-6 mt-1.5 mb-2">
            <SubBlock label={section.title}>
                <TcccSheetHeader section={section} />
                {section.steps.map(step => (
                    <PerformanceStepItem key={step.number} step={step} />
                ))}
            </SubBlock>
        </div>
    )
}

/**
 * What a performance step's `tcccModuleRef` renders beneath it. Four cases, and every one has to
 * put something on screen — a ref that silently renders nothing reads to the medic as "this step
 * has no detail", which is the opposite of what a ref means.
 *
 * `isFirstMention` suppresses repeats: a packet often points several substeps at the same module
 * (0238 has four, 0122 three), and the same whole-module block under each is pure noise.
 */
function StepTcccBlock({
    moduleRef,
    resolved,
    isFirstMention,
}: {
    moduleRef: string
    resolved: { module: TcccModule; section?: TcccSection }
    isFirstMention: boolean
}) {
    const { module, section } = resolved
    const label = `${module.name}${module.module ? ` (${module.module})` : ''}`

    // 1. The module's source has not been transcribed at all.
    if (module.pending) {
        return isFirstMention ? <StepCallout type="note" text={`Detailed steps come from the ${label} — coming soon.`} /> : null
    }
    // 2. The ref names a sheet the transcribed source does not contain — e.g. 0120 asks for
    //    #finger-thoracostomy but the Module 08 skill instructions publish only Chest Seal and
    //    NDC. Say so per step rather than per module: it is one missing sheet, not a missing module.
    if (moduleRef.includes('#') && !section) {
        return <StepCallout type="note" text={`This skill sheet is not in the transcribed ${label} source — coming soon.`} />
    }
    // 3. Section-scoped and resolved — the ordinary case.
    if (section) return <TcccSectionBlock section={section} />
    // 4. Bare ref on a transcribed module: the whole module applies, so render every sheet.
    return isFirstMention ? <>{module.sections.map(s => <TcccSectionBlock key={s.key} section={s} />)}</> : null
}

// ─── Read-only task detail (the approved ICTL packet) ────────────────────────

/** A packet task statement that actually says something — "None" means the block is absent. */
function stated(text: string | undefined): string | undefined {
    if (!text) return undefined
    const t = text.trim().replace(/\.$/, '')
    return t.toLowerCase() === 'none' ? undefined : text
}

function IctlTaskDetail({
    taskData,
    onOpenTccc,
}: {
    taskData: IctlTaskData
    onOpenTccc: (moduleKey: string) => void
}) {
    const tcccModule = taskData.tcccModuleRef
        ? resolveTcccModuleRef(taskData.tcccModuleRef)?.module
        : undefined
    const danger = stated(taskData.danger)
    const warning = stated(taskData.warning)
    const caution = stated(taskData.caution)
    // Step index of each module's first mention — see StepTcccBlock for what it suppresses.
    const firstModuleMention = new Map<string, number>()
    taskData.performanceSteps.forEach((step, i) => {
        const key = step.tcccModuleRef?.split('#')[0]
        if (key && !firstModuleMention.has(key)) firstModuleMention.set(key, i)
    })
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

            {/* Danger / Warning / Caution callouts, in doctrinal severity order. Packets spell an
                absent block as the literal "None" — omit those rather than render an empty box. */}
            {(danger || warning || caution) && (
                <div className="mb-5 space-y-2">
                    {danger && <StepCallout type="danger" text={danger} />}
                    {warning && <StepCallout type="warning" text={warning} />}
                    {caution && <StepCallout type="caution" text={caution} />}
                </div>
            )}

            {/* Deep-link to the referenced TCCC training module — the complete gradable
                component this task rolls up. Its didactic/check-on-learning lives there. */}
            {tcccModule && (
                <button
                    onClick={() => onOpenTccc(tcccModule.key)}
                    className="mb-5 flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-themeblue2/8 hover:bg-themeblue2/12 active:scale-95 transition-all text-left"
                >
                    <BookOpen size={15} className="text-themeblue2 shrink-0" />
                    <span className="flex-1 min-w-0">
                        <span className="block text-[10pt] font-medium text-themeblue2">View TCCC task</span>
                        <span className="block text-[9pt] text-tertiary truncate">{tcccModule.name}</span>
                    </span>
                    <ChevronRight size={15} className="text-themeblue2 shrink-0" />
                </button>
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
                        const resolved = step.tcccModuleRef ? resolveTcccModuleRef(step.tcccModuleRef) : undefined
                        return (
                            <div key={i}>
                                <PerformanceStepItem step={step} />
                                {resolved && (
                                    <StepTcccBlock
                                        moduleRef={step.tcccModuleRef!}
                                        resolved={resolved}
                                        isFirstMention={firstModuleMention.get(resolved.module.key) === i}
                                    />
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
    onOpenTccc: (moduleKey: string) => void
}

export function IctlPanel({ view, selectedTaskId, onSelectTask, searchQuery, onOpenTccc }: IctlPanelProps) {
    if (view === 'ictl-detail' && selectedTaskId) {
        const taskData = getIctlTaskData(selectedTaskId)
        if (taskData) return <IctlTaskDetail taskData={taskData} onOpenTccc={onOpenTccc} />
    }
    return <IctlList onSelectTask={onSelectTask} searchQuery={searchQuery} />
}
