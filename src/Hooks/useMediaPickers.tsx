import { useCallback, useRef, useState, type ChangeEvent, type ClipboardEvent, type RefObject } from 'react'
import { ImageEditor } from '../Components/ImageEditor'
import { useImagePaste } from './useImagePaste'
import { resizeAndThumbnail } from './useMessages'
import { dataUrlToBlob } from '../Utilities/imageUtils'
import { uploadEncryptedAttachment, attachmentFailureMessage, MAX_ATTACHMENT_BYTES } from '../lib/signal/attachmentService'
import { emitErrorToast } from '../lib/errorFeedback'
import type { FileContent, ImageContent } from '../lib/signal/messageContent'

export type MediaSource =
  | { kind: 'image'; file: File; original: boolean; preview: string }
  | { kind: 'file'; file: File; preview?: undefined }

type UploadResult = { ok: true; data: ImageContent | FileContent } | { ok: false; error: string }

export async function uploadMedia(
  userId: string,
  source: MediaSource,
  { onProgress, signal }: { onProgress: (fraction: number) => void; signal: AbortSignal },
): Promise<UploadResult> {
  const { file } = source
  if (source.kind === 'file') {
    const up = await uploadEncryptedAttachment(userId, file, { class: 'm', onProgress, signal })
    if (!up.ok) return { ok: false, error: attachmentFailureMessage(up.error) }
    return {
      ok: true,
      data: {
        type: 'file', store: 'r2', path: up.data.path, key: up.data.key,
        mime: file.type || 'application/octet-stream', name: file.name, size: file.size,
      },
    }
  }
  let resized: Awaited<ReturnType<typeof resizeAndThumbnail>>
  try {
    resized = await resizeAndThumbnail(file, source.original)
  } catch {
    return { ok: false, error: 'That image could not be read.' }
  }
  const { resizedDataUrl, width, height, thumbnail } = resized
  const up = await uploadEncryptedAttachment(userId, dataUrlToBlob(resizedDataUrl), { class: 'm', onProgress, signal })
  if (!up.ok) return { ok: false, error: attachmentFailureMessage(up.error) }
  return {
    ok: true,
    data: {
      type: 'image', mime: 'image/jpeg', key: up.data.key, path: up.data.path, store: up.data.store,
      width, height, thumbnail,
    },
  }
}

/** Photo + file pickers, crop review, and file paste shared by every composer. */
export function useMediaPickers({ enabled, onImage, onFile, containerRef }: {
  enabled: boolean
  onImage: (file: File, original: boolean) => void
  onFile: (file: File) => void
  containerRef?: RefObject<HTMLElement | null>
}) {
  const photoRef = useRef<HTMLInputElement>(null)
  const docRef = useRef<HTMLInputElement>(null)
  const [editFile, setEditFile] = useState<File | null>(null)
  const latest = useRef({ onImage, onFile })
  latest.current = { onImage, onFile }

  const takeDoc = useCallback((file: File) => {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      emitErrorToast('File too large', 'Files must be 25 MB or smaller.')
      return
    }
    latest.current.onFile(file)
  }, [])

  const take = useCallback((file: File) => {
    if (file.type.startsWith('image/')) setEditFile(file)
    else takeDoc(file)
  }, [takeDoc])

  useImagePaste(enabled, setEditFile)

  const onPaste = useCallback((e: ClipboardEvent<HTMLElement>): boolean => {
    const file = e.clipboardData.files?.[0]
    if (!file) return false
    e.preventDefault()
    if (enabled) take(file)
    return true
  }, [enabled, take])

  const pick = (e: ChangeEvent<HTMLInputElement>, image: boolean) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (image) setEditFile(file)
    else takeDoc(file)
  }

  const inputs = (
    <>
      <input ref={photoRef} type="file" accept="image/*" onChange={e => pick(e, true)} className="hidden" />
      <input ref={docRef} type="file" onChange={e => pick(e, false)} className="hidden" />
    </>
  )

  const editor = (
    <ImageEditor
      file={editFile}
      onCancel={() => setEditFile(null)}
      onConfirm={(edited, original) => {
        setEditFile(null)
        latest.current.onImage(edited, original)
      }}
      containerRef={containerRef}
    />
  )

  return {
    pickPhoto: () => photoRef.current?.click(),
    pickFile: () => docRef.current?.click(),
    onPaste,
    inputs,
    editor,
  }
}
