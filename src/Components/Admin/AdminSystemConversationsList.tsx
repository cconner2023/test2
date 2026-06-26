import { useState, useCallback, useMemo, type ReactNode } from 'react'
import { Trash2, Reply } from 'lucide-react'
import { LiftedRowMenu } from '../LiftedRowMenu'
import { ConfirmDialog } from '../ConfirmDialog'
import { Z } from '../BaseOverlay'
import { SystemConversationCard } from './SystemConversationCard'
import { useAdminSystemConversations, isSystemMessage } from '../../Hooks/useAdminSystemConversations'
import { useMessagesContext } from '../../Hooks/MessagesContext'
import { useMessagingStore } from '../../stores/useMessagingStore'
import { getDisplayName } from '../../Utilities/nameUtils'

interface AdminSystemConversationsListProps {
  /** Open the system-conversation thread for the given peer. */
  onSelectSystemPeer: (peerId: string) => void
  /** Shared search — filters threads by peer name + last-message body. */
  searchQuery?: string
  /** Highlights the currently-open thread (desktop right-pane selection). */
  activePeerId?: string | null
}

/**
 * Dev↔user system reply threads, rendered as a selectable list for the admin
 * sort rail. Extracted from AdminRequestsList so system conversations have a
 * standing home in the left pane / nav sheet rather than mixing into the
 * Requests inbox. Long-press / right-click opens Reply / Delete.
 */
export function AdminSystemConversationsList({ onSelectSystemPeer, searchQuery, activePeerId }: AdminSystemConversationsListProps) {
  const systemConversations = useAdminSystemConversations()
  const messagesCtx = useMessagesContext()

  const [contextMenu, setContextMenu] = useState<{ peerId: string; rect: DOMRect; clone: ReactNode } | null>(null)
  const [confirmDeletePeerId, setConfirmDeletePeerId] = useState<string | null>(null)
  const [deleteProcessing, setDeleteProcessing] = useState(false)

  const filtered = useMemo(() => {
    const q = (searchQuery ?? '').trim().toLowerCase()
    if (!q) return systemConversations
    return systemConversations.filter((c) => {
      const name = c.peerProfile ? getDisplayName(c.peerProfile).toLowerCase() : ''
      const body = (c.lastMessage.plaintext ?? '').toLowerCase()
      return name.includes(q) || body.includes(q)
    })
  }, [systemConversations, searchQuery])

  /**
   * Delete every system message in the peer's conversation. Personal messages
   * (if any) keyed under the same peer stay. deleteMessages handles the
   * user-direction fanout via wire-framed delete envelopes.
   */
  const handleDelete = useCallback(async (peerId: string) => {
    if (!messagesCtx) return
    setDeleteProcessing(true)
    const msgs = useMessagingStore.getState().conversations[peerId] ?? []
    const systemIds = msgs.filter(isSystemMessage).map(m => m.id)
    if (systemIds.length > 0) {
      await messagesCtx.deleteMessages(peerId, systemIds)
    }
    setConfirmDeletePeerId(null)
    setDeleteProcessing(false)
  }, [messagesCtx])

  const renderContextMenu = () => {
    if (!contextMenu) return null
    const peerId = contextMenu.peerId
    const items = [
      { key: 'reply', label: 'Reply', icon: Reply, onAction: () => onSelectSystemPeer(peerId) },
      { key: 'delete', label: 'Delete', icon: Trash2, destructive: true, onAction: () => setConfirmDeletePeerId(peerId) },
    ]
    return (
      <LiftedRowMenu
        isOpen
        layout="list"
        anchorRect={contextMenu.rect}
        onClose={() => setContextMenu(null)}
        items={items}
        row={contextMenu.clone}
      />
    )
  }

  return (
    <div className="flex flex-col min-h-0">
      {filtered.length === 0 ? (
        <p className="px-4 py-5 text-center text-[9.5pt] text-tertiary">
          {searchQuery?.trim() ? 'No matching threads' : 'No system conversations'}
        </p>
      ) : (
        <div className="divide-y divide-themeblue3/10">
          {filtered.map((c) => (
            <div
              key={`sys-${c.peerId}`}
              className={activePeerId === c.peerId ? 'bg-themeblue3/8 border-l-2 border-l-themeblue3' : ''}
            >
              <SystemConversationCard
                conversation={c}
                onSelect={onSelectSystemPeer}
                setContextMenu={setContextMenu}
              />
            </div>
          ))}
        </div>
      )}

      {renderContextMenu()}

      <ConfirmDialog
        visible={!!confirmDeletePeerId}
        title="Delete this system thread?"
        subtitle="Removes the thread from both sides. Permanent."
        confirmLabel="Delete"
        variant="danger"
        processing={deleteProcessing}
        zIndex={Z.POPOVER + 30}
        onConfirm={() => { if (confirmDeletePeerId) handleDelete(confirmDeletePeerId) }}
        onCancel={() => setConfirmDeletePeerId(null)}
      />
    </div>
  )
}
