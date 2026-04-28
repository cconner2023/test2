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

    const inputCx = 'flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-base md:text-[10pt]'
    const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'
    const labelCx = 'text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0'

    return (
        <div>
                {/* HR */}
                <div className={rowCx}>
                    <span className={labelCx}>HR (bpm)</span>
                    <input
                        type="text" inputMode="numeric"
                        value={vitals.hr} onChange={e => setValue('hr', e.target.value)}
                        placeholder="60-100" className={inputCx}
                    />
                </div>

                {/* RR */}
                <div className={rowCx}>
                    <span className={labelCx}>RR (/min)</span>
                    <input
                        type="text" inputMode="numeric"
                        value={vitals.rr} onChange={e => setValue('rr', e.target.value)}
                        placeholder="12-20" className={inputCx}
                    />
                </div>

                {/* BP */}
                <div className={rowCx}>
                    <span className={labelCx}>BP (mmHg)</span>
                    <div className="flex items-center gap-1 flex-1 justify-end">
                        <input
                            type="text" inputMode="numeric"
                            value={vitals.bpSys} onChange={e => setValue('bpSys', e.target.value)}
                            placeholder="120"
                            className={`${inputCx} w-14`}
                        />
                        <span className="text-[10pt] text-tertiary">/</span>
                        <input
                            type="text" inputMode="numeric"
                            value={vitals.bpDia} onChange={e => setValue('bpDia', e.target.value)}
                            placeholder="80"
                            className={`${inputCx} w-14`}
                        />
                    </div>
                </div>

                {/* Temp */}
                <div className={rowCx}>
                    <span className={labelCx}>Temp (°F)</span>
                    <div className="flex flex-col items-end flex-1 gap-0.5">
                        <input
                            type="text" inputMode="decimal"
                            value={vitals.temp} onChange={e => setValue('temp', e.target.value)}
                            placeholder="98.6" className={inputCx}
                        />
                        {(tempC || tempHint) && (
                            <div className="flex items-center gap-1.5 text-[9pt]">
                                {tempC && <span className="text-tertiary">{tempC} °C</span>}
                                {tempHint && <span className={`font-medium ${tempHint.color}`}>{tempHint.label}</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* Ht */}
                <div className={rowCx}>
                    <span className={labelCx}>Ht (in)</span>
                    <div className="flex flex-col items-end flex-1 gap-0.5">
                        <input
                            type="text" inputMode="decimal"
                            value={vitals.ht} onChange={e => setValue('ht', e.target.value)}
                            placeholder="68" className={inputCx}
                        />
                        {htCm && (
                            <span className="text-[9pt] text-tertiary">{htCm} cm{htFtIn && ` · ${htFtIn}`}</span>
                        )}
                    </div>
                </div>

                {/* Wt */}
                <div className={rowCx}>
                    <span className={labelCx}>Wt (lbs)</span>
                    <div className="flex flex-col items-end flex-1 gap-0.5">
                        <input
                            type="text" inputMode="decimal"
                            value={vitals.wt} onChange={e => setValue('wt', e.target.value)}
                            placeholder="170" className={inputCx}
                        />
                        {wtKg && (
                            <span className="text-[9pt] text-tertiary">{wtKg} kg</span>
                        )}
                    </div>
                </div>

                {/* BMI — derived from Ht + Wt */}
                {bmiInfo && (
                    <div className={rowCx}>
                        <span className={labelCx}>BMI</span>
                        <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-medium ${
                                bmiInfo.value < 18.5 ? 'text-themeyellow'
                                : bmiInfo.value < 25 ? 'text-themegreen'
                                : bmiInfo.value < 30 ? 'text-themeyellow'
                                : 'text-themeredred'
                            }`}>
                                {bmiInfo.display}
                            </span>
                            <span className="text-[9pt] text-tertiary">
                                {bmiInfo.value < 18.5 ? 'Underweight'
                                : bmiInfo.value < 25 ? 'Normal'
                                : bmiInfo.value < 30 ? 'Overweight'
                                : 'Obese'}
                            </span>
                        </div>
                    </div>
                )}
        </div>
    )
})
