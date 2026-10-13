/**
 * Side-effect module: make ZXing decode ISO-8859-1 as true Latin-1.
 *
 * Binary-mode (Base256) Data Matrix text is decoded as ISO-8859-1. Browsers
 * resolve TextDecoder('ISO-8859-1') to windows-1252 (0x80–0x9F → €, ‚, …) and
 * ZXing's non-browser fallback throws outright — either way the ciphertext bytes
 * come back corrupted. One char per byte keeps text ↔ bytes lossless.
 */
import { ZXingStringEncoding } from '@zxing/library'

ZXingStringEncoding.customDecoder = (bytes, encodingName) => {
  if (encodingName !== 'ISO-8859-1') return new TextDecoder(encodingName).decode(bytes)
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return s
}
