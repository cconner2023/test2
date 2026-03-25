export type BodyView = 'front' | 'back'
export type PatientType = 'adult' | 'pediatric'

export interface BurnRegion {
    id: string
    label: string
    view: BodyView
    adultPct: number
    pedPct: number
}

export interface RegionPathData {
    id: string
    d: string
    labelPos: [number, number]
}

export interface BodyViewPaths {
    viewBox: string
    regions: RegionPathData[]
    dividers: string[]
}
