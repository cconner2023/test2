import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import type { OutsideMessageContent } from '../../lib/signal/messageContent'
import { useAuthStore } from '../../stores/useAuthStore'
import { getWrappedVoicemailKey } from '../../lib/oncallKeyStore'
import { unsealAudioKey, decryptText, importVoicemailPrivateKey } from '../../lib/oncallSeal'
import { unwrapFromVault } from '../../lib/signal/oncallKeyWrap'
import type { SealedEnvelope } from '../../lib/signal/sealedSender'

interface Props {
  content: OutsideMessageContent
  createdAt: string
  messageId: string
  onLongPress?: (x: number, y: number) => void
}

/**
 * Outside→cluster one-way message card — the durable record of a sealed text note
 * an outside party dropped to the cluster. The body is E2E-sealed to the clinic
 * inbound key (same envelope + key as voicemail audio): unwrap the clinic key from
 * the vault, unseal the per-message AES key, decrypt the text. Server never sees
 * plaintext. Delete/Copy ride the existing long-press context menu.
 */
export function OutsideMessageCard({ content, createdAt, messageId, onLongPress }: Props) {
  const [body, setBody] = useState<string | null>(null)
  const [error, setError] = useState(false)
  const when = createdAt ? new Date(createdAt).toLocaleString() : ''

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const wrapped = getWrappedVoicemailKey(content.clinic_id) as SealedEnvelope | null
      const myUuid = useAuthStore.getState().user?.id
      if (!wrapped || !myUuid) { setError(true); return }
      try {
        const privPkcs8 = await unwrapFromVault(wrapped, myUuid)
        const priv = await importVoicemailPrivateKey(privPkcs8)
        const aesKey = await unsealAudioKey(
          { sealed_key: content.sealed.sealed_key, ephemeral_pub: content.sealed.ephemeral_pub, nonce: content.sealed.nonce },
          priv,
        )
        const text = await decryptText(aesKey, content.sealed.ciphertext)
        if (!cancelled) setBody(text)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [content])

  return (
    <div className="w-full flex justify-center px-4 my-2" data-message-id={messageId}>
      <div
        className="max-w-[85%] w-full px-3 py-2.5 rounded-2xl bg-primary/5 border border-primary/10"
        onContextMenu={(e) => { e.preventDefault(); onLongPress?.(e.clientX, e.clientY) }}
      >
        <div className="flex items-center gap-2.5">
          <MessageSquare size={18} className="text-themeblue3" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-primary truncate">{content.requester_name || 'Outside sender'}</p>
            <p className="text-[10pt] text-tertiary">Message{when ? ` · ${when}` : ''}</p>
          </div>
        </div>
        {body !== null && (
          <p className="mt-1.5 text-sm text-primary whitespace-pre-wrap break-words">{body}</p>
        )}
        {error && <p className="mt-1.5 text-[9pt] text-themeredred">Message couldn’t be decrypted on this device.</p>}
      </div>
    </div>
  )
}
