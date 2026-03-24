/**
 * AdminClinicForm.tsx
 *
 * Unified create/edit form for clinics. When `clinic` is null the form
 * operates in create mode; when a clinic is provided it pre-populates
 * the fields for editing. Used inside AdminDrawer's clinic management flow.
 */

import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { TextInput, UicPinInput } from '../FormInputs'
import { ErrorDisplay } from '../ErrorDisplay'
import { ChipInput, UserPicker, ClinicPicker } from './AdminPickers'
import { createClinic, updateClinic, listAllUsers, listClinics } from '../../lib/adminService'
import type { AdminUser, AdminClinic } from '../../lib/adminService'

interface AdminClinicFormProps {
  clinic: AdminClinic | null
  onBack: () => void
  onSaved: () => void
}

const AdminClinicForm = ({ clinic, onBack, onSaved }: AdminClinicFormProps) => {
  const isEditMode = clinic !== null

  // ─── Picker data ────────────────────────────────────────────────────
  const [allUsers, setAllUsers] = useState<AdminUser[]>([])
  const [allClinics, setAllClinics] = useState<AdminClinic[]>([])

  const loadPickerData = useCallback(async () => {
    const [fetchedUsers, fetchedClinics] = await Promise.all([listAllUsers(), listClinics()])
    setAllUsers(fetchedUsers)
    setAllClinics(fetchedClinics)
  }, [])

  useEffect(() => {
    loadPickerData()
  }, [loadPickerData])

  // ─── Form fields ────────────────────────────────────────────────────
  const [name, setName] = useState(clinic?.name ?? '')
  const [location, setLocation] = useState(clinic?.location ?? '')
  const [uics, setUics] = useState<string[]>(clinic?.uics ?? [])
  const [childClinicIds, setChildClinicIds] = useState<string[]>(clinic?.child_clinic_ids ?? [])
  const [associatedClinicIds, setAssociatedClinicIds] = useState<string[]>(clinic?.associated_clinic_ids ?? [])
  const [additionalUserIds, setAdditionalUserIds] = useState<string[]>(clinic?.additional_user_ids ?? [])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uicDraft, setUicDraft] = useState('')
  const [uicError, setUicError] = useState<string | null>(null)

  const handleAddUic = useCallback(() => {
    if (uicDraft.length !== 6) return
    const upper = uicDraft.toUpperCase()
    if (uics.includes(upper)) {
      setUicError('This UIC is already added')
      return
    }
    const owner = allClinics.find(c => c.id !== clinic?.id && c.uics.includes(upper))
    if (owner) {
      setUicError(`UIC ${upper} is already assigned to ${owner.name}`)
      return
    }
    setUics(prev => [...prev, upper])
    setUicDraft('')
    setUicError(null)
  }, [uicDraft, uics, allClinics, clinic?.id])

  /** Shared validation and submit handler for both modes. */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Clinic name is required')
      return
    }

    setSubmitting(true)

    const payload = {
      name: name.trim(),
      uics,
      child_clinic_ids: childClinicIds,
      associated_clinic_ids: associatedClinicIds,
      additional_user_ids: additionalUserIds,
    }

    const result = isEditMode
      ? await updateClinic(clinic.id, { ...payload, location: location.trim() || null })
      : await createClinic({ ...payload, location: location.trim() || undefined })

    setSubmitting(false)

    if (result.success) {
      onSaved()
    } else {
      setError(result.error || `Failed to ${isEditMode ? 'update' : 'create'} clinic`)
    }
  }, [
    name, location, uics, childClinicIds, associatedClinicIds, additionalUserIds,
    isEditMode, clinic, onSaved,
  ])

  const submitLabel = isEditMode
    ? (submitting ? 'Saving...' : 'Save Changes')
    : (submitting ? 'Creating Clinic...' : 'Create Clinic')

  const submitColor = isEditMode
    ? 'bg-themeblue3 hover:bg-themeblue3/90'
    : 'bg-themegreen hover:bg-themegreen/90'

  // ─── Shared field set ───────────────────────────────────────────────
  const formFields = (
    <>
      <TextInput label="Clinic Name" value={name} onChange={setName} placeholder="e.g. TMC Alpha" required />
      <TextInput label="Location" value={location} onChange={setLocation} placeholder="e.g. Building 123, Fort Example" />
      <div>
        <span className="text-xs font-medium text-tertiary/60 uppercase tracking-wide">UICs</span>
        {uics.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5 mb-2">
            {uics.map((val, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-themeblue2/10 text-themeblue2 text-xs font-medium border border-themeblue2/30">
                {val}
                <button type="button" onClick={() => setUics(prev => prev.filter((_, i) => i !== idx))} className="hover:text-themeredred transition-colors">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <UicPinInput value={uicDraft} onChange={(v) => { setUicDraft(v); setUicError(null) }} spread />
          </div>
          <button
            type="button"
            onClick={handleAddUic}
            disabled={uicDraft.length !== 6}
            className="px-3 h-10 rounded-lg bg-themeblue3 text-white text-sm font-medium hover:bg-themeblue3/90 disabled:opacity-50 transition-colors shrink-0"
          >
            Add
          </button>
        </div>
        {uicError && <p className="text-xs text-themeredred mt-1">{uicError}</p>}
      </div>
      <ClinicPicker
        label="Child Clinics"
        selectedIds={childClinicIds}
        allClinics={allClinics}
        excludeId={clinic?.id}
        onChange={setChildClinicIds}
      />
      <ClinicPicker
        label="Associated Clinics"
        selectedIds={associatedClinicIds}
        allClinics={allClinics}
        excludeId={clinic?.id}
        onChange={setAssociatedClinicIds}
      />
      <UserPicker
        label="Additional Users"
        selectedIds={additionalUserIds}
        allUsers={allUsers}
        onChange={setAdditionalUserIds}
      />
    </>
  )

  return (
    <>
      <h3 className="text-base font-semibold text-primary mb-4">
        {isEditMode ? 'Edit Clinic' : 'Create New Clinic'}
      </h3>

      {/* Error banner */}
      {error && <ErrorDisplay message={error} />}

      {/* Create mode uses a <form> for Enter-to-submit; edit mode uses a plain <div>. */}
      {isEditMode ? (
        <div className="space-y-4">
          {formFields}
          <button
            onClick={() => handleSubmit()}
            disabled={submitting}
            className={`w-full px-4 py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${submitColor}`}
          >
            {submitLabel}
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {formFields}
          <button
            type="submit"
            disabled={submitting}
            className={`w-full px-4 py-3 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${submitColor}`}
          >
            {submitLabel}
          </button>
        </form>
      )}
    </>
  )
}

export default AdminClinicForm
