import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Camera,
  ImagePlus,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Building2,
  RefreshCw,
} from 'lucide-react'
import bwipjs from 'bwip-js'
import { useClinicInvites } from '../../Hooks/useClinicInvites'
import { useAuth } from '../../Hooks/useAuth'
import { useBarcodeScanner } from '../../Hooks/useBarcodeScanner'
import { HeaderPill, PillButton } from '../HeaderPill'
import { ActionIconButton } from '../WriteNoteHelpers'
import { ErrorDisplay } from '../ErrorDisplay'
import { EmptyState } from '../EmptyState'
import { ConfirmDialog } from '../ConfirmDialog'

interface ClinicAssociationPanelProps {
  onBack?: () => void
}

const inputBase =
  'w-full px-3 py-2.5 rounded-lg text-primary text-base border border-tertiary/10 bg-themewhite dark:bg-themewhite3 focus-within:border-themeblue1/30 focus-within:bg-themewhite2 focus:outline-none transition-all placeholder:text-tertiary/30'

export function ClinicAssociationPanel({ onBack }: ClinicAssociationPanelProps) {
  const { clinicId, profile } = useAuth()
  const {
    invites,
    error: hookError,
    activeCode,
    activeExpiresAt,
    redeemInvite,
    approveInvite,
    rejectInvite,
    emergencyAssociate,
  } = useClinicInvites()

  // QR canvas
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Join section state
  const [joinCode, setJoinCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeemSuccess, setRedeemSuccess] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isScanning, error: scanError, result: scanResult, startScanning, stopScanning, clearResult } =
    useBarcodeScanner()

  // Action state
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  // Emergency section state
  const [emergencyOpen, setEmergencyOpen] = useState(false)
  const [emergencyClinicId, setEmergencyClinicId] = useState('')
  const [emergencyJustification, setEmergencyJustification] = useState('')
  const [emergencyConfirmVisible, setEmergencyConfirmVisible] = useState(false)
  const [emergencyProcessing, setEmergencyProcessing] = useState(false)
  const [emergencyError, setEmergencyError] = useState<string | null>(null)

  // QR code rendering — redraws when the active code changes
  useEffect(() => {
    if (!activeCode || !canvasRef.current) return
    try {
      bwipjs.toCanvas(canvasRef.current, {
        bcid: 'qrcode',
        text: activeCode,
        scale: 3,
        padding: 2,
      })
    } catch {
      // QR render failure is non-critical
    }
  }, [activeCode])

  // Auto-redeem scanned code
  useEffect(() => {
    if (!scanResult) return
    setScanning(false)
    stopScanning()
    handleRedeem(scanResult)
    clearResult()
  }, [scanResult]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleCopy = useCallback(async () => {
    if (!activeCode) return
    await navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2_000)
  }, [activeCode])

  const handleRedeem = useCallback(
    async (code: string) => {
      const trimmed = code.trim().toUpperCase()
      if (!trimmed) return
      setRedeeming(true)
      setRedeemError(null)
      setRedeemSuccess(null)
      const result = await redeemInvite(trimmed)
      if (result.success) {
        setRedeemSuccess(`Connected with ${result.clinicName}`)
        setJoinCode('')
      } else {
        setRedeemError(result.error)
      }
      setRedeeming(false)
    },
    [redeemInvite],
  )

  const handleToggleScan = useCallback(() => {
    if (scanning) {
      setScanning(false)
      stopScanning()
    } else {
      setScanning(true)
      requestAnimationFrame(() => {
        if (videoRef.current) startScanning(videoRef.current)
      })
    }
  }, [scanning, startScanning, stopScanning])

  const handlePhotoUpload = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/library')
        const reader = new BrowserMultiFormatReader()
        const img = document.createElement('img')
        const url = URL.createObjectURL(file)
        img.src = url
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Failed to load image'))
        })
        const result = await reader.decodeFromImage(img)
        URL.revokeObjectURL(url)
        if (result) {
          handleRedeem(result.getText())
        } else {
          setRedeemError('No code found in image')
        }
      } catch {
        setRedeemError('Could not read code from image')
      }
    },
    [handleRedeem],
  )

  const handleApprove = useCallback(
    async (inviteId: string) => {
      setProcessingInviteId(inviteId)
      setActionError(null)
      const result = await approveInvite(inviteId)
      if (result.success) {
        setActionSuccess('Association approved')
        setTimeout(() => setActionSuccess(null), 3_000)
      } else {
        setActionError(result.error)
      }
      setProcessingInviteId(null)
    },
    [approveInvite],
  )

  const handleReject = useCallback(
    async (inviteId: string) => {
      setProcessingInviteId(inviteId)
      setActionError(null)
      const result = await rejectInvite(inviteId)
      if (result.success) {
        setActionSuccess('Association rejected')
        setTimeout(() => setActionSuccess(null), 3_000)
      } else {
        setActionError(result.error)
      }
      setProcessingInviteId(null)
    },
    [rejectInvite],
  )

  const handleEmergencySubmit = useCallback(async () => {
    setEmergencyConfirmVisible(false)
    setEmergencyProcessing(true)
    setEmergencyError(null)
    const result = await emergencyAssociate(emergencyClinicId.trim(), emergencyJustification.trim())
    if (result.success) {
      setEmergencyClinicId('')
      setEmergencyJustification('')
      setEmergencyOpen(false)
      setActionSuccess('Emergency association created')
      setTimeout(() => setActionSuccess(null), 3_000)
    } else {
      setEmergencyError(result.error)
    }
    setEmergencyProcessing(false)
  }, [emergencyAssociate, emergencyClinicId, emergencyJustification])

  const associatedClinics = invites.filter((i) => i.status === 'accepted')
  const inboundPending = invites.filter(
    (i) => i.status === 'redeemed' && i.clinic_id === clinicId,
  )

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        {hookError && <ErrorDisplay message={hookError} />}
        {actionSuccess && <ErrorDisplay type="success" message={actionSuccess} />}
        {actionError && <ErrorDisplay message={actionError} />}

        {/* Facility Card — clinic identity with ever-present QR */}
        <section className="rounded-xl bg-themewhite2 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
              <Building2 size={18} className="text-tertiary/50" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary truncate">
                {profile.clinicName || <span className="text-tertiary/30 italic">No facility</span>}
              </p>
              <p className="text-[9pt] text-tertiary/50">{profile.uic || 'No UIC'}</p>
              {activeCode && (
                <div className="flex items-center gap-1 mt-1">
                  <p className="text-[13px] font-mono tracking-[0.3em] text-tertiary/70 select-all">{activeCode}</p>
                  <ActionIconButton
                    onClick={handleCopy}
                    status={copied ? 'done' : 'idle'}
                    variant="copy"
                    title="Copy code"
                  />
                </div>
              )}
            </div>

            {/* QR — fixed size, white backdrop, vertically centered */}
            {activeCode && (
              <div className="shrink-0 rounded-lg bg-white p-1.5">
                <canvas ref={canvasRef} className="w-16 h-16 rounded" />
              </div>
            )}
          </div>
        </section>

        {/* Join a Clinic */}
        <section>
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Join a Clinic
          </h3>

          <div className="relative">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 8))}
              onKeyDown={(e) => { if (e.key === 'Enter' && joinCode.length > 0) handleRedeem(joinCode) }}
              placeholder="Enter invite code"
              maxLength={8}
              className={`${inputBase} !rounded-full pr-22 font-mono tracking-[0.15em] placeholder:font-sans placeholder:tracking-normal`}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
              <button
                type="button"
                onClick={handleToggleScan}
                className="p-2 rounded-full text-tertiary/40 hover:text-primary hover:bg-themewhite3 transition-colors active:scale-95"
                title="Scan QR code"
              >
                <Camera size={18} />
              </button>
              <button
                type="button"
                onClick={handlePhotoUpload}
                className="p-2 rounded-full text-tertiary/40 hover:text-primary hover:bg-themewhite3 transition-colors active:scale-95"
                title="Upload QR photo"
              >
                <ImagePlus size={18} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {scanning && (
            <div className="mt-3 relative w-full aspect-[4/3] rounded-lg overflow-hidden bg-black/5 border border-tertiary/10">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              {!isScanning && !scanError && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-xs text-tertiary">Starting camera...</p>
                </div>
              )}
            </div>
          )}

          {joinCode.length > 0 && (
            <button
              onClick={() => handleRedeem(joinCode)}
              disabled={redeeming}
              className={`mt-3 w-full py-2.5 rounded-lg bg-themeblue3 text-white text-sm font-medium
                active:scale-95 transition-all ${redeeming ? 'opacity-60' : ''}`}
            >
              {redeeming ? 'Connecting...' : 'Submit Code'}
            </button>
          )}

          {scanError && <ErrorDisplay message={scanError} className="mt-2" />}
          {redeemError && <ErrorDisplay message={redeemError} className="mt-2" />}
          {redeemSuccess && <ErrorDisplay type="success" message={redeemSuccess} className="mt-2" />}
        </section>

        {/* Inbound approval requests — shown inline only when they exist */}
        {inboundPending.length > 0 && (
          <section className="space-y-2">
            {inboundPending.map((invite) => (
              <div
                key={invite.id}
                className="rounded-xl border border-themeyellow/30 bg-themeyellow/5 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-4 h-4 text-tertiary shrink-0" />
                  <span className="text-sm font-medium text-primary">
                    {invite.peer_clinic_name ?? 'Unknown clinic'}
                  </span>
                  <span className="text-xs text-themeyellow font-medium ml-auto">
                    wants to connect
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <HeaderPill>
                    <PillButton
                      icon={Check}
                      onClick={() => handleApprove(invite.id)}
                      label="Approve"
                      compact
                    />
                  </HeaderPill>
                  <HeaderPill>
                    <PillButton
                      icon={AlertTriangle}
                      onClick={() => handleReject(invite.id)}
                      label="Reject"
                      variant="danger"
                      compact
                    />
                  </HeaderPill>
                  {processingInviteId === invite.id && (
                    <RefreshCw className="w-4 h-4 text-tertiary/40 animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Associated Clinics */}
        <section>
          <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
            Associated Clinics
          </h3>

          {associatedClinics.length === 0 ? (
            <EmptyState
              icon={<Building2 className="w-10 h-10" />}
              title="No associated clinics"
              subtitle="Approved connections will appear here"
            />
          ) : (
            <div className="space-y-2">
              {associatedClinics.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-xl border border-primary/10 bg-themewhite p-4"
                >
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-tertiary" />
                    <span className="text-sm font-medium text-primary">
                      {invite.clinic_id === clinicId
                        ? invite.peer_clinic_name
                        : invite.clinic_name}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-themegreen/10 text-themegreen text-[10px] font-medium">
                    Connected
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Emergency Connect */}
        <section>
          <button
            onClick={() => setEmergencyOpen((prev) => !prev)}
            className="w-full flex items-center justify-between rounded-xl bg-themeredred/5 border
              border-themeredred/20 px-4 py-3 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-themeredred" />
              <span className="text-sm font-semibold text-themeredred">Emergency Connect</span>
            </div>
            {emergencyOpen ? (
              <ChevronUp className="w-4 h-4 text-themeredred" />
            ) : (
              <ChevronDown className="w-4 h-4 text-themeredred" />
            )}
          </button>

          {emergencyOpen && (
            <div className="mt-2 rounded-xl bg-themeredred/5 border border-themeredred/20 p-4 space-y-3">
              <p className="text-xs text-tertiary">
                Bypass the invite flow for urgent cross-clinic coordination. This action is logged
                and auditable.
              </p>

              <div>
                <label className="text-xs font-medium text-secondary mb-1 block">
                  Peer Clinic ID
                </label>
                <input
                  type="text"
                  value={emergencyClinicId}
                  onChange={(e) => setEmergencyClinicId(e.target.value)}
                  placeholder="UUID of the target clinic"
                  className={`${inputBase} !border-themeredred/20 focus-within:!border-themeredred/40`}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-secondary mb-1 block">
                  Justification
                </label>
                <textarea
                  value={emergencyJustification}
                  onChange={(e) => setEmergencyJustification(e.target.value)}
                  placeholder="Explain the emergency need (min 10 characters)"
                  rows={3}
                  className={`${inputBase} resize-none !border-themeredred/20 focus-within:!border-themeredred/40`}
                />
                <p className="text-[10px] text-tertiary/50 text-right mt-0.5">
                  {emergencyJustification.length} / 10 min
                </p>
              </div>

              <button
                onClick={() => setEmergencyConfirmVisible(true)}
                disabled={
                  emergencyProcessing ||
                  emergencyClinicId.trim().length === 0 ||
                  emergencyJustification.trim().length < 10
                }
                className={`w-full py-3 rounded-xl bg-themeredred text-white text-sm font-medium
                  active:scale-95 transition-all
                  ${
                    emergencyProcessing ||
                    emergencyClinicId.trim().length === 0 ||
                    emergencyJustification.trim().length < 10
                      ? 'opacity-60'
                      : ''
                  }`}
              >
                {emergencyProcessing ? 'Connecting...' : 'Emergency Connect'}
              </button>

              {emergencyError && <ErrorDisplay message={emergencyError} />}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        visible={emergencyConfirmVisible}
        title="Emergency Association"
        subtitle="This will immediately connect your clinic without their approval. This action is logged and auditable."
        variant="danger"
        confirmLabel="Connect Now"
        processing={emergencyProcessing}
        onConfirm={handleEmergencySubmit}
        onCancel={() => setEmergencyConfirmVisible(false)}
      />
    </div>
  )
}
