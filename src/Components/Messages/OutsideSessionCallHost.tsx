import { useEffect, useState } from 'react'
import { onRingbackRequest, type OutsideRingbackRequest } from '../../lib/webrtc/outsideSessionCallBus'
import { OutsideSessionRingbackOverlay } from './OutsideSessionRingbackOverlay'

/**
 * Top-level host for the outside-session ring-back overlay. OutsideSessionCard
 * (deep in the message list) fires requestRingback; this host — mounted once
 * beside CallOverlay — owns the full-screen overlay. One ring-back at a time.
 */
export function OutsideSessionCallHost() {
  const [req, setReq] = useState<OutsideRingbackRequest | null>(null)
  useEffect(() => onRingbackRequest((r) => setReq((cur) => cur ?? r)), [])
  if (!req) return null
  return <OutsideSessionRingbackOverlay req={req} onClose={() => setReq(null)} />
}
