import { PreviewOverlay } from '../PreviewOverlay'
import { useIsMobile } from '../../Hooks/useIsMobile'
import { LineEditor, getLineTitle } from '../Medevac/MedevacForm'
import type { MedevacRequest } from '../../Types/MedevacTypes'
import type { MedevacLine } from '../Medevac/MedevacCard'

type Setter = <K extends keyof MedevacRequest>(field: K, value: MedevacRequest[K] | undefined) => void

interface TC3NineLineEditorProps {
  isOpen: boolean
  line: MedevacLine | null
  anchorRect: DOMRect | null
  data: MedevacRequest
  /** Set or clear an override on the session (undefined removes). */
  setOverride: Setter
  /** Notify parent the L3 total grew so it can sync the MASCAL queue. */
  onL3GrowDelta?: (delta: number) => void
  onClose: () => void
}

const LINE_NUMBER: Record<MedevacLine, number> = {
  l1: 1, l2: 2, l3: 3, l4: 4, l5: 5, l6: 6, l7: 7, l8: 8, l9: 9,
}

// TC3's 9-line editor IS the KB 9-line editor — it renders MedevacForm's shared
// LineEditor against the derived projection. The per-field override setter is
// adapted into the whole-patch `update` shape LineEditor expects.
export function TC3NineLineEditor({ isOpen, line, anchorRect, data, setOverride, onL3GrowDelta, onClose }: TC3NineLineEditorProps) {
  const isMobile = useIsMobile()
  const lineNum = line ? LINE_NUMBER[line] : null

  const update = (patch: Partial<MedevacRequest>) => {
    (Object.keys(patch) as (keyof MedevacRequest)[]).forEach(k => setOverride(k, patch[k]))
  }

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      anchorRect={anchorRect}
      title={lineNum ? `L${lineNum} — ${getLineTitle(lineNum, data.mode)}` : '9-Line'}
      preview={
        lineNum ? (
          <LineEditor
            line={lineNum}
            req={data}
            update={update}
            isMobile={isMobile}
            onL3Grow={onL3GrowDelta}
          />
        ) : null
      }
    />
  )
}
