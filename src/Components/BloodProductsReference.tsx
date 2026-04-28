import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface ProtocolSection {
    title: string
    content: string[]
}

const PROTOCOLS: ProtocolSection[] = [
    {
        title: 'Massive Transfusion Protocol (MTP)',
        content: [
            'Trigger criteria: Anticipated need for >10 units pRBCs in 24hr, unstable hemodynamics despite crystalloid, active hemorrhage with coagulopathy, or Assessment of Blood Consumption (ABC) score ≥2.',
            'Target ratio: 1:1:1 (pRBCs : FFP : Platelets). Whole blood preferred when available.',
            'Activation: Notify blood bank/lab, request MTP cooler, assign dedicated runner. Reassess after each round (4-6 units pRBC equivalent).',
            'Adjuncts: Tranexamic acid (TXA) 1g IV within 3hr of injury, then 1g over 8hr. Calcium chloride 1g IV per 4 units transfused to prevent citrate toxicity.',
            'Endpoints: SBP >90 mmHg, HR <120, lactate trending down, INR <1.5, fibrinogen >150 mg/dL.',
        ],
    },
    {
        title: 'Damage Control Resuscitation',
        content: [
            'Permissive hypotension: Target SBP 80-90 mmHg (MAP 50-60) until surgical hemorrhage control. Exception: traumatic brain injury — maintain SBP >100.',
            'Limit crystalloid: Restrict to ≤1L isotonic crystalloid. Transition to blood products early.',
            'Prevent lethal triad: Hypothermia (<36°C), acidosis (pH <7.2), coagulopathy (INR >1.5). Warm all fluids, maintain core temp, minimize crystalloid dilution.',
            'Hemostatic resuscitation: Use warm fresh whole blood (WFWB) as first-line when available. Component therapy (1:1:1) when whole blood unavailable.',
            'Reassess every 15 min: Vitals, mental status, lactate/base deficit if available, bleeding rate.',
        ],
    },
    {
        title: 'Walking Blood Bank',
        content: [
            'Pre-screened donors: Maintain roster of typed/screened personnel. Rescreen every 120 days or per unit SOP.',
            'Donor criteria: No medications in 72hr (except routine), no illness in 14 days, no tattoo/piercing in 12 months, hemoglobin ≥12.5 g/dL.',
            'Low-titer O whole blood (LTOWB): Preferred universal product. Titer anti-A/anti-B <256. Screen donors in advance.',
            'Collection: 450-500 mL per unit using CPDA-1 collection bags. Donor must hydrate and rest 15 min post-donation. Limit to 1 unit per donor per 8-week period.',
            'Documentation: Record donor ID, recipient ID, time of collection, time of transfusion, any reactions.',
        ],
    },
    {
        title: 'Whole Blood Collection (Field)',
        content: [
            'Buddy transfusion: Last resort when no banked products available and patient faces imminent death from hemorrhage.',
            'Verify donor blood type if possible. O-low titer preferred. Direct type-specific second choice.',
            'Collection steps: Apply tourniquet to donor, prep antecubital fossa, collect into CPDA-1 bag (450 mL), mix gently during collection.',
            'Volume limits: Never exceed 500 mL per donor. Monitor donor for vasovagal response. Donor must not return to duty for 24hr minimum.',
            'Transfuse immediately — field-collected whole blood has no storage time without cold chain. Monitor recipient for transfusion reactions (fever, urticaria, dyspnea, hemolysis).',
            'Transfusion reaction management: Stop transfusion, maintain IV access, administer diphenhydramine 50mg IV for mild reactions, epinephrine 0.3mg IM for anaphylaxis.',
        ],
    },
    {
        title: 'Product Storage & Handling',
        content: [
            'Packed RBCs: 1-6°C, shelf life 42 days (CPDA-1) or 35 days (AS-1). Do not freeze. Must transfuse within 4hr of leaving cold chain.',
            'Fresh Frozen Plasma: ≤-18°C, shelf life 12 months. Thaw at 30-37°C (takes ~30 min). Once thawed, store at 1-6°C for up to 5 days (as thawed plasma).',
            'Platelets: 20-24°C with continuous agitation, shelf life 5 days. Do NOT refrigerate — causes irreversible aggregation.',
            'Whole blood (CPDA-1): 1-6°C, shelf life 21 days cold-stored. Warm to room temp before transfusion if possible.',
            'Cryoprecipitate: ≤-18°C, shelf life 12 months. Thaw at 30-37°C. Once thawed, transfuse within 6hr (4hr if pooled).',
            'Field rule: When in doubt about storage integrity, do not transfuse. Hemolyzed or discolored products must be discarded.',
        ],
    },
]

export function BloodProductsReference() {
    const [collapsed, setCollapsed] = useState<Record<number, boolean>>({})

    const toggle = useCallback((idx: number) => {
        setCollapsed(prev => ({ ...prev, [idx]: !prev[idx] }))
    }, [])

    return (
        <div className="p-3 space-y-2">
            {PROTOCOLS.map((section, idx) => {
                const isCollapsed = collapsed[idx] ?? false
                return (
                    <div key={section.title} className="rounded-xl bg-themewhite2/50 border border-tertiary/8 overflow-hidden">
                        <button
                            onClick={() => toggle(idx)}
                            className="flex items-center justify-between w-full px-3 py-2.5 text-left active:scale-[0.98] transition-all"
                        >
                            <span className="text-[10pt] font-medium text-primary">{section.title}</span>
                            {isCollapsed
                                ? <ChevronDown size={14} className="text-tertiary shrink-0" />
                                : <ChevronUp size={14} className="text-tertiary shrink-0" />
                            }
                        </button>
                        {!isCollapsed && (
                            <div className="px-3 pb-3 space-y-2">
                                {section.content.map((item, ci) => (
                                    <p key={ci} className="text-[9pt] text-secondary leading-relaxed pl-2 border-l-2 border-themeblue2/15">
                                        {item}
                                    </p>
                                ))}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
