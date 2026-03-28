import { Section, SectionCard } from '../Section'
import type { PatientType } from './burnDiagramTypes'
import { BodyRegionSvg } from './BodyRegionSvg'

interface Props {
    patientType: PatientType
    burnedRegions: Set<string>
    onToggleRegion: (id: string) => void
}

export function BurnBodyDiagram({
    patientType,
    burnedRegions,
    onToggleRegion,
}: Props) {
    return (
        <Section title="TBSA — Rule of Nines">
            <SectionCard>
                <BodyRegionSvg
                    patientType={patientType}
                    burnedRegions={burnedRegions}
                    onToggle={onToggleRegion}
                />
            </SectionCard>
        </Section>
    )
}
