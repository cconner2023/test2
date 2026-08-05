/**
 * certificationCsv -- the clinic's credential roster as a spreadsheet.
 *
 * NO DATE WINDOW, unlike the training-completion export. A completion is an event
 * and the question asked of it is "what happened between these dates"; a
 * certification is a STATE, and the question asked of it is "what does the unit
 * hold right now". Bounding state by a date range would drop every cert issued
 * before the window and answer a question nobody asked.
 *
 * Expired rows are INCLUDED and labelled, again unlike the completions export
 * (which drops NO_GO rather than let a failure read as a pass in a sheet titled
 * completions). Here the lapse IS the finding — a roster that silently omitted
 * expired cards would report a unit as covered.
 *
 * Operational only: title, number, dates, status, verification. No PHI, nothing
 * that is not already on the row a supervisor reads on screen.
 */

import { getExpirationStatus, statusLabel } from '../Components/Certifications/certHelpers'
import type { Certification } from '../Data/User'

export interface CertificationExportRow {
  soldier: string
  certification: string
  certNumber: string
  issued: string
  expires: string
  status: string
  verified: string
}

export interface CertificationExportOptions {
  /** Resolve a userId to the display name written in the Soldier column. */
  resolveName: (userId: string) => string
  /** Resolve the verifier's userId for the Verified column. */
  resolveVerifier?: (userId: string | null) => string
}

export function buildCertificationExportRows(
  certs: Certification[],
  options: CertificationExportOptions,
): CertificationExportRow[] {
  const { resolveName, resolveVerifier } = options

  const rows = certs.map<CertificationExportRow>(c => ({
    soldier: resolveName(c.user_id),
    certification: c.title.trim(),
    certNumber: c.cert_number ?? '',
    issued: c.issue_date ?? '',
    expires: c.exp_date ?? '',
    status: statusLabel(getExpirationStatus(c.exp_date)).text,
    verified: c.verified
      ? (resolveVerifier?.(c.verified_by) ?? 'Yes')
      : 'No',
  }))

  return rows.sort((a, b) =>
    a.soldier.localeCompare(b.soldier)
    || a.certification.localeCompare(b.certification),
  )
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function generateCertificationCsv(rows: CertificationExportRow[]): string {
  return [
    ['Soldier', 'Certification', 'Cert #', 'Issued', 'Expires', 'Status', 'Verified'],
    ...rows.map(r => [r.soldier, r.certification, r.certNumber, r.issued, r.expires, r.status, r.verified]),
  ]
    .map(cols => cols.map(csvCell).join(','))
    .join('\r\n')
}

/** `certifications-<stem>-20260804.csv`, filesystem-safe. The date is when it was
 *  pulled, because that is the only date a state export has. */
export function certificationCsvFilename(stem: string, pulledOn: Date = new Date()): string {
  const slug = stem.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
  const y = pulledOn.getFullYear()
  const m = `${pulledOn.getMonth() + 1}`.padStart(2, '0')
  const d = `${pulledOn.getDate()}`.padStart(2, '0')
  return `certifications-${slug}-${y}${m}${d}.csv`
}

/** Share or download the roster as a .csv — Web Share where the platform takes
 *  files (iOS Safari), anchor download otherwise. Mirrors
 *  shareTrainingCompletionCsv. */
export async function shareCertificationCsv(
  rows: CertificationExportRow[],
  filename: string,
): Promise<void> {
  const csv = generateCertificationCsv(rows)
  // BOM so Excel reads UTF-8 names correctly.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })

  if (
    typeof navigator !== 'undefined'
    && navigator.share
    && navigator.canShare?.({ files: [new File([blob], filename, { type: blob.type })] })
  ) {
    const file = new File([blob], filename, { type: blob.type })
    await navigator.share({ files: [file], title: 'Certifications' })
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
