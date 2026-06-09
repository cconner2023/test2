import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'
import { Section, SectionCard } from './Section'
import { ActionButton } from './ActionButton'
import { REGIONS_MAP } from './BurnDiagram/burnRegions'
import { BurnBodyDiagram } from './BurnDiagram/BurnBodyDiagram'
import { ActionPill } from './ActionPill'

type PatientType = 'adult' | 'pediatric'

export function BurnCalculator() {
    const patientType: PatientType = 'adult'
    const [weight, setWeight] = useState('')
    const [burnedRegions, setBurnedRegions] = useState<Set<string>>(new Set())
    const measurementsRef = useRef<HTMLDivElement>(null)
    const resultsRef = useRef<HTMLDivElement>(null)

    const toggleRegion = useCallback((id: string) => {
        setBurnedRegions(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
        // Scroll measurements into view after a region selection
        requestAnimationFrame(() => {
            measurementsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
    }, [])

    const totalTBSA = useMemo(() => {
        let total = 0
        for (const id of burnedRegions) {
            const region = REGIONS_MAP[id]
            if (region) total += patientType === 'adult' ? region.adultPct : region.pedPct
        }
        return total
    }, [burnedRegions, patientType])

    // Weight in lbs → convert to kg for Parkland
    const wtLbs = parseFloat(weight)
    const wtKg = weight && !isNaN(wtLbs) ? wtLbs * 0.453592 : null
    const wtKgDisplay = wtKg !== null ? wtKg.toFixed(1) : null
    const hasWeight = wtKg !== null && wtKg > 0

    // Rule of Ten (USAISR / JTS Burn CPG) — the field initial-rate method.
    // Initial LR rate (mL/hr) = %TBSA × 10 for adults 40–80 kg;
    // add 100 mL/hr for every full 10 kg over 80 kg. Titrate to UOP 30–50 mL/hr.
    const ruleOfTen = useMemo(() => {
        if (totalTBSA <= 0 || !hasWeight || wtKg === null) return null
        const base = totalTBSA * 10
        const adder = Math.floor(Math.max(0, wtKg - 80) / 10) * 100
        return {
            adder,
            rate: Math.round(base + adder),
            over80: wtKg > 80,
        }
    }, [totalTBSA, wtKg, hasWeight])

    // Parkland — 24-hour volume reference (4 mL × %TBSA × kg, half over first 8 hr).
    const parkland = useMemo(() => {
        if (totalTBSA <= 0 || !hasWeight || wtKg === null) return null
        const total = 4 * totalTBSA * wtKg
        const firstHalf = total / 2
        const secondHalf = total / 2
        return {
            total: Math.round(total),
            first8hrTotal: Math.round(firstHalf),
            first8hrRate: Math.round(firstHalf / 8),
            next16hrTotal: Math.round(secondHalf),
            next16hrRate: Math.round(secondHalf / 16),
        }
    }, [totalTBSA, wtKg, hasWeight])

    const showResults = ruleOfTen !== null
    // Scroll to results when they become visible
    useEffect(() => {
        if (showResults) {
            requestAnimationFrame(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            })
        }
    }, [showResults])

    const handleReset = useCallback(() => {
        setWeight('')
        setBurnedRegions(new Set())
    }, [])

    return (
        <div className="p-3 space-y-4">
            {/* Body Diagram */}
            <BurnBodyDiagram
                patientType={patientType}
                burnedRegions={burnedRegions}
                onToggleRegion={toggleRegion}
            />

            {/* Measurements */}
            <div ref={measurementsRef}>
                <Section title="Measurements">
                    <div className="relative">
                        <SectionCard>
                            <div>
                                {/* Wt row */}
                                <div className="flex items-center gap-3 px-4 py-3.5">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary">Wt</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 rounded-full border border-themeblue3/10 shadow-xs bg-themewhite focus-within:border-themeblue1/30 focus-within:bg-themewhite2 transition-all duration-300">
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                value={weight}
                                                onChange={e => setWeight(e.target.value)}
                                                placeholder="170"
                                                className="w-full bg-transparent outline-none text-base md:text-sm text-primary px-3 py-1.5 rounded-full text-center placeholder:text-tertiary"
                                            />
                                        </div>
                                        <span className="text-[10pt] text-tertiary">lbs</span>
                                        {wtKgDisplay && (
                                            <span className="text-[9pt] text-secondary">= {wtKgDisplay} kg</span>
                                        )}
                                    </div>
                                </div>

                                {/* TBSA row */}
                                <div className="flex items-center gap-3 px-4 py-3.5 border-t border-primary/6">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-primary">TBSA</p>
                                    </div>
                                    <span className={`text-sm font-bold ${
                                        totalTBSA > 0 ? 'text-primary' : 'text-tertiary'
                                    }`}>
                                        {totalTBSA.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </SectionCard>
                        <ActionPill shadow="sm" placement="overlay">
                            <ActionButton icon={RefreshCw} label="Clear" variant="danger" onClick={handleReset} />
                        </ActionPill>
                    </div>
                </Section>
            </div>

            {/* Rule of Ten — initial resuscitation rate (USAISR / JTS); appears when both Wt and TBSA are set */}
            {ruleOfTen && wtKg !== null && (
                <div ref={resultsRef} className="animate-cardAppearIn">
                    <Section title="Rule of Ten">
                        <SectionCard>
                            {/* Formula row → initial LR rate */}
                            <div className="flex items-center gap-3 px-4 py-3.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">
                                        {totalTBSA.toFixed(1)}% × 10{ruleOfTen.over80 ? ` + ${ruleOfTen.adder.toLocaleString()}` : ''}
                                    </p>
                                    <p className="text-[9pt] text-tertiary">
                                        Initial LR rate{ruleOfTen.over80 ? ' · +100 mL/hr per 10 kg over 80' : ''}
                                    </p>
                                </div>
                                <span className="text-sm font-bold text-primary">{ruleOfTen.rate.toLocaleString()} mL/hr</span>
                            </div>

                            {/* Titration endpoint */}
                            <div className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">Titrate to urine output</p>
                                </div>
                                <span className="text-sm font-bold text-themeblue2">30–50 mL/hr</span>
                            </div>
                        </SectionCard>
                    </Section>
                </div>
            )}

            {/* Parkland Formula — 24-hour volume reference */}
            {parkland && wtKg !== null && (
                <div className="animate-cardAppearIn">
                    <Section title="Parkland Formula">
                        <SectionCard>
                            {/* Formula row */}
                            <div className="flex items-center gap-3 px-4 py-3.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">4 mL × {totalTBSA.toFixed(1)}% × {wtKg.toFixed(1)} kg</p>
                                </div>
                                <span className="text-sm font-bold text-primary">{parkland.total.toLocaleString()} mL</span>
                            </div>

                            {/* First 8 hours row */}
                            <div className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">First 8 hours</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary">{parkland.first8hrTotal.toLocaleString()} mL</p>
                                    <p className="text-[9pt] text-themeblue2 font-medium">{parkland.first8hrRate} mL/hr</p>
                                </div>
                            </div>

                            {/* Next 16 hours row */}
                            <div className="flex items-center gap-3 px-4 py-3.5 border-t border-tertiary/10">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-primary">Next 16 hours</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-primary">{parkland.next16hrTotal.toLocaleString()} mL</p>
                                    <p className="text-[9pt] text-themeblue2 font-medium">{parkland.next16hrRate} mL/hr</p>
                                </div>
                            </div>
                        </SectionCard>
                    </Section>
                </div>
            )}
        </div>
    )
}
