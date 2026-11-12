// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/react'
import { useState } from 'react'
import { SliderRail, type SliderStop } from '../SliderRail'

const STOPS: SliderStop[] = [
  { id: 'a', title: 'A' },
  { id: 'b', title: 'B' },
  { id: 'c', title: 'C' },
  { id: 'cam', title: 'Cam', momentary: true },
]

function Harness({ onSelect }: { onSelect: (id: string) => void }) {
  const [active, setActive] = useState('a')
  return (
    <SliderRail
      stops={STOPS}
      activeId={active}
      orientation="horizontal"
      role="tablist"
      label="View"
      onSelect={(id) => { onSelect(id); if (id !== 'cam') setActive(id) }}
    />
  )
}

// jsdom has no PointerEvent; testing-library falls back to Event, so add the fields.
const ptr = (el: Element, type: string, init: Record<string, unknown>) => {
  const ev = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(ev, { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, ...init })
  fireEvent(el, ev)
}

const setup = () => {
  const onSelect = vi.fn()
  const utils = render(<Harness onSelect={onSelect} />)
  const track = utils.getByRole('tablist')
  // Simulate a rect/client mismatch: the rect claims the track sits far right.
  track.getBoundingClientRect = () => ({ left: 900, top: 900, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} })
  track.setPointerCapture = () => {}
  track.hasPointerCapture = () => true
  return { onSelect, track, utils }
}

afterEach(cleanup)

describe('SliderRail gestures', () => {
  it('tap on a stop selects it even when pointerup/cancel report clientX 0', () => {
    const { onSelect, track, utils } = setup()
    const c = utils.getByLabelText('C')
    ptr(c, 'pointerdown', { clientX: 500 })
    ptr(track, 'pointerup', { clientX: 0 })
    expect(onSelect.mock.calls.map((x) => x[0])).toEqual(['c'])
    expect(utils.getByLabelText('C').className).toContain('opacity-0')

    const b = utils.getByLabelText('B')
    ptr(b, 'pointerdown', { clientX: 500 })
    ptr(track, 'pointercancel', { clientX: 0 })
    fireEvent.click(b)
    expect(onSelect.mock.calls.map((x) => x[0])).toEqual(['c', 'b'])
  })

  it('drag moves by delta from the down point', () => {
    const { onSelect, track, utils } = setup()
    ptr(utils.getByLabelText('A'), 'pointerdown', { clientX: 100 })
    ptr(track, 'pointermove', { clientX: 144 })
    ptr(track, 'pointermove', { clientX: 188 })
    ptr(track, 'pointerup', { clientX: 0 })
    expect(onSelect.mock.calls.map((x) => x[0])).toEqual(['b', 'c'])
  })

  it('momentary fires once on release, not on drag-cross', () => {
    const { onSelect, track, utils } = setup()
    const cam = utils.getByLabelText('Cam')
    ptr(cam, 'pointerdown', { clientX: 300 })
    ptr(track, 'pointerup', { clientX: 300 })
    fireEvent.click(cam)
    expect(onSelect.mock.calls.map((x) => x[0])).toEqual(['cam'])
  })

  it('ignores hover moves and right-clicks', () => {
    const { onSelect, track, utils } = setup()
    ptr(track, 'pointermove', { clientX: 950, pointerType: 'mouse' })
    ptr(utils.getByLabelText('C'), 'pointerdown', { clientX: 500, pointerType: 'mouse', button: 2 })
    expect(onSelect).not.toHaveBeenCalled()
  })
})
