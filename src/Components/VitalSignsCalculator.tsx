import { useState, useMemo, useCallback, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { DatePickerCalendar } from '@/Components/primitives/FormInputs'
import { BloodPressureInput } from '@/Components/DomainInputs'
import { Calendar as CalendarIcon } from 'lucide-react'

export interface VitalSignsCalculatorHandle {
    reset: () => void
}

const EMPTY_VITALS: Record<string, string> = {
    hr: '', rr: '', bpSys: '', bpDia: '', spo2: '', temp: '', ht: '', wt: '', lmp: '',
}

export interface VitalSignsCalculatorProps {
    value?: Record<string, string>
    onChange?: (next: Record<string, string>) => void
    /** Two-column dense layout with hint text inline as the cell header. */
    compact?: boolean
    /** When provided, the LMP cell becomes a button that calls this instead of expanding the calendar inline.
     *  Use when the host owns sequencing (e.g. swapping content in a parent overlay). */
    onRequestLmpPicker?: () => void
    /** Show only the fields that carry a unit conversion (Temp, Ht, Wt, LMP, derived BMI).
     *  Drops the bedside vitals (HR, RR, BP, SpO₂) — used for the KB conversion tool. */
    conversionOnly?: boolean
}

export const VitalSignsCalculator = forwardRef<VitalSignsCalculatorHandle, VitalSignsCalculatorProps>(function VitalSignsCalculator({ value, onChange, compact = false, onRequestLmpPicker, conversionOnly = false }, ref) {
    const isControlled = value !== undefined
    const [internal, setInternal] = useState<Record<string, string>>(EMPTY_VITALS)
    const vitals = isControlled ? value! : internal

    const setValue = useCallback((key: string, val: string) => {
        if (isControlled) {
            onChange?.({ ...value!, [key]: val })
        } else {
            setInternal(prev => ({ ...prev, [key]: val }))
        }
    }, [isControlled, value, onChange])

    // Unit selection for the conversion fields. Toggling converts the entered
    // value into the newly-selected unit; the hint then shows the other unit.
    const [tempUnit, setTempUnit] = useState<'F' | 'C'>('F')
    const [htUnit, setHtUnit] = useState<'in' | 'cm'>('in')
    const [wtUnit, setWtUnit] = useState<'lbs' | 'kg'>('lbs')

    const handleReset = useCallback(() => {
        if (isControlled) {
            onChange?.({ ...EMPTY_VITALS })
        } else {
            setInternal({ ...EMPTY_VITALS })
        }
        setTempUnit('F'); setHtUnit('in'); setWtUnit('lbs')
    }, [isControlled, onChange])

    useImperativeHandle(ref, () => ({ reset: handleReset }), [handleReset])

    const [lmpExpanded, setLmpExpanded] = useState(false)

    const toggleTempUnit = useCallback(() => {
        const n = parseFloat(vitals.temp)
        if (!isNaN(n)) setValue('temp', round1(tempUnit === 'F' ? (n - 32) * 5 / 9 : n * 9 / 5 + 32))
        setTempUnit(u => (u === 'F' ? 'C' : 'F'))
    }, [vitals.temp, tempUnit, setValue])
    const toggleHtUnit = useCallback(() => {
        const n = parseFloat(vitals.ht)
        if (!isNaN(n)) setValue('ht', round1(htUnit === 'in' ? n * 2.54 : n / 2.54))
        setHtUnit(u => (u === 'in' ? 'cm' : 'in'))
    }, [vitals.ht, htUnit, setValue])
    const toggleWtUnit = useCallback(() => {
        const n = parseFloat(vitals.wt)
        if (!isNaN(n)) setValue('wt', round1(wtUnit === 'lbs' ? n * 0.453592 : n / 0.453592))
        setWtUnit(u => (u === 'lbs' ? 'kg' : 'lbs'))
    }, [vitals.wt, wtUnit, setValue])

    const todayIso = new Date().toISOString().slice(0, 10)
    const lmpDisplay = useMemo(() => {
        if (!vitals.lmp) return null
        const d = new Date(vitals.lmp + 'T00:00:00')
        if (isNaN(d.getTime())) return vitals.lmp
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    }, [vitals.lmp])

    const htRaw = parseFloat(vitals.ht)
    const wtRaw = parseFloat(vitals.wt)
    const tempRaw = parseFloat(vitals.temp)

    // Canonical values (inches / lbs / °F) for category + BMI math, regardless of entry unit
    const htIn = isNaN(htRaw) ? NaN : (htUnit === 'in' ? htRaw : htRaw / 2.54)
    const wtLbs = isNaN(wtRaw) ? NaN : (wtUnit === 'lbs' ? wtRaw : wtRaw / 0.453592)
    const tempF = isNaN(tempRaw) ? NaN : (tempUnit === 'F' ? tempRaw : tempRaw * 9 / 5 + 32)

    const htFtIn = vitals.ht && !isNaN(htIn) ? `${Math.floor(htIn / 12)}' ${(htIn % 12).toFixed(0)}"` : null
    // Hints show the *other* unit from the one being entered
    const htAlt = vitals.ht && !isNaN(htIn)
        ? (htUnit === 'in' ? `${(htIn * 2.54).toFixed(1)}cm` : `${htIn.toFixed(1)}in`)
        : null
    const wtAlt = vitals.wt && !isNaN(wtLbs)
        ? (wtUnit === 'lbs' ? `${(wtLbs * 0.453592).toFixed(1)}kg` : `${wtLbs.toFixed(1)}lbs`)
        : null
    const tempAlt = vitals.temp && !isNaN(tempF)
        ? (tempUnit === 'F' ? `${((tempF - 32) * 5 / 9).toFixed(1)}°C` : `${tempF.toFixed(1)}°F`)
        : null

    const bmiInfo = useMemo(() => {
        if (!htIn || !wtLbs || isNaN(htIn) || isNaN(wtLbs) || htIn <= 0) return null
        const value = (wtLbs / (htIn * htIn)) * 703
        return { value, display: value.toFixed(1) }
    }, [htIn, wtLbs])

    const tempHint = useMemo(() => {
        if (!vitals.temp || isNaN(tempF)) return null
        if (tempF < 95) return { label: 'Hypothermia', color: 'text-themeblue2' }
        if (tempF <= 99.5) return { label: 'Normal', color: 'text-themegreen' }
        if (tempF <= 100.4) return { label: 'Low-grade', color: 'text-themeyellow' }
        return { label: 'Fever', color: 'text-themeredred' }
    }, [vitals.temp, tempF])

    const spo2Num = parseFloat(vitals.spo2)
    const spo2Hint = useMemo(() => {
        if (!vitals.spo2 || isNaN(spo2Num)) return null
        if (spo2Num < 90) return { label: 'Hypoxia', color: 'text-themeredred' }
        if (spo2Num < 95) return { label: 'Low', color: 'text-themeyellow' }
        if (spo2Num <= 100) return { label: 'Normal', color: 'text-themegreen' }
        return null
    }, [vitals.spo2, spo2Num])

    const lmpInfo = useMemo(() => {
        if (!vitals.lmp) return null
        const d = new Date(vitals.lmp + 'T00:00:00')
        if (isNaN(d.getTime())) return null
        const today = new Date(); today.setHours(0, 0, 0, 0)
        const days = Math.floor((today.getTime() - d.getTime()) / 86_400_000)
        if (days < 0) return { text: 'Future date', flag: null as { label: string; color: string } | null }
        const weeks = Math.floor(days / 7)
        const remDays = days % 7
        const label = weeks > 0 ? `${weeks}w ${remDays}d ago` : `${days}d ago`
        const flag = days > 35 ? { label: 'Late — consider pregnancy', color: 'text-themeyellow' } : null
        return { text: label, flag }
    }, [vitals.lmp])

    const bmiCategory = bmiInfo
        ? bmiInfo.value < 18.5 ? { label: 'Underweight', color: 'text-themeyellow' }
        : bmiInfo.value < 25 ? { label: 'Normal', color: 'text-themegreen' }
        : bmiInfo.value < 30 ? { label: 'Overweight', color: 'text-themeyellow' }
        : { label: 'Obese', color: 'text-themeredred' }
        : null

    // ── Build cell descriptors so row/grid layouts share rendering ──
    interface Cell {
        key: string
        label: string
        /** Replaces the plain label span (e.g. a unit toggle) when present. */
        labelNode?: ReactNode
        hint?: { text: string; color?: string } | null
        input: ReactNode
        /** Optional content rendered below the input row (compact mode). */
        extra?: ReactNode
        /** Extra classes applied to the compact-mode cell wrapper. */
        cellClass?: string
    }

    const cells: Cell[] = [
        {
            key: 'hr', label: 'HR (bpm)',
            input: <input type="text" inputMode="numeric" value={vitals.hr}
                onChange={e => setValue('hr', e.target.value)}
                placeholder="60-100" className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'rr', label: 'RR (/min)',
            input: <input type="text" inputMode="numeric" value={vitals.rr}
                onChange={e => setValue('rr', e.target.value)}
                placeholder="12-20" className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'bp', label: 'BP (mmHg)',
            input: (
                <BloodPressureInput
                    bare
                    value={`${vitals.bpSys || ''}/${vitals.bpDia || ''}`}
                    onChange={(v) => {
                        const [s, d] = v.split('/')
                        const next = { bpSys: s ?? '', bpDia: d ?? '' }
                        if (isControlled) onChange?.({ ...value!, ...next })
                        else setInternal(prev => ({ ...prev, ...next }))
                    }}
                    containerClassName={`flex items-center gap-1 ${compact ? 'w-full' : 'flex-1 justify-end'}`}
                    inputClassName={`${compact ? compactInputCx : inputCx} ${compact ? 'flex-1' : 'w-14'}`}
                    separatorClassName="text-[10pt] text-tertiary"
                />
            ),
        },
        {
            key: 'spo2', label: 'SpO₂ (%)',
            hint: spo2Hint ? { text: spo2Hint.label, color: spo2Hint.color } : null,
            input: <input type="text" inputMode="numeric" value={vitals.spo2}
                onChange={e => setValue('spo2', e.target.value)}
                placeholder="95-100" className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'temp', label: `Temp (°${tempUnit})`,
            labelNode: conversionOnly ? <UnitToggle label="Temp" a="°F" b="°C" active={`°${tempUnit}`} onToggle={toggleTempUnit} /> : undefined,
            hint: tempHint || tempAlt
                ? { text: [tempAlt, tempHint?.label].filter(Boolean).join(' · '), color: tempHint?.color }
                : null,
            input: <input type="text" inputMode="decimal" value={vitals.temp}
                onChange={e => setValue('temp', e.target.value)}
                placeholder={tempUnit === 'F' ? '98.6' : '37.0'} className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'ht', label: `Ht (${htUnit})`,
            labelNode: conversionOnly ? <UnitToggle label="Ht" a="in" b="cm" active={htUnit} onToggle={toggleHtUnit} /> : undefined,
            hint: htAlt ? { text: `${htAlt}${htFtIn ? ` · ${htFtIn}` : ''}` } : null,
            input: <input type="text" inputMode="decimal" value={vitals.ht}
                onChange={e => setValue('ht', e.target.value)}
                placeholder={htUnit === 'in' ? '68' : '173'} className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'wt', label: `Wt (${wtUnit})`,
            labelNode: conversionOnly ? <UnitToggle label="Wt" a="lbs" b="kg" active={wtUnit} onToggle={toggleWtUnit} /> : undefined,
            hint: wtAlt ? { text: wtAlt } : null,
            input: <input type="text" inputMode="decimal" value={vitals.wt}
                onChange={e => setValue('wt', e.target.value)}
                placeholder={wtUnit === 'lbs' ? '170' : '77'} className={compact ? compactInputCx : inputCx} />,
        },
        {
            key: 'lmp', label: 'LMP',
            hint: lmpInfo
                ? { text: lmpInfo.flag ? `${lmpInfo.text} · ${lmpInfo.flag.label}` : lmpInfo.text, color: lmpInfo.flag?.color }
                : null,
            cellClass: lmpExpanded && !onRequestLmpPicker ? 'col-span-2' : '',
            input: (
                <button
                    type="button"
                    onClick={() => onRequestLmpPicker ? onRequestLmpPicker() : setLmpExpanded(v => !v)}
                    className={`flex items-center gap-1.5 ${compact ? 'w-full justify-start' : 'flex-1 justify-end'} text-base md:text-[10pt] focus:outline-none ${lmpDisplay ? 'text-primary' : 'text-tertiary'}`}
                >
                    <CalendarIcon size={13} className="text-tertiary shrink-0" />
                    <span className="truncate">{lmpDisplay || 'Select date'}</span>
                </button>
            ),
            extra: onRequestLmpPicker ? null : (
                <div
                    className={`grid transition-all duration-200 ease-out ${
                        lmpExpanded ? 'grid-rows-[1fr] opacity-100 mt-1' : 'grid-rows-[0fr] opacity-0'
                    }`}
                >
                    <div className="overflow-hidden min-h-0">
                        <div className="rounded-xl bg-themewhite2/60 border border-primary/6">
                            <DatePickerCalendar
                                value={vitals.lmp}
                                onChange={(v) => setValue('lmp', v)}
                                onClose={() => setLmpExpanded(false)}
                                maxDate={todayIso}
                            />
                        </div>
                    </div>
                </div>
            ),
        },
    ]

    if (bmiInfo && bmiCategory) {
        // BMI is derived from Ht/Wt — slot it in just above LMP (the trailing date cell)
        cells.splice(cells.length - 1, 0, {
            key: 'bmi', label: 'BMI',
            hint: { text: bmiCategory.label, color: bmiCategory.color },
            input: <span className={`text-sm font-medium ${bmiCategory.color}`}>{bmiInfo.display}</span>,
        })
    }

    const visibleCells = conversionOnly
        ? cells.filter(c => c.key === 'temp' || c.key === 'ht' || c.key === 'wt' || c.key === 'lmp' || c.key === 'bmi')
        : cells

    if (compact) {
        return (
            <div className="grid grid-cols-2 gap-px bg-primary/6">
                {visibleCells.map(c => (
                    <div key={c.key} className={`flex flex-col gap-0.5 px-3 py-2 bg-themewhite ${c.cellClass || ''}`}>
                        <div className="flex items-baseline justify-between gap-2 min-w-0">
                            {c.labelNode ?? <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">{c.label}</span>}
                            {c.hint && (
                                <span className={`text-[8.5pt] font-medium truncate ${c.hint.color || 'text-tertiary'}`}>{c.hint.text}</span>
                            )}
                        </div>
                        {c.input}
                        {c.extra}
                    </div>
                ))}
            </div>
        )
    }

    return (
        <div>
            {visibleCells.map(c => (
                <div key={c.key} className="border-b border-primary/6 last:border-0">
                    <div className={rowCx + ' border-0'}>
                        {c.labelNode ?? <span className={labelCx}>{c.label}</span>}
                        <div className="flex flex-col items-end flex-1 gap-0.5">
                            {c.input}
                            {c.hint && (
                                <span className={`text-[9pt] font-medium ${c.hint.color || 'text-tertiary'}`}>{c.hint.text}</span>
                            )}
                        </div>
                    </div>
                    {c.extra && <div className="px-4 pb-2">{c.extra}</div>}
                </div>
            ))}
        </div>
    )
})

const round1 = (n: number) => (Math.round(n * 10) / 10).toString()

/** Label + two-way unit segments (e.g. °F / °C). Tapping the inactive segment flips.
 *  Flat segmented pattern (matches EventForm Status / TC3 AVPU) — never pills. */
function UnitToggle({ label, a, b, active, onToggle }: { label: string; a: string; b: string; active: string; onToggle: () => void }) {
    return (
        <div className="flex items-center gap-2 shrink-0">
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest shrink-0">{label}</span>
            <div className="flex">
                {[a, b].map(u => (
                    <button
                        key={u}
                        type="button"
                        onClick={() => { if (u !== active) onToggle() }}
                        className={`px-2.5 py-0.5 transition-colors ${
                            u === active ? 'bg-themeblue3' : 'active:bg-tertiary/5'
                        }`}
                    >
                        <span className={`text-[8.5pt] font-medium transition-colors ${
                            u === active ? 'text-white' : 'text-secondary'
                        }`}>
                            {u}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    )
}

const inputCx = 'flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-[10pt]'
const compactInputCx = 'w-full bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-[10pt]'
const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'
const labelCx = 'text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0'
