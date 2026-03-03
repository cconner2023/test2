/**
 * Tests for result.ts — covers ok/err constructors, getErrorMessage,
 * callRpc success/error/exception paths, fromSupabase, and ServiceResult helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ok,
  err,
  fromSupabase,
  getErrorMessage,
  callRpc,
  succeed,
  fail,
} from '../result'
import type { Result, ServiceResult } from '../result'

// ═════════════════════════════════════════════════════════════════════════
// 1. ok / err constructors
// ═════════════════════════════════════════════════════════════════════════

describe('ok / err constructors', () => {
  it('ok wraps data', () => {
    const r = ok(42)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toBe(42)
  })

  it('ok works with objects', () => {
    const r = ok({ id: 'abc', name: 'test' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data.id).toBe('abc')
      expect(r.data.name).toBe('test')
    }
  })

  it('ok works with arrays', () => {
    const r = ok([1, 2, 3])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual([1, 2, 3])
  })

  it('ok works with void (undefined)', () => {
    const r = ok(undefined)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toBeUndefined()
  })

  it('err wraps error string', () => {
    const r = err('something went wrong')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('something went wrong')
      expect(r.code).toBeUndefined()
    }
  })

  it('err includes optional code', () => {
    const r = err('not found', '404')
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('not found')
      expect(r.code).toBe('404')
    }
  })

  it('err without code omits code property', () => {
    const r = err('fail')
    expect(r.ok).toBe(false)
    if (!r.ok) expect('code' in r).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2. fromSupabase
// ═════════════════════════════════════════════════════════════════════════

describe('fromSupabase', () => {
  it('returns ok when data is present and no error', () => {
    const r = fromSupabase({ data: { id: 1 }, error: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data).toEqual({ id: 1 })
  })

  it('returns err when error is present', () => {
    const r = fromSupabase({ data: null, error: { message: 'RLS violation', code: '42501' } })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.error).toBe('RLS violation')
      expect(r.code).toBe('42501')
    }
  })

  it('returns err when data is null and no error', () => {
    const r = fromSupabase({ data: null, error: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('No data returned')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 3. getErrorMessage
// ═════════════════════════════════════════════════════════════════════════

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('oops'))).toBe('oops')
  })

  it('extracts message from TypeError', () => {
    expect(getErrorMessage(new TypeError('bad type'))).toBe('bad type')
  })

  it('returns string directly when given a string', () => {
    expect(getErrorMessage('some string')).toBe('some string')
  })

  it('returns "Unknown error" for number', () => {
    expect(getErrorMessage(42)).toBe('Unknown error')
  })

  it('returns "Unknown error" for null', () => {
    expect(getErrorMessage(null)).toBe('Unknown error')
  })

  it('returns "Unknown error" for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unknown error')
  })

  it('returns "Unknown error" for plain object', () => {
    expect(getErrorMessage({ message: 'sneaky' })).toBe('Unknown error')
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 4. callRpc
// ═════════════════════════════════════════════════════════════════════════

describe('callRpc', () => {
  const mockLogger = { error: vi.fn() }

  beforeEach(() => {
    mockLogger.error.mockClear()
  })

  it('returns ok with data on successful query', async () => {
    const operation = async () => ({ data: { id: 'abc' }, error: null })
    const result = await callRpc<{ id: string }>(operation, 'test', mockLogger)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data.id).toBe('abc')
    expect(mockLogger.error).not.toHaveBeenCalled()
  })

  it('returns ok with fallback when data is null', async () => {
    const operation = async () => ({ data: null, error: null })
    const result = await callRpc<string[]>(operation, 'test', mockLogger, [])
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual([])
  })

  it('returns err on Supabase error', async () => {
    const operation = async () => ({
      data: null,
      error: { message: 'RLS denied', code: '42501' },
    })
    const result = await callRpc(operation, 'myLabel', mockLogger)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('RLS denied')
      expect(result.code).toBe('42501')
    }
    expect(mockLogger.error).toHaveBeenCalledWith('myLabel error:', 'RLS denied')
  })

  it('returns err on thrown Error', async () => {
    const operation = async () => { throw new Error('network down') }
    const result = await callRpc(operation, 'testOp', mockLogger)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('network down')
    expect(mockLogger.error).toHaveBeenCalledWith('testOp exception:', 'network down')
  })

  it('returns err with string message on thrown non-Error string', async () => {
    const operation = async () => { throw 'string error' }
    const result = await callRpc(operation, 'testOp', mockLogger)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('string error')
  })

  it('error object without code omits code in result', async () => {
    const operation = async () => ({
      data: null,
      error: { message: 'bad request' } as { message: string; code?: string },
    })
    const result = await callRpc(operation, 'test', mockLogger)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBeUndefined()
  })

  it('returns data as typed generic', async () => {
    interface User { name: string; age: number }
    const operation = async () => ({ data: { name: 'Alice', age: 30 }, error: null })
    const result = await callRpc<User>(operation, 'test', mockLogger)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.name).toBe('Alice')
      expect(result.data.age).toBe(30)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 5. succeed / fail (ServiceResult helpers)
// ═════════════════════════════════════════════════════════════════════════

describe('succeed / fail', () => {
  it('succeed() returns { success: true }', () => {
    const r = succeed()
    expect(r.success).toBe(true)
  })

  it('succeed(extra) merges extra fields', () => {
    const r = succeed({ userId: 'abc', count: 3 })
    expect(r.success).toBe(true)
    expect(r.userId).toBe('abc')
    expect(r.count).toBe(3)
  })

  it('fail returns { success: false, error }', () => {
    const r = fail('something broke')
    expect(r.success).toBe(false)
    expect(r.error).toBe('something broke')
  })
})
