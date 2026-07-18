import { AlertTriangle, Info } from 'lucide-react'
import type { PerformanceStep } from '../Data/TrainingData'

export function StepCallout({ type, text }: { type: 'warning' | 'caution' | 'note'; text: string }) {
    // Bar treatment (matches the User Guide's left-accent language) — no card box.
    // Color stays per-type because it carries clinical severity: yellow WARNING vs
    // orange CAUTION vs blue NOTE must read at a glance, so it lives on the bar,
    // icon, and label rather than a full tinted card.
    const styles = {
        warning: { bar: 'border-themeyellow', text: 'text-themeyellow', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0 mt-0.5" />, label: 'WARNING' },
        caution: { bar: 'border-orange-500', text: 'text-orange-500', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />, label: 'CAUTION' },
        note: { bar: 'border-themeblue2', text: 'text-themeblue2', icon: <Info size={13} className="text-themeblue2 shrink-0 mt-0.5" />, label: 'NOTE' },
    }
    const s = styles[type]

    return (
        <div className={`pl-3 mt-1.5 border-l-2 ${s.bar} flex items-start gap-2`}>
            {s.icon}
            <div>
                <p className={`text-[9pt] font-bold tracking-wider ${s.text}`}>{s.label}</p>
                <p className="text-[10pt] text-primary">{text}</p>
            </div>
        </div>
    )
}

export function PerformanceStepItem({ step }: { step: PerformanceStep }) {
    return (
        <div className={`${step.isSubStep ? 'ml-6' : ''}`}>
            <div className="flex items-start gap-2 py-1.5">
                <span className="text-[9pt] text-tertiary font-mono w-6 shrink-0 text-right mt-px">
                    {step.number}
                </span>
                <p className="text-sm text-primary flex-1">{step.text}</p>
            </div>
            {step.warning && <StepCallout type="warning" text={step.warning} />}
            {step.caution && <StepCallout type="caution" text={step.caution} />}
            {step.note && <StepCallout type="note" text={step.note} />}
        </div>
    )
}

/** @deprecated Import from '@/Components/primitives/Section' instead */
export { SectionHeader } from '@/Components/primitives/Section'
