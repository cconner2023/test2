import { useState } from 'react'
import { Copy, Check, Download, Printer, Plus, X } from 'lucide-react'
import { ActionButton } from '../ActionButton'
import { Section, SectionCard } from '../Section'
import type { Opord, OpordTask } from '../../Types/ReportTypes'
import { emptyOpord } from '../../Types/ReportTypes'
import { opordToText, copyToClipboard, downloadAsText, printReport } from '../../lib/reportExport'

const rowCx = 'flex items-center justify-between border-b border-primary/6 last:border-0 px-4 py-3'

function InlineRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={rowCx}>
      <span className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest w-24 shrink-0">{label}</span>
      {children}
    </div>
  )
}

interface LabeledTextareaProps {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  last?: boolean
}

function LabeledTextarea({ label, value, onChange, placeholder = '', rows = 2, last = false }: LabeledTextareaProps) {
  return (
    <div className={`px-4 py-3 ${last ? '' : 'border-b border-primary/6'}`}>
      <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest mb-1.5">{label}</p>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
      />
    </div>
  )
}

export function OpordReport() {
  const [report, setReport] = useState<Opord>(emptyOpord())
  const [copied, setCopied] = useState(false)

  const update = (patch: Partial<Opord>) => setReport(r => ({ ...r, ...patch }))

  const addTask = () =>
    update({ subordinateTasks: [...report.subordinateTasks, { unit: '', task: '' }] })

  const updateTask = (index: number, patch: Partial<OpordTask>) =>
    update({
      subordinateTasks: report.subordinateTasks.map((t, i) =>
        i === index ? { ...t, ...patch } : t
      ),
    })

  const removeTask = (index: number) =>
    update({ subordinateTasks: report.subordinateTasks.filter((_, i) => i !== index) })

  const onCopy = async () => {
    await copyToClipboard(opordToText(report))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const onDownload = () => downloadAsText(opordToText(report), 'opord.txt')
  const onPrint = () => printReport('OPORD', opordToText(report))

  return (
    <div className="flex flex-col gap-4 px-4 py-4">

      {/* Header — no Section wrapper */}
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
        <InlineRow label="Op Name">
          <input
            type="text"
            value={report.operationName ?? ''}
            onChange={e => update({ operationName: e.target.value })}
            placeholder="Operation name"
            className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
          />
        </InlineRow>
      </SectionCard>

      {/* 1. Situation */}
      <Section title="1. Situation" className="mb-0">
        <SectionCard>
          <LabeledTextarea
            label="Enemy Composition"
            value={report.enemyComposition}
            onChange={v => update({ enemyComposition: v })}
            placeholder="Strength, disposition, capabilities..."
            rows={2}
          />
          <LabeledTextarea
            label="Enemy Recent Activity"
            value={report.enemyActivity}
            onChange={v => update({ enemyActivity: v })}
            placeholder="Known movements, attacks, patterns..."
            rows={2}
          />
          <LabeledTextarea
            label="Higher Friendly"
            value={report.friendlyHigher}
            onChange={v => update({ friendlyHigher: v })}
            placeholder="Higher HQ mission and intent..."
            rows={2}
          />
          <LabeledTextarea
            label="Adjacent Friendly"
            value={report.friendlyAdjacent}
            onChange={v => update({ friendlyAdjacent: v })}
            placeholder="Flanking or adjacent units..."
            rows={2}
          />
          <LabeledTextarea
            label="Attachments / Detachments"
            value={report.attachments}
            onChange={v => update({ attachments: v })}
            placeholder="Units attached or detached..."
            rows={1}
          />
          <LabeledTextarea
            label="Civil Considerations"
            value={report.civilConsiderations}
            onChange={v => update({ civilConsiderations: v })}
            placeholder="Population, infrastructure, cultural factors..."
            rows={2}
            last
          />
        </SectionCard>
      </Section>

      {/* 2. Mission */}
      <Section title="2. Mission" className="mb-0">
        <SectionCard>
          <InlineRow label="WHO">
            <input
              type="text"
              value={report.missionWho}
              onChange={e => update({ missionWho: e.target.value })}
              placeholder="Who conducts the mission"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="WHAT">
            <input
              type="text"
              value={report.missionWhat}
              onChange={e => update({ missionWhat: e.target.value })}
              placeholder="Task to be accomplished"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="WHEN">
            <input
              type="text"
              value={report.missionWhen}
              onChange={e => update({ missionWhen: e.target.value })}
              placeholder="DTG or time window"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="WHERE">
            <input
              type="text"
              value={report.missionWhere}
              onChange={e => update({ missionWhere: e.target.value.toUpperCase() })}
              placeholder="MGRS"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm font-mono"
            />
          </InlineRow>
          <InlineRow label="WHY">
            <input
              type="text"
              value={report.missionWhy}
              onChange={e => update({ missionWhy: e.target.value })}
              placeholder="Purpose of the mission"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
        </SectionCard>
      </Section>

      {/* 3. Execution */}
      <Section title="3. Execution" className="mb-0">
        <SectionCard>
          <LabeledTextarea
            label="Commander's Intent"
            value={report.commanderIntent}
            onChange={v => update({ commanderIntent: v })}
            placeholder="End state, purpose, key tasks..."
            rows={3}
          />
          <LabeledTextarea
            label="Concept of Operations"
            value={report.conceptOfOps}
            onChange={v => update({ conceptOfOps: v })}
            placeholder="How the operation will unfold..."
            rows={3}
          />

          {/* Subordinate Tasks */}
          <p className="text-[9pt] font-semibold text-tertiary uppercase tracking-widest px-4 pt-3 pb-1">
            Tasks to Subordinate Units
          </p>

          {report.subordinateTasks.map((task, i) => (
            <div
              key={i}
              className="flex gap-2 px-4 py-2 border-b border-primary/6 items-center"
            >
              <input
                type="text"
                value={task.unit}
                onChange={e => updateTask(i, { unit: e.target.value })}
                placeholder="Unit"
                className="w-20 shrink-0 bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none border-b border-primary/10"
              />
              <input
                type="text"
                value={task.task}
                onChange={e => updateTask(i, { task: e.target.value })}
                placeholder="Assigned task"
                className="flex-1 bg-transparent text-sm text-primary placeholder:text-tertiary focus:outline-none"
              />
              <button
                onClick={() => removeTask(i)}
                className="text-tertiary hover:text-themeredred transition-colors active:scale-95 shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}

          <button
            onClick={addTask}
            className="flex items-center gap-1 text-xs text-themeblue2 px-4 py-2.5 active:scale-95 transition-all"
          >
            <Plus size={12} /> Add Task
          </button>

          <LabeledTextarea
            label="Coordinating Instructions"
            value={report.coordinatingInstructions}
            onChange={v => update({ coordinatingInstructions: v })}
            placeholder="ROE, movement times, checkpoints, fire support coordination..."
            rows={2}
            last
          />
        </SectionCard>
      </Section>

      {/* 4. Admin / Log */}
      <Section title="4. Admin / Log" className="mb-0">
        <SectionCard>
          <LabeledTextarea
            label="Class I — Food / Water"
            value={report.supplyClass1}
            onChange={v => update({ supplyClass1: v })}
            placeholder="Rations, water resupply..."
            rows={1}
          />
          <LabeledTextarea
            label="Class III — Fuel"
            value={report.supplyClass3}
            onChange={v => update({ supplyClass3: v })}
            placeholder="POL status, resupply plan..."
            rows={1}
          />
          <LabeledTextarea
            label="Class V — Ammunition"
            value={report.supplyClass5}
            onChange={v => update({ supplyClass5: v })}
            placeholder="Basic load, resupply points..."
            rows={1}
          />
          <LabeledTextarea
            label="Class VIII — Medical"
            value={report.supplyClass8}
            onChange={v => update({ supplyClass8: v })}
            placeholder="Medical supplies, blood, drugs..."
            rows={1}
          />
          <LabeledTextarea
            label="Transportation"
            value={report.transportation}
            onChange={v => update({ transportation: v })}
            placeholder="Vehicle plan, routes..."
            rows={1}
          />
          <LabeledTextarea
            label="CCP Location"
            value={report.medicalCCP}
            onChange={v => update({ medicalCCP: v })}
            placeholder="Casualty collection point MGRS..."
            rows={1}
          />
          <LabeledTextarea
            label="Medevac Channel"
            value={report.medevacChannel}
            onChange={v => update({ medevacChannel: v })}
            placeholder="Freq / call sign..."
            rows={1}
            last
          />
        </SectionCard>
      </Section>

      {/* 5. Command & Signal */}
      <Section title="5. Command & Signal" className="mb-0">
        <SectionCard>
          <InlineRow label="CO Location">
            <input
              type="text"
              value={report.commandLocation}
              onChange={e => update({ commandLocation: e.target.value })}
              placeholder="Commander's location"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="Succession">
            <input
              type="text"
              value={report.successionOfCommand}
              onChange={e => update({ successionOfCommand: e.target.value })}
              placeholder="1st, 2nd, 3rd..."
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="Primary Freq">
            <input
              type="text"
              value={report.freqPrimary}
              onChange={e => update({ freqPrimary: e.target.value })}
              placeholder="MHz"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="Alt Freq">
            <input
              type="text"
              value={report.freqAlternate}
              onChange={e => update({ freqAlternate: e.target.value })}
              placeholder="MHz"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="Call Signs">
            <input
              type="text"
              value={report.callSigns}
              onChange={e => update({ callSigns: e.target.value })}
              placeholder="Call sign list"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <InlineRow label="Challenge / PW">
            <input
              type="text"
              value={report.challengePassword}
              onChange={e => update({ challengePassword: e.target.value })}
              placeholder="Challenge / password"
              className="flex-1 text-right bg-transparent text-primary placeholder:text-tertiary focus:outline-none text-sm"
            />
          </InlineRow>
          <LabeledTextarea
            label="PACE Plan"
            value={report.pacePlan}
            onChange={v => update({ pacePlan: v })}
            placeholder="Primary, Alternate, Contingency, Emergency comms..."
            rows={2}
            last
          />
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
