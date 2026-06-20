/**
 * Shared share plumbing for note blocks (text templates, order sets, plan tags).
 * One hook backs BOTH the panel-wide transfer menu (folded into each manager's
 * corner action pill) AND the per-item Share controls in the manager lifted-row
 * menus, so a single bundle path serves "send everything" and "send just this one".
 * The data layer (objectBundle) already supports any mix of items.
 *
 * JSON bundles are app-internal: they travel ONLY over chat (Share to chat here;
 * received via the bundle card in the chat). They never escape to / enter from a
 * file — CSV is the only file format (see noteBlocksCSV.ts + NoteBlocksTransferMenu).
 *
 * - `share`   → open the ShareToChat picker for the given blocks
 * - `picker`  → render wherever `share` can fire
 */

import { useCallback, type ReactNode } from 'react'
import { useShareToChat } from '../Components/Messages/ShareToChatPicker'
import type { NoteBlocksData } from '../lib/objectBundle'

export interface NoteBlocksTransfer {
  /** Open the ShareToChat picker for these blocks. */
  share: (data: NoteBlocksData, label: string) => void
  /** ShareToChat picker portal — render wherever `share` can be invoked. */
  picker: ReactNode
}

export function useNoteBlocksTransfer(): NoteBlocksTransfer {
  const { shareBundle, picker } = useShareToChat()

  const share = useCallback((data: NoteBlocksData, label: string) => {
    shareBundle({ kind: 'note-blocks', blocks: data, label })
  }, [shareBundle])

  return { share, picker }
}
