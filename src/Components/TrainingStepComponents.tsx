import { AlertTriangle, Info } from 'lucide-react'
import type { PerformanceStep } from '../Data/TrainingData'

export function StepCallout({ type, text }: { type: 'warning' | 'caution' | 'note'; text: string }) {
    const styles = {
        warning: { bg: 'bg-themeyellow/10', border: 'border-themeyellow/30', icon: <AlertTriangle size={13} className="text-themeyellow shrink-0 mt-0.5" />, label: 'WARNING' },
        caution: { bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: <AlertTriangle size={13} className="text-orange-500 shrink-0 mt-0.5" />, label: 'CAUTION' },
        note: { bg: 'bg-themeblue2/10', border: 'border-themeblue2/30', icon: <Info size={13} className="text-themeblue2 shrink-0 mt-0.5" />, label: 'NOTE' },
    }
    const s = styles[type]

    return (
        <div className={`${s.bg} border ${s.border} rounded-md px-3 py-2 mt-1.5 flex items-start gap-2`}>
            {s.icon}
            <div>
                <p className="text-[7pt] font-bold tracking-wider opacity-60">{s.label}</p>
                <p className="text-xs text-primary/80">{text}</p>
            </div>
        </div>
    )
}

export function PerformanceStepItem({ step }: { step: PerformanceStep }) {
    return (
        <div className={`${step.isSubStep ? 'ml-6' : ''}`}>
            <div className="flex items-start gap-2 py-1.5">
                <span className="text-[9pt] text-tertiary/50 font-mono w-6 shrink-0 text-right mt-px">
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

/** Section header used across training detail views */
export function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[9pt] font-semibold text-tertiary/60 uppercase tracking-wider mb-1.5">
            {children}
        </p>
    )
}
