import { useState } from 'react'
import { Copy, Check, Download, Printer } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { Section, SectionCard } from '../Section'
import type { Sitrep } from '../../Types/ReportTypes'
import { emptySitrep } from '../../Types/ReportTypes'
import { sitrepToText, copyToClipboard, downloadAsText, printReport } from '../../lib/reportExport'

const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'

function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={rowCx}>
      <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">{label}</span>
      {children}
    </div>
  )
}

export function SitrepReport() {
  const [report, setReport] = useState<Sitrep>(emptySitrep())
  const [copied, setCopied] = useState(false)

  const update = (patch: Partial<Sitrep>) => setReport(r => ({ ...r, ...patch }))

  const onCopy = async () => {
    await copyToClipboard(sitrepToText(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDownload = () => downloadAsText(sitrepToText(report), 'sitrep.txt')
  const onPrint = () => printReport('SITREP', sitrepToText(report))

  const ENEMY_TYPES: { label: string; value: Sitrep['enemyType'] }[] = [
    { label: 'Small Arms', value: 'small-arms' },
    { label: 'Indirect',   value: 'indirect' },
    { label: 'IED',        value: 'ied' },
    { label: 'Other',      value: 'other' },
  ]

  const DIRECTIONS: Sitrep['enemyDirection'][] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      {/* Header — no Section title */}
      <SectionCard>
        <InlineRow label="Unit / Callsign">
          <input
            type="text"
            value={report.unit}
            onChange={e => update({ unit: e.target.value })}
            placeholder="Unit or callsign"
            className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
          />
        </InlineRow>
        <InlineRow label="DTG">
          <input
            type="text"
            value={report.dtg}
            onChange={e => update({ dtg: e.target.value })}
            placeholder="DDHHMMZMmmYY"
            className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
          />
        </InlineRow>
        <InlineRow label="MGRS">
          <input
            type="text"
            value={report.mgrs}
            onChange={e => update({ mgrs: e.target.value.toUpperCase() })}
            placeholder="MGRS"
            className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm font-mono"
          />
        </InlineRow>
      </SectionCard>

      {/* Situation */}
      <Section title="Situation" className="mb-0">
        <SectionCard>
          <div className="px-4 py-3">
            <textarea
              value={report.situation}
              onChange={e => update({ situation: e.target.value })}
              placeholder="Current situation..."
              rows={4}
              className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
            />
          </div>
        </SectionCard>
      </Section>

      {/* Enemy Activity */}
      <Section title="Enemy Activity" className="mb-0">
        <SectionCard>
          {/* Contact toggle */}
          <div className={rowCx}>
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Contact</span>
            <div className="flex gap-1">
              {(['Yes', 'No'] as const).map(opt => (
                <button
                  key={opt}
                  onClick={() => update({ enemyContact: opt === 'Yes' })}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                    report.enemyContact === (opt === 'Yes')
                      ? 'bg-themeblue2/15 text-themeblue2'
                      : 'bg-themewhite2 text-tertiary'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {report.enemyContact && (
            <>
              {/* Type */}
              <div className={rowCx}>
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Type</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {ENEMY_TYPES.map(({ label, value }) => (
                    <button
                      key={value}
                      onClick={() => update({ enemyType: value })}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                        report.enemyType === value
                          ? 'bg-themeblue2/15 text-themeblue2'
                          : 'bg-themewhite2 text-tertiary'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction */}
              <div className={rowCx}>
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Direction</span>
                <div className="grid grid-cols-4 gap-1">
                  {DIRECTIONS.map(dir => (
                    <button
                      key={dir}
                      onClick={() => update({ enemyDirection: dir })}
                      className={`px-2 py-1 rounded-full text-xs font-medium transition-all active:scale-95 text-center ${
                        report.enemyDirection === dir
                          ? 'bg-themeblue2/15 text-themeblue2'
                          : 'bg-themewhite2 text-tertiary'
                      }`}
                    >
                      {dir}
                    </button>
                  ))}
                </div>
              </div>

              {/* Distance */}
              <div className={rowCx}>
                <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Distance (m)</span>
                <input
                  type="number"
                  value={report.enemyDistanceM ?? ''}
                  onChange={e => update({ enemyDistanceM: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="0"
                  min={0}
                  className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
                />
              </div>

              {/* Actions Taken */}
              <div className="px-4 py-3">
                <textarea
                  value={report.actionsTaken ?? ''}
                  onChange={e => update({ actionsTaken: e.target.value })}
                  placeholder="Actions taken..."
                  rows={2}
                  className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
                />
              </div>
            </>
          )}
        </SectionCard>
      </Section>

      {/* Friendly Forces */}
      <Section title="Friendly Forces" className="mb-0">
        <SectionCard>
          {/* Strength */}
          <div className={rowCx}>
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Strength</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={report.strengthPct}
                onChange={e => update({ strengthPct: Math.min(100, Math.max(0, Number(e.target.value))) })}
                min={0}
                max={100}
                className="w-14 text-right bg-transparent text-primary focus:outline-none text-sm"
              />
              <span className="text-sm text-secondary">%</span>
            </div>
          </div>

          {/* Morale */}
          <div className={rowCx}>
            <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">Morale</span>
            <div className="flex gap-1">
              <button
                onClick={() => update({ morale: 'good' })}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  report.morale === 'good'
                    ? 'bg-themegreen/15 text-themegreen'
                    : 'bg-themewhite2 text-tertiary'
                }`}
              >
                Good
              </button>
              <button
                onClick={() => update({ morale: 'fair' })}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  report.morale === 'fair'
                    ? 'bg-themeyellow/15 text-themeyellow'
                    : 'bg-themewhite2 text-tertiary'
                }`}
              >
                Fair
              </button>
              <button
                onClick={() => update({ morale: 'poor' })}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all active:scale-95 ${
                  report.morale === 'poor'
                    ? 'bg-themeredred/15 text-themeredred'
                    : 'bg-themewhite2 text-tertiary'
                }`}
              >
                Poor
              </button>
            </div>
          </div>
        </SectionCard>
      </Section>

      {/* Assessment */}
      <Section title="Assessment" className="mb-0">
        <SectionCard>
          <div className="px-4 py-3">
            <textarea
              value={report.assessment}
              onChange={e => update({ assessment: e.target.value })}
              placeholder="Commander's assessment..."
              rows={3}
              className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
            />
          </div>
        </SectionCard>
      </Section>

      {/* Next Action */}
      <Section title="Next Action" className="mb-0">
        <SectionCard>
          <div className="px-4 py-3 border-b border-primary/6">
            <textarea
              value={report.nextAction}
              onChange={e => update({ nextAction: e.target.value })}
              placeholder="Planned next action..."
              rows={2}
              className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
            />
          </div>
          <InlineRow label="ETA">
            <input
              type="time"
              value={report.eta ?? ''}
              onChange={e => update({ eta: e.target.value })}
              className="flex-1 text-right bg-transparent text-primary focus:outline-none text-sm"
            />
          </InlineRow>
        </SectionCard>
      </Section>

      {/* Notes + export */}
      <Section title="Notes" className="mb-0">
        <SectionCard>
          <div className="px-4 py-3">
            <textarea
              value={report.notes ?? ''}
              onChange={e => update({ notes: e.target.value })}
              placeholder="Additional notes..."
              rows={2}
              className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
            />
          </div>
          <div className="border-t border-primary/6 flex items-center justify-end px-3 py-2">
            <div className="flex items-center gap-1 px-1.5 py-1.5 rounded-2xl bg-themewhite shadow-lg border border-tertiary/15">
              <ActionButton icon={copied ? Check : Copy} label="Copy" onClick={onCopy} variant={copied ? 'success' : 'default'} />
              <ActionButton icon={Download} label="Download" onClick={onDownload} />
              <ActionButton icon={Printer} label="Print" onClick={onPrint} />
            </div>
          </div>
        </SectionCard>
      </Section>

      <div className="pb-6" />

    </div>
  )
}
