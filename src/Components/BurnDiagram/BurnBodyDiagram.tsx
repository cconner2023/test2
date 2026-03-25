import { SectionHeader } from '../Section'
import type { PatientType } from './burnDiagramTypes'
import { BURN_REGIONS } from './burnRegions'
import { BodyRegionSvg } from './BodyRegionSvg'

interface Props {
    patientType: PatientType
    burnedRegions: Set<string>
    totalTBSA: number
    onToggleRegion: (id: string) => void
}

export function BurnBodyDiagram({
    patientType,
    burnedRegions,
    totalTBSA,
    onToggleRegion,
}: Props) {
    const selectedRegions = BURN_REGIONS.filter(r => burnedRegions.has(r.id))

    return (
        <div>
            {/* Header with TBSA badge */}
            <div className="flex items-center justify-between mb-2">
                <SectionHeader>TBSA — Rule of Nines</SectionHeader>
                <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${
                    totalTBSA > 0 ? 'bg-themeredred/15 text-themeredred' : 'bg-themewhite2 text-tertiary'
                }`}>
                    {totalTBSA.toFixed(1)}%
                </span>
            </div>

            {/* Body diagram with overlay hit zones */}
            <BodyRegionSvg
                patientType={patientType}
                burnedRegions={burnedRegions}
                onToggle={onToggleRegion}
            />

            {/* Selected region chips — tap to deselect */}
            {selectedRegions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                    {selectedRegions.map(region => {
                        const pct = patientType === 'adult' ? region.adultPct : region.pedPct
                        return (
                            <button
                                key={region.id}
                                onClick={() => onToggleRegion(region.id)}
                                className="flex items-center gap-1 px-2 py-1 rounded-full bg-themeredred/10 text-themeredred text-[10px] font-medium active:scale-95 transition-all"
                            >
                                {region.label}
                                <span className="opacity-60">{pct}%</span>
                                <span className="ml-0.5 opacity-40">×</span>
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
