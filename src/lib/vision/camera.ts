/**
 * camera.ts — utilities for opening a camera stream and capturing frames.
 * Pure browser APIs, no React, no dependencies.
 */

/**
 * Opens a camera stream with the given facing mode.
 * Defaults to 'environment' (rear camera) for barcode scanning on mobile.
 */
export async function openCamera(
  facingMode: 'environment' | 'user' = 'environment',
): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode },
    audio: false,
  })
}

/**
 * Stops all tracks on the stream, releasing the camera.
 */
export function closeCamera(stream: MediaStream): void {
  stream.getTracks().forEach(track => track.stop())
}

/**
 * Draws the current video frame to an offscreen canvas and returns raw ImageData.
 * Uses OffscreenCanvas where available, falls back to a regular <canvas>.
 */
export function captureFrame(video: HTMLVideoElement): ImageData {
  const w = video.videoWidth
  const h = video.videoHeight

  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D

  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h)
    ctx = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
  } else {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  }

  ctx.drawImage(video, 0, 0, w, h)
  return ctx.getImageData(0, 0, w, h)
}

/**
 * Captures the current video frame as a base64 data URL (JPEG, quality 0.92).
 * Useful for storing as photo_url on a PropertyItem.
 */
export function captureFrameAsDataURL(
  video: HTMLVideoElement,
  type = 'image/jpeg',
  quality = 0.92,
): string {
  const w = video.videoWidth
  const h = video.videoHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  ctx.drawImage(video, 0, 0, w, h)
  return canvas.toDataURL(type, quality)
}
