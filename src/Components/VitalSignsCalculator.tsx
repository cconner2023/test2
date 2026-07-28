import { useState, useMemo, useCallback, forwardRef, useImperativeHandle, type ReactNode } from 'react'
import { DatePickerCalendar } from '@/Components/primitives/FormInputs'
import { Chip, ChipBar } from '@/Components/primitives/Chip'
import { FieldCell, FieldGrid } from '@/Components/primitives/FieldCell'
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
    /** When provided, the LMP cell becomes a button that calls this instead of expanding the calendar inline.
     *  Use when the host owns sequencing (e.g. swapping content in a parent overlay). */
    onRequestLmpPicker?: () => void
    /** Show only the fields that carry a unit conversion (Temp, Ht, Wt, LMP, derived BMI).
     *  Drops the bedside vitals (HR, RR, BP, SpO₂) — used for the KB conversion tool.
     *  Also puts a unit ChipBar on each convertible value row. */
    conversionOnly?: boolean
}

export const VitalSignsCalculator = forwardRef<VitalSignsCalculatorHandle, VitalSignsCalculatorProps>(function VitalSignsCalculator({ value, onChange, onRequestLmpPicker, conversionOnly = false }, ref) {
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

    /** Unit selector for a convertible value — sits on the value row, not in the
     *  header, because it acts on the number rather than on the title. */
    const unitBar = (a: string, b: string, active: string, onToggle: () => void) => (
        <ChipBar className="shrink-0">
            {[a, b].map(u => (
                <Chip key={u} active={u === active} onClick={() => { if (u !== active) onToggle() }}>
                    {u}
                </Chip>
            ))}
        </ChipBar>
    )

    /** Value row: input takes the slack, unit chips (when converting) sit right. */
    const valueRow = (input: ReactNode, units?: ReactNode) => (
        units
            ? <div className="flex items-center gap-2 min-w-0">{input}{units}</div>
            : input
    )

    // ── Build cell descriptors so every field renders through one grid cell ──
    interface Cell {
        key: string
        label: string
        hint?: { text: string; color?: string } | null
        input: ReactNode
        /** Optional content rendered below the value row. */
        extra?: ReactNode
        /** Extra classes applied to the cell wrapper. */
        cellClass?: string
    }

    const cells: Cell[] = [
        {
            key: 'hr', label: 'HR (bpm)',
            input: <input type="text" inputMode="numeric" value={vitals.hr}
                onChange={e => setValue('hr', e.target.value)}
                placeholder="60-100" className={inputCx} />,
        },
        {
            key: 'rr', label: 'RR (/min)',
            input: <input type="text" inputMode="numeric" value={vitals.rr}
                onChange={e => setValue('rr', e.target.value)}
                placeholder="12-20" className={inputCx} />,
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
                    containerClassName="flex items-center gap-1 w-full"
                    inputClassName={`${inputCx} flex-1`}
                    separatorClassName="text-[10pt] text-tertiary"
                />
            ),
        },
        {
            key: 'spo2', label: 'SpO₂ (%)',
            hint: spo2Hint ? { text: spo2Hint.label, color: spo2Hint.color } : null,
            input: <input type="text" inputMode="numeric" value={vitals.spo2}
                onChange={e => setValue('spo2', e.target.value)}
                placeholder="95-100" className={inputCx} />,
        },
        {
            key: 'temp', label: conversionOnly ? 'Temp' : `Temp (°${tempUnit})`,
            hint: tempHint || tempAlt
                ? { text: [tempAlt, tempHint?.label].filter(Boolean).join(' · '), color: tempHint?.color }
                : null,
            input: valueRow(
                <input type="text" inputMode="decimal" value={vitals.temp}
                    onChange={e => setValue('temp', e.target.value)}
                    placeholder={tempUnit === 'F' ? '98.6' : '37.0'} className={`${inputCx} min-w-0`} />,
                conversionOnly ? unitBar('°F', '°C', `°${tempUnit}`, toggleTempUnit) : null,
            ),
        },
        {
            key: 'ht', label: conversionOnly ? 'Ht' : `Ht (${htUnit})`,
            hint: htAlt ? { text: `${htAlt}${htFtIn ? ` · ${htFtIn}` : ''}` } : null,
            input: valueRow(
                <input type="text" inputMode="decimal" value={vitals.ht}
                    onChange={e => setValue('ht', e.target.value)}
                    placeholder={htUnit === 'in' ? '68' : '173'} className={`${inputCx} min-w-0`} />,
                conversionOnly ? unitBar('in', 'cm', htUnit, toggleHtUnit) : null,
            ),
        },
        {
            key: 'wt', label: conversionOnly ? 'Wt' : `Wt (${wtUnit})`,
            hint: wtAlt ? { text: wtAlt } : null,
            input: valueRow(
                <input type="text" inputMode="decimal" value={vitals.wt}
                    onChange={e => setValue('wt', e.target.value)}
                    placeholder={wtUnit === 'lbs' ? '170' : '77'} className={`${inputCx} min-w-0`} />,
                conversionOnly ? unitBar('lbs', 'kg', wtUnit, toggleWtUnit) : null,
            ),
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
                    className={`flex items-center gap-1.5 w-full justify-start text-base md:text-[10pt] focus:outline-none ${lmpDisplay ? 'text-primary' : 'text-tertiary'}`}
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

    return (
        <FieldGrid>
            {visibleCells.map(c => (
                <FieldCell
                    key={c.key}
                    bare
                    label={c.label}
                    hint={c.hint?.text}
                    hintClass={c.hint?.color}
                    className={c.cellClass}
                >
                    {c.input}
                    {c.extra}
                </FieldCell>
            ))}
        </FieldGrid>
    )
})

const round1 = (n: number) => (Math.round(n * 10) / 10).toString()

const inputCx = 'w-full bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-[10pt]'
