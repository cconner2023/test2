import { useState, useMemo, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react'
import { X, Square, CheckSquare, Plus } from 'lucide-react'
import { TextInput, PickerInput, DatePickerInput } from '@/Components/primitives/FormInputs'
import { usePropertyStore } from '../../stores/usePropertyStore'
import { isLinContainer } from '../../Utilities/propertyAuthorized'
import { useShallow } from 'zustand/react/shallow'
import type { LocalPropertyItem, ItemType, UnitOfIssue } from '../../Types/PropertyTypes'
import { ROOT_LOCATION_NAME } from '../../Types/PropertyTypes'

const ITEM_TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'CI', label: 'Consumable' },
  { value: 'DI', label: 'Durable' },
  { value: 'SI', label: 'Sensitive' },
]
const UNIT_OF_ISSUE_OPTIONS: { value: UnitOfIssue; label: string }[] = [
  { value: 'EA', label: 'EA — each' },
  { value: 'SET', label: 'SET' },
  { value: 'PR', label: 'PR — pair' },
  { value: 'BOT', label: 'BOT — bottle' },
  { value: 'PK', label: 'PK — pack' },
  { value: 'TUB', label: 'TUB — tube' },
]

interface PropertyItemFormProps {
  editingItem?: LocalPropertyItem | null
  onClose: () => void
  /** Called after a brand-new item is created so the host can present the
   *  visual-ID enroll step as a modal (shared with the detail-menu enroll). */
  onEnrollNew?: (item: LocalPropertyItem) => void
  /** Reports save-in-flight so the host surface can gate with the HUD loader. */
  onSavingChange?: (saving: boolean) => void
  /** Authorized/BOM context (opened from PropertyAuthorizedPanel): surfaces the
   *  Authorized-qty field and defaults new lines to fungible (non-serialized). An
   *  item already authorization-tracked shows the field regardless. */
  showAuthorized?: boolean
  /** Pre-parent a new line under an SKO (the authorized panel's per-group add). */
  initialParentId?: string | null
}

export interface PropertyItemFormHandle {
  /** Validate + persist. Drives the host header's Save action (calendar EventForm pattern). */
  submit: () => void
}

export const PropertyItemForm = forwardRef<PropertyItemFormHandle, PropertyItemFormProps>(
  function PropertyItemForm({ editingItem, onClose, onEnrollNew, onSavingChange, showAuthorized, initialParentId }, ref) {
  const {
    locations,
    clinicMembers,
    items,
    clinicId,
    defaultLocationId,
    addItem,
    editItem,
    editLocation,
  } = usePropertyStore(
    useShallow((s) => ({
      locations: s.locations,
      clinicMembers: s.clinicMembers,
      items: s.items,
      clinicId: s.clinicId,
      defaultLocationId: s.defaultLocationId,
      addItem: s.addItem,
      editItem: s.editItem,
      editLocation: s.editLocation,
    }))
  )

  const isEdit = !!editingItem

  const [name, setName] = useState(editingItem?.name ?? '')
  const [nomenclature, setNomenclature] = useState(editingItem?.nomenclature ?? '')
  const [nsn, setNsn] = useState(editingItem?.nsn ?? '')
  const [lin, setLin] = useState(editingItem?.lin ?? '')
  // Serialized: one entry per physical item. Starts with one empty row (single-item path = today's behavior).
  const [serialNumbers, setSerialNumbers] = useState<string[]>(
    editingItem ? [editingItem.serial_number ?? ''] : ['']
  )
  // Authorized/BOM lines default to on-hand 0 — a BOM records what you SHOULD have, and
  // you often haven't received it yet. Normal new items default to 1. An edit keeps its own.
  const [quantity, setQuantity] = useState(String(editingItem?.quantity ?? (showAuthorized ? 0 : 1)))
  const [locationId, setLocationId] = useState(editingItem?.location_id ?? (isEdit ? '' : defaultLocationId ?? ''))
  const [holderId, setHolderId] = useState(editingItem?.current_holder_id ?? '')
  const [parentItemId, setParentItemId] = useState(() => {
    if (editingItem?.parent_item_id != null) return editingItem.parent_item_id
    if (initialParentId) return initialParentId
    // Fresh authorized add opens in New-LIN mode ('' → isNewLin) — building the hand receipt
    // (declaring the LINs you're signed for) is the primary first action; assigning a product
    // under an existing LIN is an explicit pick from the picker. The per-group "+ Add item"
    // still lands here with initialParentId set (assign mode), so it's unaffected.
    return ''
  })
  const [notes, setNotes] = useState(editingItem?.notes ?? '')
  const [expiryDate, setExpiryDate] = useState(editingItem?.expiry_date ?? '')
  const [isSaving, setIsSaving] = useState(false)
  // Authorized/BOM lines are fungible by default (unit/pack + auth qty apply); normal
  // new items default to serialized. An edit always preserves the item's own flag.
  const [isSerialized, setIsSerialized] = useState(editingItem?.is_serialized ?? (showAuthorized ? false : true))
  // Authorized (BOM) quantity — issue-unit value, converts to base via pack_size. Shown
  // only in authorized context or when the item is already authorization-tracked.
  const authActive = !!showAuthorized || editingItem?.quantity_authorized != null
  // The PHR two-pick add flow (pick a LIN, then the component within it) runs only on a
  // FRESH authorized add — it hard-blocks freeform item invention in the PHR. Edits keep the
  // generic parent picker so an existing line can still be re-parented.
  const authAddFlow = !!showAuthorized && !editingItem
  // Building a new LIN (the PHR container) vs assigning a product under an existing one. A LIN
  // is a pure header — name + LIN code only, no qty/location/holder/expiry/serial and NOT
  // authorization-tracked (it carries no quantity_authorized, so it never multiplies or
  // contributes its own shortage; only its component lines do).
  const isNewLin = authAddFlow && parentItemId === ''
  // Editing an existing LIN container (standalone item-LIN or a vehicle shadow) — the same
  // minimal name + LIN surface as building one; all stockable fields stay hidden.
  const editingIsLin = !!editingItem && isLinContainer(editingItem)
  const [quantityAuthorized, setQuantityAuthorized] = useState(
    editingItem?.quantity_authorized != null ? String(editingItem.quantity_authorized) : ''
  )
  // Accountability class. New items default DI. SI forces serialized (see effect below).
  const [itemType, setItemType] = useState<ItemType>(editingItem?.item_type ?? 'DI')
  // Unit of issue + base-per-issue pack size — fungible (non-serialized) lines only.
  const [unitOfIssue, setUnitOfIssue] = useState<string>(editingItem?.unit_of_issue ?? '')
  const [packSize, setPackSize] = useState(editingItem?.pack_size != null ? String(editingItem.pack_size) : '')
  // SI is serialized by definition — selecting it locks the individual-tracking flag on.
  useEffect(() => { if (itemType === 'SI') setIsSerialized(true) }, [itemType])
  // Health/serviceability is expressed by PMCS faults now (no manual chips). The
  // value still round-trips: 'serviceable' default on create, and an edit preserves
  // whatever's there (e.g. 'missing' set by the transfer accountability check).
  const [conditionCode] = useState<'serviceable' | 'unserviceable' | 'damaged' | 'missing'>(
    editingItem?.condition_code ?? 'serviceable'
  )

  const updateSerial = useCallback((idx: number, value: string) => {
    setSerialNumbers(prev => {
      const next = [...prev]
      next[idx] = value
      return next
    })
  }, [])

  const addSerial = useCallback(() => {
    setSerialNumbers(prev => [...prev, ''])
  }, [])

  const removeSerial = useCallback((idx: number) => {
    setSerialNumbers(prev => prev.filter((_, i) => i !== idx))
  }, [])

  // Shared item-picker presentation — every picker that lists items uses the same
  // label (name + LIN when set) and the same exclusion (deleted / turned-in / self),
  // so the create-flow and edit-flow item pickers render and filter identically.
  const itemOptionLabel = useCallback(
    (i: LocalPropertyItem) => (i.lin ? `${i.name} · LIN ${i.lin}` : i.name),
    [],
  )
  const isSelectableItem = useCallback(
    (i: LocalPropertyItem) => !i.deleted_at && !i.turned_in_at && i.id !== editingItem?.id,
    [editingItem?.id],
  )

  const locationOptions = useMemo(
    () =>
      locations
        .filter((l) => l.name !== ROOT_LOCATION_NAME && !l.is_turn_in_zone)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((l) => ({ value: l.id, label: l.name })),
    [locations]
  )

  const holderOptions = useMemo(
    () =>
      clinicMembers
        .slice()
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .map((m) => ({ value: m.id, label: m.displayName })),
    [clinicMembers]
  )

  const parentItemOptions = useMemo(
    () =>
      items
        .filter(isSelectableItem)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ value: i.id, label: itemOptionLabel(i) })),
    [items, isSelectableItem, itemOptionLabel]
  )

  // PHR level 1 — the cluster's LINs: top-level, authorization-tracked, live items. These
  // are the "hand receipts" a new component can be signed under. Used by the authorized-add
  // flow, which builds the WHOLE receipt (standalone item-LINs included).
  const authorizedLinOptions = useMemo(
    () =>
      items
        .filter((i) => isLinContainer(i) && isSelectableItem(i))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((i) => ({ value: i.id, label: itemOptionLabel(i) })),
    [items, isSelectableItem, itemOptionLabel],
  )

  // Pick a LIN in the normal add flow — sets the parent. If the LIN lives at a zone (a physical
  // container: vehicle/case/bag shadow) it ALSO defaults Location to that zone. A standalone
  // item-LIN has no location, so the stock keeps the zone it's being added at (decoupled model:
  // physical stock carries its own location and reconciles to the target by LIN+NSN). Overridable.
  const pickLinkLin = useCallback((linId: string) => {
    setParentItemId(linId)
    const lin = items.find((i) => i.id === linId)
    if (lin?.location_id) setLocationId(lin.location_id)
  }, [items])

  // PHR level 2 — the authorized component ROLES already present under the chosen LIN
  // (distinct nomenclatures). Picking one quick-fills nomenclature; a new role is typed.
  const componentRoleOptions = useMemo(() => {
    if (!parentItemId) return [] as { value: string; label: string }[]
    const roles = new Set<string>()
    for (const i of items) {
      if (
        i.parent_item_id === parentItemId &&
        i.quantity_authorized != null &&
        i.nomenclature &&
        !i.deleted_at &&
        !i.turned_in_at
      ) {
        roles.add(i.nomenclature)
      }
    }
    return [...roles].sort((a, b) => a.localeCompare(b)).map((r) => ({ value: r, label: r }))
  }, [items, parentItemId])

  // NORMAL "link to hand receipt" flow: when the cluster has authorized LINs, an inventory
  // line picks its LIN (parent) + authorized role (nomenclature) instead of free-typing them,
  // so the stock lands under the right hand receipt AND draws down that line's shortage. The
  // shortage fold keys on-hand by (parent LIN + NSN), so picking a role must copy that role's
  // authorized NSN — otherwise the stock keys separately and the shortage doesn't move. Off-book
  // stock stays possible via "Not on a LIN". Offers EVERY LIN the cluster is signed for
  // (authorizedLinOptions) — not just zone-located ones — so a component under a standalone
  // hand-receipt LIN is matchable when stocking a zone.
  // EDIT PARITY: applies to edits too (not just fresh adds) — an existing line seeds parentItemId
  // from its parent LIN so the same picker/role/NSN-inherit surface reopens; the material/LIN
  // auto-fill exactly as on create. A loose line (parentItemId '') opens the free-text branch.
  const linkFlow = !authActive && !authAddFlow && !editingIsLin && authorizedLinOptions.length > 0

  // Pick an authorized role under the chosen LIN — sets nomenclature and inherits the
  // authorized component's NSN so this stock counts toward that line.
  const pickRole = useCallback((role: string) => {
    setNomenclature(role)
    if (!role) return
    const auth = items.find(
      (i) =>
        i.parent_item_id === parentItemId &&
        i.nomenclature === role &&
        i.quantity_authorized != null &&
        !i.deleted_at &&
        !i.turned_in_at,
    )
    if (auth?.nsn) setNsn(auth.nsn)
  }, [items, parentItemId])

  const handleSave = useCallback(async () => {
    if (!name.trim() || !clinicId) return
    // A LIN needs a Line Item Number — that code is what marks it as a PHR container.
    if ((isNewLin || editingIsLin) && !lin.trim()) return
    setIsSaving(true)

    // Authorized (BOM) context allows on-hand 0 — an authorized-but-unreceived line is a
    // real state (surfaces DEPLETED + feeds the shortage fold). Elsewhere on-hand floors at 1.
    const minQuantity = authActive ? 0 : 1

    const sharedPayload = {
      name: name.trim(),
      nomenclature: nomenclature.trim() || null,
      nsn: nsn.trim() || null,
      lin: lin.trim() || null,
      condition_code: conditionCode,
      // An authorized line is a location-less TARGET — never carries a location (its physical
      // stock does). This also converts a legacy authorized-at-a-zone item into a pure target
      // on edit, which is the decoupled-model migration. EXCEPT a ZONE-SHADOW (a zone that is
      // a counted component — represents_location_id set): it stays located AT its zone so it
      // self-counts present and never collapses into a location-less target.
      location_id: (authActive && !editingItem?.represents_location_id) ? null : (locationId || null),
      current_holder_id: holderId || null,
      parent_item_id: parentItemId || null,
      expiry_date: expiryDate || null,
      notes: notes.trim() || null,
      is_serialized: isSerialized,
      item_type: itemType,
      // Unit/pack describe fungible issue lines; a serialized item is 1:1 (unit irrelevant).
      unit_of_issue: isSerialized ? null : ((unitOfIssue || null) as UnitOfIssue | null),
      pack_size: isSerialized ? null : (packSize.trim() ? Math.max(1, parseInt(packSize) || 1) : null),
      // Only write quantity_authorized in authorized context — a normal edit must never
      // clear an item's BOM authorization by omission.
      ...(authActive
        ? { quantity_authorized: quantityAuthorized.trim() ? Math.max(0, parseInt(quantityAuthorized) || 0) : null }
        : {}),
    }

    try {
      if (editingIsLin && editingItem) {
        // Edit a LIN header — only name + LIN change; everything else is preserved. If this LIN
        // is a zone-shadow (it lives at a zone — any kind: vehicle, case, bag), sync the zone
        // name so the zone and its hand-receipt LIN never split. Standalone item-LINs have no
        // location_id, so they skip this branch.
        await editItem(editingItem.id, { name: name.trim(), lin: lin.trim() })
        if (editingItem.location_id) {
          const loc = locations.find((l) => l.id === editingItem.location_id)
          if (loc) await editLocation(loc.id, { name: name.trim() })
        }
        onClose()
      } else if (isNewLin) {
        // A LIN container — header only (name + LIN). No qty/location/holder/expiry/serial and
        // NOT authorization-tracked; the components assigned to it carry the authorized qtys.
        await addItem({
          clinic_id: clinicId,
          sub_cluster_id: null,
          name: name.trim(),
          nomenclature: null,
          nsn: null,
          lin: lin.trim(),
          condition_code: 'serviceable',
          location_id: null,
          current_holder_id: null,
          parent_item_id: null,
          expiry_date: null,
          notes: null,
          is_serialized: false,
          item_type: 'DI',
          unit_of_issue: null,
          pack_size: null,
          quantity_authorized: null,
          serial_number: null,
          quantity: 0,
          location_tag_id: null,
          photo_url: null,
          visual_fingerprint: null,
        })
        onClose()
      } else if (isEdit && editingItem) {
        await editItem(editingItem.id, {
          ...sharedPayload,
          sub_cluster_id: editingItem.sub_cluster_id ?? null,
          serial_number: isSerialized ? (serialNumbers[0]?.trim() || null) : null,
          quantity: isSerialized ? 1 : Math.max(minQuantity, parseInt(quantity) || 0),
        })
        // ZONE-SHADOW reverse-sync: renaming a zone's component line here keeps the zone name in
        // step, so the zone and its hand-receipt component never split (mirrors the zone form's
        // forward sync). Keys on represents_location_id — the zone-shadow identity marker.
        if (editingItem.represents_location_id) {
          const loc = locations.find((l) => l.id === editingItem.represents_location_id)
          if (loc && name.trim() && loc.name !== name.trim()) await editLocation(loc.id, { name: name.trim() })
        }
        onClose()
      } else if (!isSerialized) {
        const created = await addItem({
          clinic_id: clinicId,
          sub_cluster_id: null,
          ...sharedPayload,
          serial_number: null,
          quantity: Math.max(minQuantity, parseInt(quantity) || 0),
          location_tag_id: null,
          photo_url: null,
          visual_fingerprint: null,
        })
        if (created) onEnrollNew?.(created)
        onClose()
      } else {
        const validSerials = serialNumbers.map(s => s.trim()).filter(Boolean)

        if (validSerials.length <= 1) {
          // Single item — preserve enrollment flow
          const created = await addItem({
            clinic_id: clinicId,
            sub_cluster_id: null,
            ...sharedPayload,
            serial_number: validSerials[0] ?? null,
            quantity: 1,
            location_tag_id: null,
            photo_url: null,
            visual_fingerprint: null,
          })
          if (created) onEnrollNew?.(created)
          onClose()
        } else {
          // Batch — create one item per serial, skip enrollment
          for (const serial of validSerials) {
            await addItem({
              clinic_id: clinicId,
              sub_cluster_id: null,
              ...sharedPayload,
              serial_number: serial,
              quantity: 1,
              location_tag_id: null,
              photo_url: null,
              visual_fingerprint: null,
            })
          }
          onClose()
        }
      }
    } catch {
      // error handled by service layer
    } finally {
      setIsSaving(false)
    }
  }, [
    name, nomenclature, nsn, lin, serialNumbers, quantity,
    locationId, holderId, parentItemId, notes, expiryDate, isSerialized,
    itemType, unitOfIssue, packSize, authActive, quantityAuthorized, isNewLin, editingIsLin,
    isEdit, editingItem, clinicId, addItem, editItem, editLocation, locations, onClose, onEnrollNew, conditionCode,
  ])

  useImperativeHandle(ref, () => ({ submit: handleSave }), [handleSave])

  useEffect(() => { onSavingChange?.(isSaving) }, [isSaving, onSavingChange])
  // Save success calls onClose() (unmount) before the finally resets isSaving, so
  // clear the host's HUD flag on unmount to avoid a stuck loader.
  useEffect(() => () => onSavingChange?.(false), [onSavingChange])

  const hasLocations = locationOptions.length > 0
  const hasParentItems = parentItemOptions.length > 0
  const filledSerialCount = serialNumbers.filter(s => s.trim()).length

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl overflow-hidden">
      {editingIsLin ? (
        /* Edit an existing LIN — name + LIN code only (a header carries nothing else). */
        <div className="flex items-stretch border-b border-primary/6">
          <div className="flex-1 min-w-0">
            <TextInput value={name} onChange={setName} placeholder="LIN name *" required />
          </div>
          <div className="flex-1 min-w-0 border-l border-primary/6">
            <TextInput value={lin} onChange={setLin} placeholder="LIN * (e.g. M30499)" required />
          </div>
        </div>
      ) : authAddFlow ? (
        <>
          {/* PHR pick 1 — which LIN (hand receipt) this belongs to. With no LINs yet the flow
              FORCES building one first (no picker, prompt shown); once LINs exist the picker
              defaults to assigning under one, with "+ New LIN" as an explicit choice. */}
          {authorizedLinOptions.length === 0 ? (
            <p className="px-4 py-3 text-[10pt] text-tertiary border-b border-primary/6">
              Build your hand receipt first — add a LIN you're signed for, then assign items to it.
            </p>
          ) : (
            <PickerInput
              value={parentItemId}
              onChange={setParentItemId}
              options={[...authorizedLinOptions, { value: '', label: '+ New LIN (top-level)' }]}
              placeholder="Which LIN (hand receipt)"
            />
          )}
          {parentItemId === '' ? (
            /* Declaring a new LIN the cluster is signed for — the set / end-item itself. */
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput value={name} onChange={setName} placeholder="Set name *" required />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <TextInput value={lin} onChange={setLin} placeholder="LIN * (e.g. M30499)" required />
              </div>
            </div>
          ) : (
            /* PHR pick 2 — the authorized component within the LIN. Role = nomenclature
               (quick-fill from existing roles or type a new one); name = the product held. */
            <>
              {componentRoleOptions.length > 0 && (
                <PickerInput
                  value={componentRoleOptions.some((o) => o.value === nomenclature) ? nomenclature : ''}
                  onChange={setNomenclature}
                  options={[{ value: '', label: 'New role…' }, ...componentRoleOptions]}
                  placeholder="Use existing role"
                />
              )}
              <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Component role * (e.g. Tourniquet)" required />
              <TextInput value={name} onChange={setName} placeholder="Product name * (e.g. CAT)" required />
              <TextInput value={nsn} onChange={setNsn} placeholder="Material/NSN" />
            </>
          )}
        </>
      ) : linkFlow ? (
        <>
          {/* LIN FIRST — pick the hand-receipt LIN this stock belongs to (every LIN the cluster
              is signed for, standalone or zone-located). A zone-located LIN auto-fills Location to
              its zone (below); a standalone LIN keeps the zone being stocked. Picking a role
              inherits its NSN so the stock draws down that line's shortage. The component field
              appears only once a LIN is picked; "Not on a LIN" keeps it loose. */}
          <PickerInput
            value={parentItemId}
            onChange={pickLinkLin}
            options={[{ value: '', label: 'Not on a LIN (loose stock)' }, ...authorizedLinOptions]}
            placeholder="LIN (hand receipt) *"
            searchable
          />
          {parentItemId ? (
            <>
              {componentRoleOptions.length > 0 && (
                <PickerInput
                  value={componentRoleOptions.some((o) => o.value === nomenclature) ? nomenclature : ''}
                  onChange={pickRole}
                  options={[{ value: '', label: 'Other role…' }, ...componentRoleOptions]}
                  placeholder="Authorized item (role)"
                  searchable
                />
              )}
              <TextInput value={name} onChange={setName} placeholder="Item name *" required />
              <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Nomenclature (role)" />
              <TextInput value={nsn} onChange={setNsn} placeholder="Material/NSN" />
            </>
          ) : (
            <>
              <TextInput value={name} onChange={setName} placeholder="Item name *" required />
              <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Nomenclature" />
              <div className="flex items-stretch border-b border-primary/6">
                <div className="flex-1 min-w-0">
                  <TextInput value={nsn} onChange={setNsn} placeholder="Material/NSN" />
                </div>
                <div className="flex-1 min-w-0 border-l border-primary/6">
                  <TextInput value={lin} onChange={setLin} placeholder="LIN" />
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <TextInput value={name} onChange={setName} placeholder="Item name *" required />
          <TextInput value={nomenclature} onChange={setNomenclature} placeholder="Nomenclature" />
          {/* An authorized line's LIN is inherited from its parent LIN — hide it here. */}
          {authActive ? (
            <TextInput value={nsn} onChange={setNsn} placeholder="Material/NSN" />
          ) : (
            <div className="flex items-stretch border-b border-primary/6">
              <div className="flex-1 min-w-0">
                <TextInput value={nsn} onChange={setNsn} placeholder="Material/NSN" />
              </div>
              <div className="flex-1 min-w-0 border-l border-primary/6">
                <TextInput value={lin} onChange={setLin} placeholder="LIN" />
              </div>
            </div>
          )}
        </>
      )}

      {/* Stockable fields — hidden when building OR editing a LIN (a header carries none). */}
      {!isNewLin && !editingIsLin && (
        <>
      {authActive && (
        <TextInput
          type="number"
          inputMode="numeric"
          value={quantityAuthorized}
          onChange={setQuantityAuthorized}
          placeholder="Authorized qty (BOM)"
        />
      )}

      {/* Accountability class + serialized + on-hand qty are PHYSICAL-stock attributes. An
          authorized line is a location-less TARGET (its on-hand is derived from matching stock),
          so they're all hidden for authActive — the target form is role/NSN/authorized-qty only. */}
      {!authActive && (
        <>
          <div className="flex items-stretch border-b border-primary/6">
            {ITEM_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setItemType(opt.value)}
                className={`flex-1 min-w-0 px-2 py-3 text-[10pt] transition-all active:scale-95 border-l first:border-l-0 border-primary/6 ${
                  itemType === opt.value ? 'bg-themeblue3 text-white' : 'text-secondary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => itemType !== 'SI' && setIsSerialized((v) => !v)}
            className="w-full flex items-center gap-1.5 px-4 py-3 text-[10pt] text-secondary active:scale-95 transition-all border-b border-primary/6"
          >
            {isSerialized ? <CheckSquare size={14} /> : <Square size={14} />}
            Track individually (serialized)
          </button>
        </>
      )}


      {isSerialized ? (
        <div>
          {serialNumbers.map((sn, idx) => {
            const isLast = idx === serialNumbers.length - 1
            return (
              <div key={idx} className="flex items-center border-b border-primary/6 last:border-b-0">
                <div className="flex-1 min-w-0">
                  <TextInput
                    value={sn}
                    onChange={(v) => updateSerial(idx, v)}
                    placeholder={serialNumbers.length > 1 ? `Serial ${idx + 1}` : 'Serial number'}
                  />
                </div>
                {!isEdit && isLast ? (
                  <button
                    type="button"
                    onClick={addSerial}
                    className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full bg-themeblue3 text-white active:scale-95 transition-all"
                  >
                    <Plus size={14} />
                  </button>
                ) : serialNumbers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeSerial(idx)}
                    className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full text-tertiary hover:text-tertiary hover:bg-tertiary/10 active:scale-95 transition-all"
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            )
          })}
          {filledSerialCount > 1 && (
            <p className="px-4 py-2 text-[9pt] text-tertiary border-b border-primary/6">
              {filledSerialCount} items will be created
            </p>
          )}
        </div>
      ) : (
        <>
          {/* On-hand qty is a physical-stock field — a target has none (derived from stock). */}
          {!authActive && (
            <TextInput type="number" value={quantity} onChange={setQuantity} placeholder="Quantity" />
          )}
          <div className="flex items-stretch border-b border-primary/6">
            <div className="flex-1 min-w-0">
              <PickerInput
                value={unitOfIssue}
                onChange={setUnitOfIssue}
                options={[{ value: '', label: 'Unit of issue (EA)' }, ...UNIT_OF_ISSUE_OPTIONS]}
                placeholder="Unit of issue (EA)"
              />
            </div>
            <div className="flex-1 min-w-0 border-l border-primary/6">
              <TextInput type="number" value={packSize} onChange={setPackSize} placeholder="Per issue (e.g. PR = 2)" />
            </div>
          </div>
        </>
      )}

      {/* A target has no location (its stock does) — hide for authActive. */}
      {hasLocations && !authActive && (
        <PickerInput
          value={locationId}
          onChange={setLocationId}
          options={locationOptions}
          placeholder="Location"
          searchable
        />
      )}
      {/* An authorized line is cluster-owned — no holder. */}
      {holderOptions.length > 0 && !authActive && (
        <PickerInput
          value={holderId}
          onChange={setHolderId}
          options={holderOptions}
          placeholder="Holder (unassigned)"
        />
      )}
      {hasParentItems && !authAddFlow && !linkFlow && (
        <PickerInput
          value={parentItemId}
          onChange={setParentItemId}
          options={parentItemOptions}
          placeholder="Parent item (top-level)"
          searchable
        />
      )}
      {/* An authorized line never carries an expiry — that belongs to the physical stock. */}
      {!authActive && (
        <div className="flex items-center border-b border-primary/6">
          <div className="flex-1 min-w-0">
            <DatePickerInput
              value={expiryDate}
              onChange={setExpiryDate}
              placeholder="Expiry date"
            />
          </div>
          {expiryDate && (
            <button
              type="button"
              onClick={() => setExpiryDate('')}
              className="shrink-0 w-8 h-8 mr-2 flex items-center justify-center rounded-full text-tertiary hover:text-tertiary active:scale-95 transition-all"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <label className="block border-b border-primary/6">
        <textarea
          className="w-full bg-transparent px-4 py-3 text-base md:text-sm text-primary placeholder:text-tertiary focus:outline-none resize-none"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
      </label>
        </>
      )}
      </div>
    </div>
  )
})
