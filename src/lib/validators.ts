import { type Result, ok, err } from './result'
import { ErrorCode } from './errorCodes'

export function isNonNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined
}

export function hasFields<T extends Record<string, unknown>>(
  value: unknown,
  fields: string[]
): value is T {
  if (typeof value !== 'object' || value === null) return false
  const obj = value as Record<string, unknown>
  return fields.every((f) => f in obj)
}

export function validateRpcResult<T>(
  data: unknown,
  requiredFields: string[],
  label: string
): Result<T> {
  if (!isNonNull(data)) {
    return err(`${label}: received null or undefined`, ErrorCode.RPC_ERROR)
  }
  if (typeof data !== 'object') {
    return err(`${label}: expected object, got ${typeof data}`, ErrorCode.RPC_ERROR)
  }
  if (!hasFields<Record<string, unknown>>(data, requiredFields)) {
    const missing = requiredFields.filter((f) => !(f in (data as Record<string, unknown>)))
    return err(
      `${label}: missing fields: ${missing.join(', ')}`,
      ErrorCode.VALIDATION_FAILED
    )
  }
  return ok(data as T)
}

/**
 * Validate that each element of an RPC array result has the required fields.
 * Returns the array as T[] on success; fails fast on the first bad row.
 */
export function validateRpcArray<T>(
  data: unknown,
  requiredFields: string[],
  label: string
): Result<T[]> {
  if (!Array.isArray(data)) {
    return err(`${label}: expected array, got ${typeof data}`, ErrorCode.RPC_ERROR)
  }
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (typeof row !== 'object' || row === null) {
      return err(`${label}[${i}]: expected object, got ${typeof row}`, ErrorCode.RPC_ERROR)
    }
    if (!hasFields<Record<string, unknown>>(row, requiredFields)) {
      const missing = requiredFields.filter((f) => !(f in (row as Record<string, unknown>)))
      return err(
        `${label}[${i}]: missing fields: ${missing.join(', ')}`,
        ErrorCode.VALIDATION_FAILED
      )
    }
  }
  return ok(data as T[])
}
