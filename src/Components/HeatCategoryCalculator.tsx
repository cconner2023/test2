import { useState } from 'react'
import { Thermometer } from 'lucide-react'
import { ToggleSwitch } from './Settings/ToggleSwitch'
import { TextInput } from './FormInputs'
import { CATEGORIES, CATEGORY_BG, estimateWBGT, getCategory } from '../lib/wbgtUtils'

export function HeatCategoryCalculator() {
  const [estimated, setEstimated] = useState(false)
  const [wbgtInput, setWbgtInput] = useState('')
  const [tempInput, setTempInput] = useState('')
  const [rhInput, setRhInput] = useState('')

  const wbgtNum: number | null = (() => {
    if (!estimated) {
      const n = parseFloat(wbgtInput)
      return isNaN(n) ? null : n
    }
    const T = parseFloat(tempInput)
    const RH = parseFloat(rhInput)
    if (isNaN(T) || isNaN(RH)) return null
    return estimateWBGT(T, RH)
  })()

  const category = wbgtNum !== null ? getCategory(wbgtNum) : null

  return (
    <div className="px-4 py-4 space-y-4">

      {/* Mode toggle */}
      <div
        className="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-themewhite2 cursor-pointer"
        onClick={() => setEstimated(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEstimated(v => !v) } }}
      >
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${estimated ? 'bg-themeblue2/15' : 'bg-tertiary/10'}`}>
          <Thermometer size={18} className={estimated ? 'text-themeblue2' : 'text-tertiary'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${estimated ? 'text-primary' : 'text-tertiary'}`}>
            Estimate from Temp & Humidity
          </p>
          <p className="text-[9pt] text-tertiary mt-0.5">No WBGT device — sunny outdoor</p>
        </div>
        <ToggleSwitch checked={estimated} />
      </div>

      {/* Input fields */}
      {!estimated ? (
        <TextInput
          label="WBGT (°F)"
          value={wbgtInput}
          onChange={setWbgtInput}
          placeholder="e.g. 86.5"
          inputMode="decimal"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <TextInput
            label="Temp (°F)"
            value={tempInput}
            onChange={setTempInput}
            placeholder="e.g. 95"
            inputMode="decimal"
          />
          <TextInput
            label="Humidity (%)"
            value={rhInput}
            onChange={setRhInput}
            placeholder="e.g. 70"
            inputMode="numeric"
          />
        </div>
      )}

      {/* Estimated WBGT echo */}
      {estimated && wbgtNum !== null && (
        <p className="text-[9pt] text-center text-tertiary">
          Est. WBGT — <span className="font-semibold text-primary">{wbgtNum}°F</span>
        </p>
      )}

      {/* Out-of-range note */}
      {wbgtNum !== null && !category && (
        <p className="text-[9pt] text-tertiary text-center">
          {wbgtNum < 78 ? `WBGT ${wbgtNum}°F — below Cat 1, no restrictions` : `WBGT ${wbgtNum}°F — above scale`}
        </p>
      )}

      {/* Reference table */}
      <div className="rounded-xl border border-tertiary/8 overflow-hidden">
        <div
          className="grid text-[9pt] font-medium text-tertiary uppercase tracking-wide bg-tertiary/4"
          style={{ gridTemplateColumns: '3fr 4fr 3fr 2fr' }}
        >
          <div className="py-1.5 px-3">Flag</div>
          <div className="py-1.5 px-3 border-l border-tertiary/8">WBGT</div>
          <div className="py-1.5 px-3 border-l border-tertiary/8">Work/Rest</div>
          <div className="py-1.5 px-3 border-l border-tertiary/8">H₂O</div>
        </div>
        {CATEGORIES.map((c, i) => (
          <div
            key={c.num}
            className={`grid text-[9pt] ${i > 0 ? 'border-t border-tertiary/8' : ''} ${category?.num === c.num ? CATEGORY_BG[c.flag] : ''}`}
            style={{ gridTemplateColumns: '3fr 4fr 3fr 2fr' }}
          >
            <div className="py-2 px-3 font-semibold text-primary">{c.flag}</div>
            <div className="py-2 px-3 border-l border-tertiary/8 text-secondary">
              {c.max === Infinity ? `≥${c.min}` : `${c.min}–${c.max}`}°F
            </div>
            <div className="py-2 px-3 border-l border-tertiary/8 text-secondary">
              {c.workRest.replace(/ min/g, '')}
            </div>
            <div className="py-2 px-3 border-l border-tertiary/8 text-secondary">{c.water}</div>
          </div>
        ))}
      </div>

      <p className="text-[8pt] text-tertiary leading-relaxed px-1">
        Unacclimatized or poor physical condition: add one category. Heavy work intensity: add one category.
        Source: TB MED 507.{estimated ? ' WBGT estimate: wet-bulb via Stull (2011), globe temp = air temp + 15°F (sunny outdoor, calm wind).' : ''}
      </p>
    </div>
  )
}
