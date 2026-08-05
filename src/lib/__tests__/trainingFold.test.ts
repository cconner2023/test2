/**
 * Tests for the training fold's two halves: the state projection
 * (foldTrainingState) and the void suppression the RAW surfaces read
 * (voidedTrainingEventIds / liveTrainingEvents).
 *
 * The pairing is the point. A re-grade leaves ONE folded record and TWO graded
 * events, so the weekly activity graph and the record list legitimately disagree
 * — but a DELETED record must leave neither, on every device, whether or not the
 * best-effort purge reached the rows.
 */

import { describe, it, expect } from 'vitest'
import { foldTrainingState, liveTrainingEvents, voidedTrainingEventIds } from '../trainingFold'
import type { AuditEvent } from '../auditTypes'

const USER = 'u1'
const ITEM = 'TEST-TASK-A'

let nextSeq = 0

function ev(
  id: string,
  eventType: AuditEvent['eventType'],
  payload: Record<string, unknown>,
  occurredAt = '2026-07-01T00:00:00.000Z',
): AuditEvent {
  return {
    id,
    seq: ++nextSeq,
    clinicId: 'c1',
    actorId: 'sup1',
    domain: 'training',
    eventType,
    subjectType: 'user',
    subjectId: USER,
    occurredAt,
    payload: { training_item_id: ITEM, ...payload },
  }
}

const graded = (id: string, at?: string) => ev(id, 'test.graded', { result: 'GO' }, at)
const read = (id: string, at?: string) => ev(id, 'read.recorded', {}, at)
const voided = (id: string, completion_type?: string, event_id?: string) =>
  ev(id, 'completion.voided', {
    ...(completion_type ? { completion_type } : {}),
    ...(event_id ? { event_id } : {}),
  })

describe('foldTrainingState', () => {
  it('replaces a grade and stacks reads', () => {
    const rows = foldTrainingState([
      graded('g1', '2026-07-01T00:00:00.000Z'),
      graded('g2', '2026-08-01T00:00:00.000Z'),
      read('r1'),
      read('r2'),
    ])
    const tests = rows.filter((r) => r.completionType === 'test')
    expect(tests).toHaveLength(1)
    expect(tests[0].updatedAt).toBe('2026-08-01T00:00:00.000Z')
    expect(rows.filter((r) => r.completionType === 'read')).toHaveLength(2)
  })
})

describe('voidedTrainingEventIds', () => {
  it('leaves a superseded grade live — a re-grade is work that happened', () => {
    const events = [graded('g1'), graded('g2')]
    expect(voidedTrainingEventIds(events).size).toBe(0)
    expect(liveTrainingEvents(events)).toHaveLength(2)
  })

  it('retires EVERY grade of the item on a typed void, superseded ones included', () => {
    // Matches purgeTrainingEventRows: deleting the record deletes the series
    // behind it, or the newest row's removal would resurrect an older grade.
    const events = [graded('g1'), graded('g2'), voided('v1', 'test')]
    const ids = voidedTrainingEventIds(events)
    expect([...ids].sort()).toEqual(['g1', 'g2'])
    expect(foldTrainingState(events).filter((r) => r.completionType === 'test')).toHaveLength(0)
    expect(liveTrainingEvents(events).map((e) => e.id)).toEqual(['v1'])
  })

  it('retires one rep when the void names an event, and leaves the others', () => {
    const events = [read('r1'), read('r2'), read('r3'), voided('v1', 'read', 'r2')]
    expect([...voidedTrainingEventIds(events)]).toEqual(['r2'])
    expect(foldTrainingState(events).filter((r) => r.completionType === 'read')).toHaveLength(2)
  })

  it('retires every rep when a read void names none — the calendar cascade', () => {
    const events = [read('r1'), read('r2'), voided('v1', 'read')]
    expect([...voidedTrainingEventIds(events)].sort()).toEqual(['r1', 'r2'])
  })

  it('retires the whole item when the void names no type', () => {
    const events = [read('r1'), graded('g1'), voided('v1')]
    expect([...voidedTrainingEventIds(events)].sort()).toEqual(['g1', 'r1'])
  })

  it('does not reach past itself — work re-recorded after a void stands', () => {
    const events = [graded('g1'), voided('v1', 'test'), graded('g2')]
    expect([...voidedTrainingEventIds(events)]).toEqual(['g1'])
    expect(foldTrainingState(events).filter((r) => r.completionType === 'test')).toHaveLength(1)
  })

  it('scopes a void to its own (subject, item)', () => {
    const other = { ...graded('g-other'), subjectId: 'u2' }
    const events = [graded('g1'), other, voided('v1', 'test')]
    expect([...voidedTrainingEventIds(events)]).toEqual(['g1'])
    expect(liveTrainingEvents(events).map((e) => e.id).sort()).toEqual(['g-other', 'v1'])
  })

  it('leaves events of other domains alone', () => {
    const property: AuditEvent = {
      ...ev('p1', 'item.transferred', {}),
      domain: 'property',
      payload: null,
    }
    const events = [property, graded('g1'), voided('v1', 'test')]
    expect(liveTrainingEvents(events).map((e) => e.id).sort()).toEqual(['p1', 'v1'])
  })
})
