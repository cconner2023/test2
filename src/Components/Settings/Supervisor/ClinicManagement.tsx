import { useEffect, useRef, useState } from 'react'
import { Building2, ChevronRight, MapPin } from 'lucide-react'
import bwipjs from 'bwip-js'

export interface ClinicCardData {
  id: string
  name: string
  personnelCount: number
  uics: string[]
  location: string | null
  activeCode: string | null
}

interface ClinicCardProps {
  clinic: ClinicCardData
  onSelect: (clinicId: string) => void
}

function ClinicCard({ clinic, onSelect }: ClinicCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [qrReady, setQrReady] = useState(false)

  useEffect(() => {
    if (!clinic.activeCode) { setQrReady(false); return }
    const render = () => {
      if (!canvasRef.current) return
      try {
        bwipjs.toCanvas(canvasRef.current, {
          bcid: 'qrcode',
          text: clinic.activeCode!,
          scale: 3,
          padding: 2,
        })
        setQrReady(true)
      } catch {
        // QR render failure is non-critical
      }
    }
    requestAnimationFrame(render)
  }, [clinic.activeCode])

  return (
    <button
      onClick={() => onSelect(clinic.id)}
      className="w-full rounded-xl bg-themewhite2 px-4 py-3 text-left active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-tertiary/10">
          <Building2 size={18} className="text-tertiary/50" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary truncate">{clinic.name}</p>
          <p className="text-[9pt] text-tertiary/50">{clinic.personnelCount} personnel</p>
          {clinic.uics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {clinic.uics.map(uic => (
                <span
                  key={uic}
                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border bg-themeyellow/10 text-themeyellow border-themeyellow/30"
                >
                  {uic}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className={`shrink-0 rounded-lg bg-white p-1.5 ${qrReady ? '' : 'hidden'}`}>
          <canvas ref={canvasRef} className="w-16 h-16 rounded" />
        </div>
        {!qrReady && <ChevronRight size={16} className="text-tertiary/40 shrink-0" />}
      </div>
      {clinic.location && (
        <div className="flex items-center gap-1.5 mt-2 ml-13">
          <MapPin size={12} className="text-tertiary/40 shrink-0" />
          <span className="text-[9pt] text-tertiary/50 truncate">{clinic.location}</span>
        </div>
      )}
    </button>
  )
}

interface ClinicManagementProps {
  clinics: ClinicCardData[]
  onSelect: (clinicId: string) => void
}

export function ClinicManagement({ clinics, onSelect }: ClinicManagementProps) {
  return (
    <div className="space-y-2">
      {clinics.map(clinic => (
        <ClinicCard key={clinic.id} clinic={clinic} onSelect={onSelect} />
      ))}
    </div>
  )
}
