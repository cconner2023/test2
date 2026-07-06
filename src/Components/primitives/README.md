# UI Primitives — build-time guidelines

**Read this before building any new component.** These are the shared building blocks.
Reach for one of them first; **never hand-roll an equivalent.** If a primitive is close
but not quite right, extend the primitive — don't fork a one-off in feature code.

> Canonical deep reference lives in the palace `v2/conventions` room. This file is the
> fast, colocated index. When code and this file disagree, the code wins — fix this file.

## The boundary (enforced)

- Every generic, reusable, presentational component lives in **`src/Components/primitives/`**.
- Import them via the alias: **`import { X } from '@/Components/primitives/X'`** — never a
  relative path. ESLint (`no-restricted-imports`) warns on relative primitive imports.
- A primitive takes **generic props and has zero store/service coupling.** If it needs a
  Zustand store, a service, Supabase, or domain vocabulary, it is *not* a primitive — it
  belongs in feature code.
- **Domain-flavored inputs are NOT primitives.** `BloodPressureInput`, `UicPinInput`,
  `FuelMeter` live in `@/Components/DomainInputs`, not here.

## Catalogue — reach for these

**Actions**
- `ActionButton` — icon (± label) action tile. The atom for card/footer actions.
- `ActionPill` — action cluster container. `placement="overlay"` rides a card's top edge
  (`-translate-y-1/2`); `placement="inline"` sits in flow. Use for custom clusters
  `OverlayActionMenu` can't express.
- `OverlayActionMenu` — **the** corner-action for a card. Self-consolidates by count:
  0 → nothing, 1 → single inline ActionButton in an overlay pill, 2+ → MoreHorizontal
  ellipsis opening an anchored menu. Never hand-roll `w-9 h-9 rounded-full` corner buttons.
- `TextButton` — text-label button. `AddFab` — floating add button. `HeaderPill` / `CardActionBar` — header/card action bars.

**Inputs** (`@/Components/primitives/FormInputs`) — self-rowing, iOS-zoom-safe
- `TextInput` — base text field. Use even inside custom layouts via `bare` mode; never a raw `<input>`.
- `PasswordInput` · `PickerInput` (long lists → overlay) · `MultiPickerInput` · `DatePickerInput` / `DatePickerCalendar` · `PinCodeInput` · `TimeInput`
- Standalone: `SearchInput` · `MobileSearchBar` · `ExpandableInput` (multiline/textarea) · `PinKeypad` · `SignaturePad`

**Containers / overlays**
- `Modal` · `Sheet` · `BaseDrawer` · `BaseOverlay` · `BottomIsland`
- Stack system: `OverlayStack` · `StackBody` · `LayeredStackBody` · `useStack`
- Menus: `Menu` · `ContextMenu` · `OverlayActionMenu` · `OverlayHeaderMenu` · `LiftedRowMenu` · `ActionSheet`

**Layout / structure**
- `Section` (exports `SectionCard` chrome + titled `Section`) · `ContentWrapper` · `ConnectorDots` · `GlassBand`

**Rows / lists**
- `ListItemRow` · `SwipeToDeleteRow`

**Feedback / status**
- `EmptyState` — `variant="card"` (SectionCard chrome + overlay ActionPill corner action) / `variant="gate"` (icon+title+subtitle access gate).
- `ConfirmDialog` · `ErrorDisplay` · `ErrorPill` · `LoadingOverlay` · `LoadingSpinner` · `HudLoader` · `Skeleton`
- `Chip`

## Which wrapper when (decision guide)

**To open / overlay a thing — pick ONE, don't invent a new one:**
- `PreviewOverlay` *(feature file, not in this folder — `@/Components/PreviewOverlay`)* — the workhorse. Tap a master-list row → card opens to view/edit; four fixed chrome slots. **Default choice for "open a thing."**
- `OverlayStack` — drill-down / morph: one card whose *body* morphs between screens (wizard, row→detail, an internal step/stage/mode state machine) when the parent is no longer needed visually. Built on PreviewOverlay.
- `Modal` — a true centered dialog that is NOT a ConfirmDialog and NOT row-anchored.
- `Sheet` — bottom sheet (`fit`/`snap` modes), mobile-first.
- `ActionSheet` — adaptive: renders a `Sheet` on mobile, a `Menu` on desktop.
- `ConfirmDialog` — destructive / confirm.
- `BaseDrawer` — the App-mounted draggable domain drawers (Calendar/Property/Messages/…). Not for ad-hoc surfaces.
- `BaseOverlay` — the z-index portal + stacking base everything builds on; rarely used directly.

**Menus — pick by trigger:**
- `Menu` — positioned dropdown option list (general).
- `ContextMenu` — right-click / long-press.
- `LiftedRowMenu` — iOS "lift the row + drop a list menu beneath" clone popover.
- `OverlayActionMenu` — card corner actions; self-collapses to an ellipsis when >2.
- `OverlayHeaderMenu` — header-positioned (niche).

**Drill-down vs interrupt** — the litmus is *"does the user still need to see the parent?"*
Yes → **z-stack** (OverlayStackContext auto-stacks; use the `Z.*` tokens, never bare z literals) — confirm over a form, anchored picker, toast.
No → **morph** with `OverlayStack` — a deeper level of the same surface. Hand-rolled step/view/stage state machines inside one overlay are drill-downs in disguise.

## Hard rules (from the UI/UX feedback corpus)

1. **No disabled action buttons.** Render a contextual action only when it's usable; filter
   the items array before handing to `OverlayActionMenu`. No dimmed/disabled buttons.
   *Exception:* a Close/X may stay.
2. **Chips are not a filter UI.** Put filters behind a filter button → list panel. `Chip` is
   only for true segmented selectors.
3. **Toggles/selectors are never pills.** Multi-choice → flat segments in a scroll row
   (active `bg-themeblue3`, no `rounded-full`, no border container). Boolean → sliding switch
   (`w-9 h-5 rounded-full` track + knob). Pill-shaped segmented toggles have never existed here.
4. **Inline-add = `TextInput bare` + a circular add button** (`w-9 rounded-full bg-themeblue3`
   with a `Plus` icon). Never a full-width text "Add" button; never a `rounded-full` pill on
   the field itself.
5. **Settings rows** = icon + label + toggle rows (Grid-row pattern), not stacks of
   full-width segmented text buttons.
6. **Empty-state / card corner action** = `ActionPill placement="overlay"` riding the top
   edge. The old `absolute top-2 right-2` / `bottom-2 right-2` corner div is dead.
7. **Overflow-hidden gotcha:** an overlay-placement pill lifts its top half above the card
   border with `-translate-y-1/2`; `SectionCard`/any `overflow-hidden` chrome clips it. Make
   the corner action a **sibling** of the chrome inside a `relative` wrapper.
8. **Non-blocking prompts** over modals — prefer a dismissable banner + red-dot to a
   modal-on-login (medics muscle-dismiss modals under time pressure).
9. **No success toast after a destructive confirm** — the item disappearing is feedback enough.
10. **Form inputs self-row** (`<label className="block border-b border-primary/6 last:border-b-0">`);
    placeholder IS the label; `text-base md:text-sm` (16px mobile = no iOS auto-zoom). Don't add
    `px-4 py-3` row wrappers around a primitive in consumer code — it already self-rows.

## Adding a primitive

Only when the component is genuinely generic (no store/service/domain coupling) and reused,
or clearly will be. Put it in this folder, import it via `@/Components/primitives/X`, and add
a line to the catalogue above. File the durable fact in the palace `v2/conventions` room.
