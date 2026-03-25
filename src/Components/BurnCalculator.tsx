import { useState, useMemo, useCallback } from 'react'
import { RotateCcw, ChevronDown, ChevronUp, User, Baby } from 'lucide-react'
import { SectionHeader } from './Section'
import { REGIONS_MAP } from './BurnDiagram/burnRegions'
import { BurnBodyDiagram } from './BurnDiagram/BurnBodyDiagram'

type PatientType = 'adult' | 'pediatric'

interface DepthInfo {
    title: string
    color: string
    bgColor: string
    criteria: string[]
}

const BURN_DEPTHS: DepthInfo[] = [
    {
        title: 'Superficial (1st Degree)',
        color: 'text-themeyellow',
        bgColor: 'bg-themeyellow/10 border-themeyellow/20',
        criteria: [
            'Epidermis only',
            'Red, painful, dry — no blisters',
            'Blanches with pressure',
            'Pain and redness resolve within 3 days',
            'Heals without scarring',
        ],
    },
    {
        title: 'Partial Thickness (2nd Degree)',
        color: 'text-themeblue2',
        bgColor: 'bg-themeblue2/10 border-themeblue2/20',
        criteria: [
            'Extends into dermis',
            'Superficial partial: red, painful, weeps, blisters within 24hr — heals in ~3 weeks',
            'Deep partial: painful to pressure only, waxy/wet, does not blanch — heals in ~2 months',
            'Risk of secondary infection (warmth, discharge, odor, spreading redness)',
            '>10% TBSA → evaluate for burn center referral',
        ],
    },
    {
        title: 'Full Thickness (3rd Degree)',
        color: 'text-themeredred',
        bgColor: 'bg-themeredred/10 border-themeredred/20',
        criteria: [
            'Through entire dermis, may involve subcutaneous tissue',
            'White, waxy, leathery, or charred appearance',
            'Insensate — nerve endings destroyed',
            'Does not blanch, no blisters',
            'Requires surgical intervention — always refer to burn center',
        ],
    },
]

export function BurnCalculator() {
    const [patientType, setPatientType] = useState<PatientType>('adult')
    const [weight, setWeight] = useState('')
    const [burnedRegions, setBurnedRegions] = useState<Set<string>>(new Set())
    const [depthOpen, setDepthOpen] = useState<Record<number, boolean>>({})

    const toggleRegion = useCallback((id: string) => {
        setBurnedRegions(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
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

    const handleReset = useCallback(() => {
        setWeight('')
        setBurnedRegions(new Set())
        setPatientType('adult')
    }, [])

    const toggleDepth = useCallback((idx: number) => {
        setDepthOpen(prev => ({ ...prev, [idx]: !prev[idx] }))
    }, [])

    const inputClass = 'text-xs px-2 py-1.5 rounded border border-themegray1/20 bg-themewhite text-tertiary outline-none focus:border-themeblue1/30'

    return (
        <div className="p-3 space-y-4">
            {/* Patient type + weight row */}
            <div className="flex items-start gap-3">
                <div className="flex gap-1">
                    {([
                        { type: 'adult' as const, Icon: User, label: 'Adult' },
                        { type: 'pediatric' as const, Icon: Baby, label: 'Pediatric' },
                    ]).map(({ type, Icon, label }) => (
                        <button
                            key={type}
                            onClick={() => setPatientType(type)}
                            aria-label={label}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 ${
                                patientType === type
                                    ? 'bg-themeblue2 text-white shadow-sm'
                                    : 'text-tertiary/70 hover:text-primary bg-themewhite2'
                            }`}
                        >
                            <Icon size={18} />
                        </button>
                    ))}
                </div>
                <div className="flex flex-col">
                    <label className="text-xs text-secondary mb-0.5">Wt (lbs)</label>
                    <input
                        type="text"
                        inputMode="decimal"
                        value={weight}
                        onChange={e => setWeight(e.target.value)}
                        placeholder="170"
                        className={`${inputClass} w-16 text-center`}
                    />
                    {wtKgDisplay && (
                        <span className="text-[10px] text-secondary/50 mt-0.5">= {wtKgDisplay} kg</span>
                    )}
                </div>
            </div>

            {/* Body Diagram */}
            <BurnBodyDiagram
                patientType={patientType}
                burnedRegions={burnedRegions}
                totalTBSA={totalTBSA}
                onToggleRegion={toggleRegion}
            />

            {/* Parkland Formula */}
            {parkland && wtKg !== null && (
                <div className="rounded-xl border bg-themeblue2/5 border-themeblue2/15 p-3 animate-cardAppearIn">
                    <SectionHeader>Parkland Formula</SectionHeader>
                    <p className="text-[10px] text-tertiary mb-2 mt-1">
                        4 mL × {totalTBSA.toFixed(1)}% TBSA × {wtKg.toFixed(1)} kg = {parkland.total.toLocaleString()} mL / 24hr
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-themewhite p-2.5">
                            <p className="text-[10px] text-secondary mb-0.5">First 8 hours</p>
                            <p className="text-sm font-bold text-primary">{parkland.first8hrTotal.toLocaleString()} mL</p>
                            <p className="text-[10px] text-themeblue2 font-medium">{parkland.first8hrRate} mL/hr</p>
                        </div>
                        <div className="rounded-lg bg-themewhite p-2.5">
                            <p className="text-[10px] text-secondary mb-0.5">Next 16 hours</p>
                            <p className="text-sm font-bold text-primary">{parkland.next16hrTotal.toLocaleString()} mL</p>
                            <p className="text-[10px] text-themeblue2 font-medium">{parkland.next16hrRate} mL/hr</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Burn Depth Reference */}
            <div>
                <SectionHeader>Burn Depth Reference</SectionHeader>
                <div className="space-y-2 mt-2">
                    {BURN_DEPTHS.map((depth, idx) => {
                        const isOpen = depthOpen[idx] ?? false
                        return (
                            <div key={depth.title} className={`rounded-xl border ${depth.bgColor} overflow-hidden`}>
                                <button
                                    onClick={() => toggleDepth(idx)}
                                    className="flex items-center justify-between w-full px-3 py-2.5 text-left active:scale-[0.98] transition-all"
                                >
                                    <span className={`text-xs font-medium ${depth.color}`}>{depth.title}</span>
                                    {isOpen
                                        ? <ChevronUp size={14} className="text-tertiary/50" />
                                        : <ChevronDown size={14} className="text-tertiary/50" />
                                    }
                                </button>
                                {isOpen && (
                                    <div className="px-3 pb-2.5 space-y-1 animate-cardAppearIn">
                                        {depth.criteria.map((c, ci) => (
                                            <p key={ci} className="text-[11px] text-secondary/80 leading-relaxed pl-2 border-l-2 border-tertiary/10">
                                                {c}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Reset */}
            <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-xs text-tertiary hover:text-secondary active:scale-95 transition-all"
            >
                <RotateCcw size={12} />
                Clear
            </button>
        </div>
    )
}
