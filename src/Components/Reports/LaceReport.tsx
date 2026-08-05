// src/Components/Reports/LaceReport.tsx
import { useState } from 'react'
import { Copy, Download, Printer, Plus, X } from 'lucide-react'
import { ActionButton } from '@/Components/primitives/ActionButton'
import { Section, SectionCard } from '@/Components/primitives/Section'
import { emptyLaceReport, DEFAULT_AMMO_TYPES } from '../../Types/ReportTypes'
import type { LaceReport as LaceReportType, LaceEquipmentLine } from '../../Types/ReportTypes'
import { laceToText, copyToClipboard, downloadAsText, printReport } from '../../lib/reportExport'
import { ActionPill } from '@/Components/primitives/ActionPill'
import { TextInput, TextArea } from '@/Components/primitives/FormInputs'

const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'

const inputInlineCx =
  'flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm'

const numberInputCx =
  'w-14 text-center rounded-md border border-themeblue3/10 bg-transparent text-primary focus:border-themeblue1/30 focus:outline-none transition-all py-1.5 text-sm'

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
    void copyToClipboard(laceToText(report), 'LACE report copied')
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
          <TextInput
            bare
            value={report.unit}
            onChange={val => update({ unit: val })}
            placeholder="1-503 IN"
            inputClassName={inputInlineCx}
          />
        </div>
        <div className={rowCx}>
          <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-16 shrink-0">DTG</span>
          <TextInput
            bare
            value={report.dtg}
            onChange={val => update({ dtg: val })}
            placeholder="201400ZAPR25"
            inputClassName={inputInlineCx}
          />
        </div>
      </SectionCard>

      {/* L — Liquids */}
      <Section title="L — Liquids" className="mb-0">
        <SectionCard>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Water On Hand</span>
            <div className="flex items-center gap-2">
              <TextInput
                bare
                inputMode="numeric"
                value={report.waterLiters ? String(report.waterLiters) : ''}
                placeholder="0"
                onChange={val => update({ waterLiters: Math.max(0, parseInt(val) || 0) })}
                inputClassName={numberInputCx}
              />
              <span className="text-[10pt] text-tertiary">L</span>
            </div>
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">Hours Remaining</span>
            <div className="flex items-center gap-2">
              <TextInput
                bare
                inputMode="numeric"
                value={report.waterHours ? String(report.waterHours) : ''}
                placeholder="0"
                onChange={val => update({ waterHours: Math.max(0, parseInt(val) || 0) })}
                inputClassName={numberInputCx}
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
                <TextInput
                  bare
                  inputMode="numeric"
                  value={report.ammo[i]?.onHand ? String(report.ammo[i]?.onHand) : ''}
                  placeholder="0"
                  onChange={val => updateAmmo(i, 'onHand', Math.max(0, parseInt(val) || 0))}
                  inputClassName={numberInputCx}
                />
                <span className="text-[10pt] text-tertiary">rds</span>
                <TextInput
                  bare
                  inputMode="numeric"
                  value={String(report.ammo[i]?.pct ?? 100)}
                  placeholder="100"
                  onChange={val => updateAmmo(i, 'pct', Math.min(100, Math.max(0, parseInt(val) || 0)))}
                  inputClassName={numberInputCx}
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
            <TextInput
              bare
              inputMode="numeric"
              value={report.kia ? String(report.kia) : ''}
              placeholder="0"
              onChange={val => update({ kia: Math.max(0, parseInt(val) || 0) })}
              inputClassName={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Urgent</span>
            <TextInput
              bare
              inputMode="numeric"
              value={report.wiaUrgent ? String(report.wiaUrgent) : ''}
              placeholder="0"
              onChange={val => update({ wiaUrgent: Math.max(0, parseInt(val) || 0) })}
              inputClassName={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Priority</span>
            <TextInput
              bare
              inputMode="numeric"
              value={report.wiaPriority ? String(report.wiaPriority) : ''}
              placeholder="0"
              onChange={val => update({ wiaPriority: Math.max(0, parseInt(val) || 0) })}
              inputClassName={numberInputCx}
            />
          </div>
          <div className={rowCx}>
            <span className="text-sm text-secondary">WIA Routine</span>
            <TextInput
              bare
              inputMode="numeric"
              value={report.wiaRoutine ? String(report.wiaRoutine) : ''}
              placeholder="0"
              onChange={val => update({ wiaRoutine: Math.max(0, parseInt(val) || 0) })}
              inputClassName={numberInputCx}
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
                <TextInput
                  bare
                  value={eq.item}
                  onChange={val => updateEquipment(i, { item: val })}
                  placeholder="Item name"
                  inputClassName="flex-1 bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
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
              <TextInput
                bare
                value={eq.notes ?? ''}
                onChange={val => updateEquipment(i, { notes: val })}
                placeholder="Notes (optional)"
                inputClassName="w-full bg-transparent text-[10pt] text-tertiary placeholder:text-tertiary focus:outline-none pl-0"
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
          <TextArea
            value={report.notes ?? ''}
            onChange={v => update({ notes: v })}
            placeholder="Additional notes…"
            rows={3}
          />
          <div className="flex items-center justify-end px-3 py-2">
            <ActionPill>
              <ActionButton icon={Copy} label="Copy" onClick={handleCopy} />
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
