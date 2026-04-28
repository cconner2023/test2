import { credentials } from '../../Data/User'
import { ToggleSwitch } from '../Settings/ToggleSwitch'
import { DatePickerInput } from '../FormInputs'
import type { CertFormData } from './certHelpers'

interface CertOverlayFieldsProps {
  form: CertFormData
  setForm: (updater: (prev: CertFormData) => CertFormData) => void
  isMobile: boolean
  /** When provided, attaches a `<datalist>` of credential titles with this id. */
  datalistId?: string
}

/**
 * Overlay-style cert form fields — used inside PreviewOverlay popovers in the
 * personal ProfilePage and the supervisor SoldierProfile. Renders the
 * canonical 5-row stack (title, cert #, issued, expires, primary toggle).
 *
 * For the standalone bg-tertiary/5 card layout used elsewhere, use
 * `CertificationForm` instead.
 */
export function CertOverlayFields({ form, setForm, isMobile, datalistId }: CertOverlayFieldsProps) {
  const rowCx = `flex items-center justify-between border-b border-primary/6 last:border-0 ${
    isMobile ? 'px-4 py-3' : 'px-3 py-2.5'
  }`
  const inputCx = `flex-1 bg-transparent text-primary placeholder:text-tertiary focus:outline-none ${
    isMobile ? 'text-sm' : 'text-[10pt]'
  }`
  const labelCx = `text-secondary ${isMobile ? 'text-sm' : 'text-[10pt]'}`

  return (
    <div>
      <div className={rowCx}>
        <input
          type="text"
          list={datalistId}
          value={form.title}
          onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Certification title *"
          className={inputCx}
        />
      </div>
      <div className={rowCx}>
        <input
          type="text"
          value={form.cert_number}
          onChange={(e) => setForm(f => ({ ...f, cert_number: e.target.value }))}
          placeholder="Cert #"
          className={inputCx}
        />
      </div>
      <div className={rowCx}>
        <span className={labelCx}>Issued</span>
        <div className="w-40">
          <DatePickerInput
            value={form.issue_date}
            onChange={(v) => setForm(f => ({ ...f, issue_date: v }))}
            placeholder="Select date"
          />
        </div>
      </div>
      <div className={rowCx}>
        <span className={labelCx}>Expires</span>
        <div className="w-40">
          <DatePickerInput
            value={form.exp_date}
            onChange={(v) => setForm(f => ({ ...f, exp_date: v }))}
            placeholder="Select date"
          />
        </div>
      </div>
      <label
        className={`${rowCx} cursor-pointer`}
        onClick={() => setForm(f => ({ ...f, is_primary: !f.is_primary }))}
      >
        <span className={labelCx}>Primary</span>
        <ToggleSwitch checked={form.is_primary} />
      </label>

      {datalistId && (
        <datalist id={datalistId}>
          {credentials.map(c => <option key={c} value={c} />)}
        </datalist>
      )}
    </div>
  )
}
