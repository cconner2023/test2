import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileSpreadsheet, FileText, PackageCheck, ClipboardList } from 'lucide-react'
import { Section, SectionCard } from '../Section'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { useDA2062Export } from '../../Hooks/useDA2062Export'
import { Da2062Preview } from './Da2062Preview'
import { computeShortages } from '../../Utilities/propertyShortage'
import { exportShortageCSV } from '../../Utilities/PropertyCSV'
import type { DA2062Params } from '../../Utilities/DA2062Export'
import type { HolderInfo } from '../../Types/PropertyTypes'

interface PropertyShortagePanelProps {
  /** Present for host-call symmetry with the other pane bodies; the host owns the
   *  close affordance, so this body never needs to call it. */
  onClose?: () => void
  /** Items staged for turn-in (open pending marker) — counted as on-hand 0 so a staged
   *  line surfaces its shortage immediately. Lifted in PropertyPanel from useHandReceipts. */
  stagedTurnInIds?: Set<string>
}

/** A synthetic holder for the annex header (no real recipient — this is a unit
 *  shortage listing, not a hand receipt to a person). */
function annexHolder(displayName: string): HolderInfo {
  return { id: '', rank: null, firstName: null, lastName: null, displayName }
}

/** Surfaceless shortage / requisition report. Hosted in the Property right pane
 *  (desktop) / detail sheet (mobile) by PropertyPanel — the host owns the header +
 *  close affordance. Shortage = authorized − on-hand, a pure client fold over the
 *  already-loaded items (see computeShortages). */
export function PropertyShortagePanel({ stagedTurnInIds }: PropertyShortagePanelProps) {
  const items = usePropertyStore(useShallow(s => s.items))
  const { exportDA2062, da2062Preview, downloadDA2062, clearDA2062Preview } = useDA2062Export()

  const report = useMemo(() => computeShortages(items, stagedTurnInIds), [items, stagedTurnInIds])

  const exportAnnex = () => {
    const params: DA2062Params = {
      items: report.lines.map(l => ({
        name: l.name,
        nomenclature: l.nomenclature,
        nsn: l.nsn,
        serial_number: l.serialNumber,
        quantity: l.short,
      })),
      fromHolder: annexHolder('SHORTAGE ANNEX'),
      toHolder: annexHolder('SUPPLY'),
      handReceiptNumber: 'SHORTAGE ANNEX',
      date: new Date().toLocaleDateString(),
    }
    void exportDA2062(params)
  }

  // Nothing authorized yet → point the user at the BOM upload.
  if (report.trackedCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <ClipboardList className="w-10 h-10 text-tertiary" />
        <p className="text-sm text-secondary">No authorized quantities yet.</p>
        <p className="text-[10pt] text-tertiary max-w-[260px]">
          Upload a property CSV with a <span className="font-medium">Quantity Authorized</span> column
          to set the baseline — shortages are computed from authorized vs on-hand.
        </p>
      </div>
    )
  }

  // Tracked, but everything is stocked.
  if (report.orders.length === 0 && report.lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <PackageCheck className="w-10 h-10 text-themegreen" />
        <p className="text-sm text-secondary">Fully stocked — no shortages.</p>
        <p className="text-[10pt] text-tertiary">{report.trackedCount} authorized lines, all on hand.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Requisition list — the actionable "what to order" view. */}
      {report.orders.length > 0 && (
        <Section title="To order">
          <SectionCard>
            <table className="w-full text-[10pt]">
              <thead>
                <tr className="border-b border-themeblue3/10">
                  <th className="text-left px-3 py-2 text-tertiary font-medium">Item</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">Auth</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">On hand</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">Order</th>
                </tr>
              </thead>
              <tbody>
                {report.orders.map((o, i) => (
                  <tr key={i} className="border-b border-themeblue3/10 last:border-b-0">
                    <td className="px-3 py-2 text-primary truncate max-w-[160px]">
                      {o.name}
                      {o.nsn && <span className="block text-[9pt] text-tertiary">NSN {o.nsn}</span>}
                    </td>
                    <td className="px-3 py-2 text-secondary text-right">{o.authorized}</td>
                    <td className="px-3 py-2 text-secondary text-right">{o.onHand}</td>
                    <td className="px-3 py-2 text-themeredred font-medium text-right">{o.order}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </Section>
      )}

      {/* Per-line shortfalls — the inventory/layout view. */}
      {report.lines.length > 0 && (
        <Section title="Short lines">
          <SectionCard>
            <table className="w-full text-[10pt]">
              <thead>
                <tr className="border-b border-themeblue3/10">
                  <th className="text-left px-3 py-2 text-tertiary font-medium">Item</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">Auth</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">On hand</th>
                  <th className="text-right px-3 py-2 text-tertiary font-medium">Short</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((l) => (
                  <tr key={l.itemId} className="border-b border-themeblue3/10 last:border-b-0">
                    <td className="px-3 py-2 text-primary truncate max-w-[160px]">
                      {l.name}
                      {l.skoName && <span className="block text-[9pt] text-tertiary">in {l.skoName}</span>}
                    </td>
                    <td className="px-3 py-2 text-secondary text-right">{l.authorized}</td>
                    <td className="px-3 py-2 text-secondary text-right">{l.onHand}</td>
                    <td className="px-3 py-2 text-themeredred font-medium text-right">{l.short}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SectionCard>
        </Section>
      )}

      {/* Exports — conditionally rendered (no disabled actions). */}
      <div className="flex flex-col gap-2">
        {report.orders.length > 0 && (
          <button
            type="button"
            onClick={() => exportShortageCSV(report.orders)}
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-themewhite2 border border-tertiary/20 text-primary"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export order CSV
          </button>
        )}
        {report.lines.length > 0 && (
          <button
            type="button"
            onClick={exportAnnex}
            className="flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium bg-themeblue3 text-white"
          >
            <FileText className="w-4 h-4" />
            DA 2062 shortage annex
          </button>
        )}
      </div>

      <Da2062Preview
        preview={da2062Preview}
        onDownload={downloadDA2062}
        onClose={clearDA2062Preview}
      />
    </div>
  )
}
