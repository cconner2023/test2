import { base64ToBytes } from '../lib/base64Utils'

/**
 * Image resize utility — aspect-preserving compression for item photos and layout images.
 * Generalized from useProfileAvatar.ts:resizeImage() (which center-crops to square).
 */

/**
 * Resize an image file, preserving aspect ratio, to fit within maxDimension on its longest side.
 * Returns a compressed JPEG base64 data URL.
 */
export function resizeImage(file: File, maxDimension = 800, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img

        // Scale down if either dimension exceeds max
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height / width) * maxDimension)
            width = maxDimension
          } else {
            width = Math.round((width / height) * maxDimension)
            height = maxDimension
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas not supported')); return }

        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Get the natural dimensions of an image from a data URL.
 */
export function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = dataUrl
  })
}

/**
 * Generate a tiny JPEG thumbnail data URL from an existing data URL.
 * Used for inline message previews before the full image loads.
 */
export function generateThumbnail(dataUrl: string, maxDim = 60, quality = 0.5): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img
      if (w > maxDim || h > maxDim) {
        if (w >= h) {
          h = Math.round((h / w) * maxDim)
          w = maxDim
        } else {
          w = Math.round((w / h) * maxDim)
          h = maxDim
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas not supported')); return }
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Failed to load image for thumbnail'))
    img.src = dataUrl
  })
}

/**
 * Convert a base64 data URL to a Blob.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream'
  return new Blob([base64ToBytes(b64)], { type: mime })
}
