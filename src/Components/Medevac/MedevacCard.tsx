import { AlertTriangle } from 'lucide-react'
import { SectionCard } from '../Section'
import { useIsMobile } from '../../Hooks/useIsMobile'
import type { MedevacRequest } from '../../Types/MedevacTypes'
import {
  MEDEVAC_PRECEDENCE_LABELS,
  MEDEVAC_EQUIPMENT_LABELS,
  MEDEVAC_SECURITY_LABELS,
  MEDEVAC_MARKING_LABELS,
  MEDEVAC_NATIONALITY_LABELS,
  MEDEVAC_NBC_LABELS,
  MEDEVAC_STATUS_LABELS,
  medevacPatientTotal,
  medevacHighestPrecedence,
  type MedevacNationality,
} from '../../Types/MedevacTypes'

interface MedevacCardProps {
  data: MedevacRequest
}

export function MedevacCard({ data }: MedevacCardProps) {
  const isMobile = useIsMobile()
  const isHot = data.mode !== 'peacetime' && (data.l6 === 'E' || data.l6 === 'X')
  const hasNBC = data.mode !== 'peacetime' && data.l9 !== 'N'
  const highest = medevacHighestPrecedence(data)
  const total = medevacPatientTotal(data)

  const rowCx = `flex items-start justify-between gap-4 ${isMobile ? 'px-4 py-2.5' : 'px-3 py-2'} border-b border-primary/6 last:border-0`
  const labelCx = 'text-[9pt] font-semibold text-tertiary tracking-widest uppercase shrink-0'
  const valueCx = `font-medium text-primary text-right ${isMobile ? 'text-sm' : 'text-[10pt]'}`

  // "1A, 2C" precedence summary
  const l3Summary = (['A','B','C','D','E'] as const)
    .filter(p => (data.l3[p] ?? 0) > 0)
    .map(p => `${data.l3[p]}${p}`)
    .join(', ') || '0'

  return (
    <SectionCard className={isHot || hasNBC ? 'border-themeredred/30' : ''}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isMobile ? 'px-4 py-2.5' : 'px-3 py-2'} border-b ${
        isHot || hasNBC ? 'border-themeredred/20 bg-themeredred/5' : 'border-primary/8 bg-themewhite3'
      }`}>
        <div className="flex items-center gap-1.5">
          {(isHot || hasNBC) && <AlertTriangle size={12} className="text-themeredred" />}
          <span className="text-[9pt] font-bold tracking-widest uppercase text-themeblue2">9-Line MEDEVAC</span>
        </div>
        <div className="flex items-center gap-2">
          {highest && (
            <span className={`text-[9pt] px-2 py-0.5 rounded-full font-semibold ${
              highest === 'A' || highest === 'B'
                ? 'bg-themeredred/15 text-themeredred'
                : highest === 'C'
                  ? 'bg-themeyellow/20 text-themeyellow'
                  : 'bg-themeblue2/10 text-themeblue2'
            }`}>
              {highest} — {MEDEVAC_PRECEDENCE_LABELS[highest]}
            </span>
          )}
          <span className="text-[9pt] text-tertiary capitalize">{data.mode}</span>
          <span className="text-[9pt] text-tertiary">{MEDEVAC_STATUS_LABELS[data.status]}</span>
        </div>
      </div>

      {/* Line 1 */}
      <div className={rowCx}>
        <span className={labelCx}>L1 Pickup</span>
        <div className="text-right">
          <p className={`${valueCx} font-mono tracking-wider`}>{data.l1 || '—'}</p>
          {data.l1d && <p className={`text-tertiary ${isMobile ? 'text-[10pt]' : 'text-[9pt]'}`}>{data.l1d}</p>}
        </div>
      </div>

      {/* Line 2 */}
      <div className={rowCx}>
        <span className={labelCx}>L2 Radio</span>
        <p className={valueCx}>
          {[data.l2f, data.l2c, data.l2s].filter(Boolean).join(' / ') || '—'}
        </p>
      </div>

      {/* Line 3 */}
      <div className={rowCx}>
        <span className={labelCx}>L3 Patients ({total})</span>
        <p className={valueCx}>{l3Summary}</p>
      </div>

      {/* Line 4 */}
      <div className={rowCx}>
        <span className={labelCx}>L4 Equipment</span>
        <p className={valueCx}>{data.l4.map(e => `${e} — ${MEDEVAC_EQUIPMENT_LABELS[e]}`).join(', ')}</p>
      </div>

      {/* Line 5 */}
      <div className={rowCx}>
        <span className={labelCx}>L5 Type</span>
        <p className={valueCx}>
          {[data.l5l > 0 && `${data.l5l}L`, data.l5a > 0 && `${data.l5a}A`].filter(Boolean).join(' / ') || '0'}
        </p>
      </div>

      {/* Line 6 */}
      {data.mode === 'peacetime' ? (
        <div className={rowCx}>
          <span className={labelCx}>L6 Wounds</span>
          <div className="text-right max-w-[55%]">
            {(data.l6wounds ?? []).length === 0
              ? <p className={valueCx}>—</p>
              : (data.l6wounds ?? []).map((w, i) => (
                  <p key={i} className={`${valueCx} leading-tight`}>{w.text}</p>
                ))
            }
          </div>
        </div>
      ) : (
        <div className={rowCx}>
          <span className={labelCx}>L6 Security</span>
          <p className={`${valueCx} ${isHot ? 'text-themeredred' : ''}`}>{data.l6} — {MEDEVAC_SECURITY_LABELS[data.l6]}</p>
        </div>
      )}

      {/* Line 7 */}
      <div className={rowCx}>
        <span className={labelCx}>L7 Marking</span>
        <div className="text-right">
          <p className={valueCx}>{data.l7} — {MEDEVAC_MARKING_LABELS[data.l7]}</p>
          {data.l7 === 'C' && data.l7c && (
            <p className={`text-tertiary ${isMobile ? 'text-[10pt]' : 'text-[9pt]'}`}>{data.l7c}</p>
          )}
          {data.l7 === 'E' && data.l7o && (
            <p className={`text-tertiary ${isMobile ? 'text-[10pt]' : 'text-[9pt]'}`}>{data.l7o}</p>
          )}
        </div>
      </div>

      {/* Line 8 */}
      <div className={rowCx}>
        <span className={labelCx}>L8 Nationality</span>
        <p className={`${valueCx} max-w-[55%]`}>
          {(['A','B','C','D','E'] as MedevacNationality[])
            .filter(n => (data.l8[n] ?? 0) > 0)
            .map(n => `${data.l8[n]} ${MEDEVAC_NATIONALITY_LABELS[n]}`)
            .join(', ') || '—'}
        </p>
      </div>

      {/* Line 9 */}
      <div className={rowCx}>
        <span className={labelCx}>{data.mode === 'peacetime' ? 'L9 Terrain' : 'L9 NBC'}</span>
        {data.mode === 'peacetime'
          ? <p className={`${valueCx} max-w-[55%] whitespace-pre-wrap text-right`}>{data.l9p || '—'}</p>
          : <p className={`${valueCx} ${hasNBC ? 'text-themeredred' : ''}`}>{data.l9} — {MEDEVAC_NBC_LABELS[data.l9]}</p>
        }
      </div>

      {data.notes && (
        <div className={`${isMobile ? 'px-4 py-2.5' : 'px-3 py-2'}`}>
          <p className={`text-secondary ${isMobile ? 'text-sm' : 'text-[10pt]'} whitespace-pre-wrap`}>{data.notes}</p>
        </div>
      )}
    </SectionCard>
  )
}
