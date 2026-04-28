// src/Components/Reports/LaceReport.tsx
import { useState } from 'react'
import { Copy, Check, Download, Printer, Plus, X } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { Section, SectionCard } from '../Section'
import { emptyLaceReport, DEFAULT_AMMO_TYPES } from '../../Types/ReportTypes'
import type { LaceReport as LaceReportType, LaceEquipmentLine } from '../../Types/ReportTypes'
import { laceToText, copyToClipboard, downloadAsText, printReport } from '../../lib/reportExport'
import { ActionPill } from '../ActionPill'

const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'

const inputInlineCx =
  'flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm'

const numberInputCx =
  'w-14 text-center rounded-full border border-themeblue3/10 bg-themewhite3 text-primary focus:border-themeblue1/30 focus:outline-none transition-all py-1.5 text-sm'

function PillToggle({
  on,
  onLabel = 'YES',
  offLabel = 'NO',
  onChange,
}: {
  on: boolean
  onLabel?: string
  offLabel?: string
  onChange: (val: boolean) => void
}) {
  return (
    <div className="flex gap-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-1 rounded-full text-[10pt] font-medium transition-all active:scale-95 ${
          on
            ? 'bg-themegreen/15 text-themegreen'
            : 'bg-themewhite2 text-tertiary'
        }`}
      >
        {onLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-1 rounded-full text-[10pt] font-medium transition-all active:scale-95 ${
          !on
            ? 'bg-themeredred/15 text-themeredred'
            : 'bg-themewhite2 text-tertiary'
        }`}
      >
        {offLabel}
      </button>
    </div>
  )
}

type EquipStatus = 'FMC' | 'PMC' | 'NMC'

function StatusPill({ status, selected, onSelect }: { status: EquipStatus; selected: boolean; onSelect: () => void }) {
  const selectedCx: Record<EquipStatus, string> = {
    FMC: 'bg-themegreen/15 text-themegreen',
    PMC: 'bg-themeyellow/15 text-themeyellow',
    NMC: 'bg-themeredred/15 text-themeredred',
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-2.5 py-1 rounded-full text-[10pt] font-medium transition-all active:scale-95 ${
        selected ? selectedCx[status] : 'bg-themewhite2 text-tertiary'
      }`}
    >
      {status}
    </button>
  )
}

export function LaceReport() {
  const [report, setReport] = useState<LaceReportType>(emptyLaceReport())
  const [copied, setCopied] = useState(false)

  const update = (patch: Partial<LaceReportType>) => setReport(r => ({ ...r, ...patch }))

  function updateAmmo(index: number, field: 'onHand' | 'pct', value: number) {
    const next = report.ammo.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    update({ ammo: next })
  }

  function addEquipment() {
    const line: LaceEquipmentLine = { item: '', status: 'FMC', notes: '' }
    update({ equipment: [...report.equipment, line] })
  }

  function updateEquipment(index: number, patch: Partial<LaceEquipmentLine>) {
    const next = report.equipment.map((e, i) => (i === index ? { ...e, ...patch } : e))
    update({ equipment: next })
  }

  function removeEquipment(index: number) {
    update({ equipment: report.equipment.filter((_, i) => i !== index) })
  }

  function handleCopy() {
    copyToClipboard(laceToText(report)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handleDownload() {
    downloadAsText(laceToText(report), 'lace-report.txt')
  }

  function handlePrint() {
    printReport('LACE Report', laceToText(report))
  }

  return (
    <div className="space-y-4 px-4 py-4">

      {/* Header — Unit + DTG */}
      <SectionCard>
        <div className={rowCx}>
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-16 shrink-0">Unit</span>
          <input
            type="text"
            value={report.unit}
            onChange={e => update({ unit: e.target.value })}
            placeholder="1-503 IN"
            className={inputInlineCx}
          />
        </div>
        <div className={rowCx}>
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-16 shrink-0">DTG</span>
          <input
            type="text"
            value={report.dtg}
            onChange={e => update({ dtg: e.target.value })}
            placeholder="201400ZAPR25"
            className={inputInlineCx}
          />
        </div>
      </SectionCard>

      {/* L — Liquids */}
      <Section title="L — Liquids" className="mb-0">
        <SectionCard>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Water On Hand</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={report.waterLiters || ''}
                placeholder="0"
                onChange={e => update({ waterLiters: Math.max(0, parseInt(e.target.value) || 0) })}
                className={numberInputCx}
              />
              <span className="text-[10pt] text-tertiary">L</span>
            </div>
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Hours Remaining</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                value={report.waterHours || ''}
                placeholder="0"
                onChange={e => update({ waterHours: Math.max(0, parseInt(e.target.value) || 0) })}
                className={numberInputCx}
              />
              <span className="text-[10pt] text-tertiary">hrs</span>
            </div>
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Resupply Needed</span>
            <PillToggle on={report.waterResupply} onChange={val => update({ waterResupply: val })} />
          </div>
        </SectionCard>
      </Section>

      {/* A — Ammunition */}
      <Section title="A — Ammunition" className="mb-0">
        <SectionCard>
          {DEFAULT_AMMO_TYPES.map((type, i) => (
            <div key={type} className={rowCx}>
              <span className="text-sm text-secondary w-28 shrink-0">{type}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={report.ammo[i]?.onHand || ''}
                  placeholder="0"
                  onChange={e => updateAmmo(i, 'onHand', Math.max(0, parseInt(e.target.value) || 0))}
                  className={numberInputCx}
                />
                <span className="text-[10pt] text-tertiary">rds</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={report.ammo[i]?.pct ?? 100}
                  placeholder="100"
                  onChange={e => updateAmmo(i, 'pct', Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                  className={numberInputCx}
                />
                <span className="text-[10pt] text-tertiary">%</span>
              </div>
            </div>
          ))}
        </SectionCard>
      </Section>

      {/* C — Casualties */}
      <Section title="C — Casualties" className="mb-0">
        <SectionCard>
          <div className={rowCx}>
            <span className="text-sm text-secondary">KIA</span>
            <input
              type="number"
              min={0}
              value={report.kia || ''}
              placeholder="0"
              onChange={e => update({ kia: Math.max(0, parseInt(e.target.value) || 0) })}
              className={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Urgent</span>
            <input
              type="number"
              min={0}
              value={report.wiaUrgent || ''}
              placeholder="0"
              onChange={e => update({ wiaUrgent: Math.max(0, parseInt(e.target.value) || 0) })}
              className={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Priority</span>
            <input
              type="number"
              min={0}
              value={report.wiaPriority || ''}
              placeholder="0"
              onChange={e => update({ wiaPriority: Math.max(0, parseInt(e.target.value) || 0) })}
              className={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Routine</span>
            <input
              type="number"
              min={0}
              value={report.wiaRoutine || ''}
              placeholder="0"
              onChange={e => update({ wiaRoutine: Math.max(0, parseInt(e.target.value) || 0) })}
              className={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Medevac Requested</span>
            <PillToggle on={report.medevacRequested} onChange={val => update({ medevacRequested: val })} />
          </div>
        </SectionCard>
      </Section>

      {/* E — Equipment */}
      <Section title="E — Equipment" className="mb-0">
        <SectionCard>
          {report.equipment.length === 0 && (
            <div className="px-4 py-3 text-[10pt] text-tertiary">No equipment added</div>
          )}
          {report.equipment.map((eq, i) => (
            <div key={i} className="border-b border-primary/6 last:border-0 px-4 py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={eq.item}
                  onChange={e => updateEquipment(i, { item: e.target.value })}
                  placeholder="Item name"
                  className="flex-1 bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
                />
                <div className="flex gap-1">
                  {(['FMC', 'PMC', 'NMC'] as EquipStatus[]).map(s => (
                    <StatusPill
                      key={s}
                      status={s}
                      selected={eq.status === s}
                      onSelect={() => updateEquipment(i, { status: s })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => removeEquipment(i)}
                  className="w-6 h-6 flex items-center justify-center text-tertiary hover:text-themeredred active:scale-95 transition-all shrink-0"
                >
                  <X size={13} />
                </button>
              </div>
              <input
                type="text"
                value={eq.notes ?? ''}
                onChange={e => updateEquipment(i, { notes: e.target.value })}
                placeholder="Notes (optional)"
                className="w-full bg-transparent text-[10pt] text-tertiary placeholder:text-tertiary focus:outline-none pl-0"
              />
            </div>
          ))}
        </SectionCard>
        <button
          type="button"
          onClick={addEquipment}
          className="flex items-center gap-1.5 text-[10pt] text-themeblue2/60 px-1 mt-2 active:scale-95 transition-all hover:text-themeblue2"
        >
          <Plus size={12} /> Add item
        </button>
      </Section>

      {/* Notes + export */}
      <Section title="Notes" className="mb-0">
        <SectionCard>
          <div className="px-4 py-3">
            <textarea
              value={report.notes ?? ''}
              onChange={e => update({ notes: e.target.value })}
              placeholder="Additional notes…"
              rows={3}
              className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
            />
          </div>
          <div className="border-t border-primary/6 flex items-center justify-end px-3 py-2">
            <ActionPill>
              <ActionButton icon={copied ? Check : Copy} label="Copy" onClick={handleCopy} variant={copied ? 'success' : 'default'} />
              <ActionButton icon={Download} label="Download" onClick={handleDownload} />
              <ActionButton icon={Printer} label="Print" onClick={handlePrint} />
            </ActionPill>
          </div>
        </SectionCard>
      </Section>

      <div className="pb-6" />

    </div>
  )
}
