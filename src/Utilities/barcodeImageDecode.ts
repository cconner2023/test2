import {
  MultiFormatReader, BinaryBitmap, HybridBinarizer, GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource, DecodeHintType, BarcodeFormat, ResultMetadataType,
} from '@zxing/library'

export interface ImageBarcodeResult {
  text: string
  byteSegments: Uint8Array | null
}

/**
 * Decode a barcode from an image file using ZXing.
 * Tries HybridBinarizer first, falls back to GlobalHistogramBinarizer.
 * Extracts raw BYTE_SEGMENTS for binary Data Matrix support.
 */
export async function decodeImageBarcode(file: File): Promise<ImageBarcodeResult> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()

  const luminanceSource = new HTMLCanvasElementLuminanceSource(canvas)
  const hints = new Map<DecodeHintType, any>()
  hints.set(DecodeHintType.TRY_HARDER, true)
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE])

  const reader = new MultiFormatReader()
  reader.setHints(hints)

  let result
  try {
    result = reader.decode(new BinaryBitmap(new HybridBinarizer(luminanceSource)))
  } catch {
    result = reader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(luminanceSource)))
  }

  const text = result.getText()

  let byteSegments: Uint8Array | null = null
  const metadata = result.getResultMetadata()
  if (metadata) {
    const segments = metadata.get(ResultMetadataType.BYTE_SEGMENTS) as Uint8Array[] | undefined
    if (segments?.length) {
      const totalLen = segments.reduce((sum, s) => sum + s.length, 0)
      const merged = new Uint8Array(totalLen)
      let offset = 0
      for (const seg of segments) { merged.set(seg, offset); offset += seg.length }
      byteSegments = merged
    }
  }

  return { text, byteSegments }
}
