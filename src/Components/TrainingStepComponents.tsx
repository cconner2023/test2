import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import type { PerformanceStep } from '../Data/TrainingData'
import type { TcccSection } from '../Data/TcccModules'

/**
 * A skill sheet's own TASK/CONDITION/STANDARD/EQUIPMENT block plus its sheet-level NOTEs.
 *
 * Shared by both surfaces that render a sheet — the ICTL packet (inline under the deferring
 * step) and the TCCC module browser — because STANDARD is the pass bar and carries the time
 * limit ("Perform NDC in 3 minutes or less") that no step in the list states. A surface that
 * shows the steps without it shows the procedure but not the grade.
 *
 * Renders nothing for a `derived: true` section: a didactic slide deck publishes no such block,
 * and reconstructing one from learning objectives would launder weak provenance into a standard.
 */
export function TcccSheetHeader({ section }: { section: TcccSection }) {
    const { task, condition, standard, equipment, notes } = section
    if (!task && !condition && !standard && !equipment && !notes?.length) return null
    const line = (label: string, text?: string) =>
        text ? (
            <p className="text-[9pt] text-tertiary leading-relaxed">
                <span className="font-semibold uppercase tracking-wider">{label}: </span>
                {text}
            </p>
        ) : null
    return (
        <>
            {(task || condition || standard || equipment) && (
                <div className="mb-2 space-y-0.5">
                    {line('Task', task)}
                    {line('Condition', condition)}
                    {line('Standard', standard)}
                    {line('Equipment', equipment)}
                </div>
            )}
            {notes?.map((n, i) => (
                <StepCallout key={i} type="note" text={n} />
            ))}
        </>
    )
}

export function StepCallout({ type, text }: { type: 'danger' | 'warning' | 'caution' | 'note'; text: string }) {
    // Bar treatment (matches the User Guide's left-accent language) — no card box.
    // Color stays per-type because it carries clinical severity: red DANGER vs yellow
    // WARNING vs orange CAUTION vs blue NOTE must read at a glance, so it lives on the
    // bar, icon, and label rather than a full tinted card. DANGER is the doctrinal top
    // tier (a black box in the MEDCoE packets) — it must outrank WARNING visually.
    const styles = {
        danger: { bar: 'border-themered', text: 'text-themered', icon: <OctagonAlert size={13} className="text-themered shrink-0" />, label: 'DANGER' },
        warning: { bar: 'border-themeyellow', text: 'text-themeyellow', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0" />, label: 'WARNING' },
        caution: { bar: 'border-orange-500', text: 'text-orange-500', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0" />, label: 'CAUTION' },
        note: { bar: 'border-themeblue2', text: 'text-themeblue2', icon: <Info size={13} className="text-themeblue2 shrink-0" />, label: 'NOTE' },
    }
    const s = styles[type]

    // Icon rides the LABEL row, not a leading gutter column. Keeping it in a gutter indented
    // every line of the body past it, which cost horizontal room the callout text needs and
    // broke the left edge it should share with the surrounding step text. Header and body now
    // start on the same left edge, so the icon reads as part of the label rather than a bullet.
    return (
        <div className={`pl-3 mt-1.5 border-l-2 ${s.bar}`}>
            <div className="flex items-center gap-1.5">
                {s.icon}
                <p className={`text-[9pt] font-bold tracking-wider ${s.text}`}>{s.label}</p>
            </div>
            <p className="text-[10pt] text-primary">{text}</p>
        </div>
    )
}

export function PerformanceStepItem({ step }: { step: PerformanceStep }) {
    return (
        <div className={`${step.isSubStep ? 'ml-6' : ''}`}>
            <div className="flex items-start gap-2 py-1.5">
                {/* min-w, not w: deep ICTL outline numbers ('2d(1)(a)') would otherwise wrap
                    inside a fixed 24px column. Short numbers still align on the same right edge. */}
                <span className="text-[9pt] text-tertiary font-mono min-w-6 shrink-0 text-right whitespace-nowrap mt-px">
                    {step.number}
                </span>
                <p className="text-sm text-primary flex-1">{step.text}</p>
            </div>
            {step.danger && <StepCallout type="danger" text={step.danger} />}
            {step.warning && <StepCallout type="warning" text={step.warning} />}
            {step.caution && <StepCallout type="caution" text={step.caution} />}
            {step.note && <StepCallout type="note" text={step.note} />}
        </div>
    )
}

/** @deprecated Import from '@/Components/primitives/Section' instead */
export { SectionHeader } from '@/Components/primitives/Section'
