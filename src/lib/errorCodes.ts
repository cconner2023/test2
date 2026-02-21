export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  RATE_LIMITED = 'RATE_LIMITED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  NOT_FOUND = 'NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export function classifySupabaseError(error: { message: string; code?: string }): ErrorCode {
  const msg = error.message.toLowerCase()
  const code = error.code ?? ''

  if (
    msg.includes('too many pending requests') ||
    msg.includes('rate limit') ||
    code === '429'
  ) {
    return ErrorCode.RATE_LIMITED
  }

  if (
    msg.includes('jwt expired') ||
    msg.includes('not authenticated') ||
    msg.includes('invalid claim') ||
    code === 'PGRST301' ||
    code === '401'
  ) {
    return ErrorCode.AUTH_REQUIRED
  }

  if (
    msg.includes('permission denied') ||
    msg.includes('insufficient privilege') ||
    msg.includes('new row violates row-level security') ||
    code === '42501' ||
    code === '403'
  ) {
    return ErrorCode.PERMISSION_DENIED
  }

  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('timeout')
  ) {
    return ErrorCode.NETWORK_ERROR
  }

  if (
    msg.includes('not found') ||
    msg.includes('no rows') ||
    code === 'PGRST116'
  ) {
    return ErrorCode.NOT_FOUND
  }

  if (
    msg.includes('check constraint') ||
    msg.includes('violates') ||
    msg.includes('invalid input') ||
    code === '23514' ||
    code === '23505' ||
    code === '22P02'
  ) {
    return ErrorCode.VALIDATION_FAILED
  }

  return ErrorCode.UNKNOWN
}
