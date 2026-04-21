import { useState, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react'

export interface VitalSignsCalculatorHandle {
    reset: () => void
}

export const VitalSignsCalculator = forwardRef<VitalSignsCalculatorHandle>(function VitalSignsCalculator(_, ref) {
    const [vitals, setVitals] = useState<Record<string, string>>({
        hr: '', rr: '', bpSys: '', bpDia: '', temp: '', ht: '', wt: '',
    })

    const setValue = useCallback((key: string, value: string) => {
        setVitals(prev => ({ ...prev, [key]: value }))
    }, [])

    const handleReset = useCallback(() => {
        setVitals({ hr: '', rr: '', bpSys: '', bpDia: '', temp: '', ht: '', wt: '' })
    }, [])

    useImperativeHandle(ref, () => ({ reset: handleReset }), [handleReset])

    // ── Derived conversions ──────────────────────────────────────
    const htIn = parseFloat(vitals.ht)
    const wtLbs = parseFloat(vitals.wt)
    const tempF = parseFloat(vitals.temp)

    const htCm = vitals.ht && !isNaN(htIn) ? (htIn * 2.54).toFixed(1) : null
    const htFtIn = vitals.ht && !isNaN(htIn) ? `${Math.floor(htIn / 12)}' ${(htIn % 12).toFixed(0)}"` : null
    const wtKg = vitals.wt && !isNaN(wtLbs) ? (wtLbs * 0.453592).toFixed(1) : null
    const tempC = vitals.temp && !isNaN(tempF) ? ((tempF - 32) * (5 / 9)).toFixed(1) : null

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

    const inputClass = 'text-sm px-3 py-2 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite text-primary outline-none focus:border-themeblue1/30 focus:bg-themewhite2 transition-all duration-300 placeholder:text-tertiary'

    return (
        <div className="px-5 pb-6 pt-1 space-y-4">
            {/* Vital Signs grid — matches PhysicalExam layout */}
            <div className="grid grid-cols-3 gap-2">
                {/* HR */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">HR (bpm)</label>
                    <input
                        type="text" inputMode="numeric"
                        value={vitals.hr} onChange={e => setValue('hr', e.target.value)}
                        placeholder="60-100" className={inputClass}
                    />
                </div>

                {/* RR */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">RR (/min)</label>
                    <input
                        type="text" inputMode="numeric"
                        value={vitals.rr} onChange={e => setValue('rr', e.target.value)}
                        placeholder="12-20" className={inputClass}
                    />
                </div>

                {/* BP */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">BP (mmHg)</label>
                    <div className="flex items-center gap-1">
                        <input
                            type="text" inputMode="numeric"
                            value={vitals.bpSys} onChange={e => setValue('bpSys', e.target.value)}
                            placeholder="120"
                            className={`w-1/2 ${inputClass}`}
                        />
                        <span className="text-xs text-secondary">/</span>
                        <input
                            type="text" inputMode="numeric"
                            value={vitals.bpDia} onChange={e => setValue('bpDia', e.target.value)}
                            placeholder="80"
                            className={`w-1/2 ${inputClass}`}
                        />
                    </div>
                </div>

                {/* Temp */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">Temp (°F)</label>
                    <input
                        type="text" inputMode="decimal"
                        value={vitals.temp} onChange={e => setValue('temp', e.target.value)}
                        placeholder="98.6" className={inputClass}
                    />
                    {tempC && (
                        <span className="text-xs text-secondary mt-0.5">= {tempC} °C</span>
                    )}
                    {tempHint && (
                        <span className={`text-xs font-medium mt-0.5 ${tempHint.color}`}>{tempHint.label}</span>
                    )}
                </div>

                {/* Ht */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">Ht (in)</label>
                    <input
                        type="text" inputMode="decimal"
                        value={vitals.ht} onChange={e => setValue('ht', e.target.value)}
                        placeholder="68" className={inputClass}
                    />
                    {htCm && (
                        <span className="text-xs text-secondary mt-0.5">= {htCm} cm {htFtIn && `· ${htFtIn}`}</span>
                    )}
                </div>

                {/* Wt */}
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">Wt (lbs)</label>
                    <input
                        type="text" inputMode="decimal"
                        value={vitals.wt} onChange={e => setValue('wt', e.target.value)}
                        placeholder="170" className={inputClass}
                    />
                    {wtKg && (
                        <span className="text-xs text-secondary mt-0.5">= {wtKg} kg</span>
                    )}
                </div>
            </div>

            {/* BMI — derived from Ht + Wt */}
            {bmiInfo && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary">BMI:</span>
                    <span className={`text-xs font-medium ${
                        bmiInfo.value < 18.5 ? 'text-themeyellow'
                        : bmiInfo.value < 25 ? 'text-themegreen'
                        : bmiInfo.value < 30 ? 'text-themeyellow'
                        : 'text-themeredred'
                    }`}>
                        {bmiInfo.display}
                    </span>
                    <span className="text-xs text-secondary">
                        {bmiInfo.value < 18.5 ? 'Underweight'
                        : bmiInfo.value < 25 ? 'Normal'
                        : bmiInfo.value < 30 ? 'Overweight'
                        : 'Obese'}
                    </span>
                </div>
            )}

        </div>
    )
})
