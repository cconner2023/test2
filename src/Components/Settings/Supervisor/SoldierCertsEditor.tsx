import { useState, useCallback } from 'react'
import { X, Star, CheckCircle, Award } from 'lucide-react'
import { verifyCertification, unverifyCertification } from '../../../lib/certificationService'
import { formatMedicName, getExpirationStatus, certBadgeColors } from './supervisorHelpers'
import type { ClinicMedic } from '../../../Types/SupervisorTestTypes'
import type { Certification } from '../../../Data/User'

interface SoldierCertsEditorProps {
  soldier: ClinicMedic
  certs: Certification[]
  currentUserId: string
  resolveName: (id: string | null) => string
  onUpdateCert: (certId: string, updates: Partial<Certification>) => void
}

export function SoldierCertsEditor({
  soldier,
  certs,
  currentUserId,
  resolveName,
  onUpdateCert,
}: SoldierCertsEditorProps) {
  const [expandedCertId, setExpandedCertId] = useState<string | null>(null)

  const handleVerify = useCallback(async (certId: string) => {
    const result = await verifyCertification(certId, currentUserId)
    if (result.success) {
      onUpdateCert(certId, {
        verified: true,
        verified_by: currentUserId,
        verified_at: new Date().toISOString(),
      })
    }
  }, [currentUserId, onUpdateCert])

  const handleUnverify = useCallback(async (certId: string) => {
    const result = await unverifyCertification(certId)
    if (result.success) {
      onUpdateCert(certId, {
        verified: false,
        verified_by: null,
        verified_at: null,
      })
    }
  }, [onUpdateCert])

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <p className="text-lg font-semibold text-primary">{formatMedicName(soldier)}</p>
        <p className="text-xs text-tertiary/50 mt-0.5">Certification Management</p>
      </div>

      {certs.length === 0 ? (
        <div className="text-center py-12">
          <Award size={28} className="mx-auto mb-3 text-tertiary/30" />
          <p className="text-sm text-tertiary/60">No certifications on file</p>
        </div>
      ) : (
        <div className="space-y-3">
          {certs.map((cert) => {
            const status = getExpirationStatus(cert.exp_date)
            const color = certBadgeColors[status]
            const isExpanded = expandedCertId === cert.id
            const verifierName = cert.verified_by ? resolveName(cert.verified_by) : null

            return (
              <div key={cert.id} className="rounded-lg border border-tertiary/10 bg-themewhite2 overflow-hidden">
                <button
                  onClick={() => setExpandedCertId(isExpanded ? null : cert.id)}
                  className="flex items-center w-full px-4 py-3 text-left hover:bg-themewhite2/80 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-primary">{cert.title}</p>
                      {cert.is_primary && <Star size={11} className="text-themeyellow fill-themeyellow shrink-0" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border ${color}`}>
                        {status === 'valid' ? 'Valid' : status === 'expiring' ? 'Expiring' : status === 'expired' ? 'Expired' : 'No Date'}
                      </span>
                      {cert.verified && (
                        <span className="flex items-center gap-0.5 text-[9pt] text-themegreen"><CheckCircle size={10} /> Verified</span>
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-tertiary/10">
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-tertiary/60">
                      {cert.cert_number && <div>Cert #: <span className="text-primary">{cert.cert_number}</span></div>}
                      {cert.issue_date && <div>Issued: <span className="text-primary">{new Date(cert.issue_date + 'T00:00:00').toLocaleDateString()}</span></div>}
                      {cert.exp_date && <div>Expires: <span className="text-primary">{new Date(cert.exp_date + 'T00:00:00').toLocaleDateString()}</span></div>}
                    </div>

                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-tertiary/5">
                      {cert.verified ? (
                        <>
                          <span className="flex items-center gap-1 text-xs text-themegreen font-medium"><CheckCircle size={11} /> Verified</span>
                          {verifierName && <span className="text-[8pt] text-tertiary/40">by {verifierName}</span>}
                          {cert.verified_at && <span className="text-[8pt] text-tertiary/40">{new Date(cert.verified_at).toLocaleDateString()}</span>}
                          <button onClick={() => handleUnverify(cert.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-themeredred/10 text-themeredred
                                       hover:bg-themeredred/20 transition-colors ml-auto">
                            Unverify
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-tertiary/50">Unverified</span>
                          <button onClick={() => handleVerify(cert.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium
                                       bg-themeblue3 text-white hover:bg-themeblue3/90 transition-colors ml-auto">
                            <CheckCircle size={11} /> Verify
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
