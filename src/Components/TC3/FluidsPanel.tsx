import { memo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'
import type { MedRoute } from '../../Types/TC3Types'

const ROUTE_OPTIONS: MedRoute[] = ['IV', 'IO']

const COMMON_FLUIDS = [
  { type: 'Normal Saline', volume: '1000mL' },
  { type: 'Lactated Ringers', volume: '1000mL' },
  { type: 'Hextend', volume: '500mL' },
  { type: 'Plasma-Lyte', volume: '1000mL' },
]

const COMMON_BLOOD = [
  { type: 'Whole Blood', volume: '1 unit' },
  { type: 'pRBC', volume: '1 unit' },
  { type: 'FFP', volume: '1 unit' },
  { type: 'Platelets', volume: '1 unit' },
]

export const FluidsPanel = memo(function FluidsPanel() {
  const fluids = useTC3Store((s) => s.card.march.circulation.fluids)
  const bloodProducts = useTC3Store((s) => s.card.march.circulation.bloodProducts)
  const ivAccess = useTC3Store((s) => s.card.march.circulation.ivAccess)
  const addFluid = useTC3Store((s) => s.addFluid)
  const removeFluid = useTC3Store((s) => s.removeFluid)
  const addBloodProduct = useTC3Store((s) => s.addBloodProduct)
  const removeBloodProduct = useTC3Store((s) => s.removeBloodProduct)
  const addIVAccess = useTC3Store((s) => s.addIVAccess)
  const removeIVAccess = useTC3Store((s) => s.removeIVAccess)

  const [showFluidAdd, setShowFluidAdd] = useState(false)
  const [showBloodAdd, setShowBloodAdd] = useState(false)

  const handleAddFluid = (type: string, volume: string) => {
    addFluid({
      type,
      volume,
      route: 'IV' as MedRoute,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    })
    setShowFluidAdd(false)
  }

  const handleAddBlood = (type: string, volume: string) => {
    addBloodProduct({
      type,
      volume,
      route: 'IV' as MedRoute,
      time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    })
    setShowBloodAdd(false)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Fluids & Blood Products</h3>
        <p className="text-[11px] text-tertiary/70">DD 1380 — Name / Volume / Route / Time</p>
      </div>

      {/* IV/IO Access */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">IV/IO Access</p>
        {ivAccess.map((iv) => (
          <div key={iv.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <select
              value={iv.type}
              onChange={(e) => {
                const updated = { ...iv, type: e.target.value as 'IV' | 'IO' }
                removeIVAccess(iv.id)
                addIVAccess(updated)
              }}
              className="text-xs bg-transparent border border-tertiary/20 rounded px-1.5 py-1 outline-none text-tertiary"
            >
              {ROUTE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-xs text-tertiary">{iv.site || 'Site N/A'}</span>
            <span className="text-xs text-tertiary/60">{iv.gauge}</span>
            <button onClick={() => removeIVAccess(iv.id)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addIVAccess({ id: crypto.randomUUID(), type: 'IV', site: '', gauge: '18g' })}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add IV/IO</span>
        </button>
      </div>

      {/* Fluids */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Fluids</p>
        {fluids.map((f, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <div className="flex-1 min-w-0 grid grid-cols-4 gap-1 items-center">
              <span className="text-xs font-medium text-primary truncate">{f.type}</span>
              <span className="text-xs text-tertiary/70">{f.volume}</span>
              <span className="text-xs text-tertiary/70">{f.route}</span>
              <span className="text-[10px] text-tertiary/60">{f.time}</span>
            </div>
            <button onClick={() => removeFluid(i)} className="p-1 hover:bg-themeredred/10 rounded transition-colors shrink-0">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        {showFluidAdd ? (
          <div className="space-y-2 px-3 py-2 rounded-lg border border-themeredred/20 bg-themeredred/5">
            <p className="text-[10px] font-semibold text-tertiary/50">Quick select:</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_FLUIDS.map((f, i) => (
                <button
                  key={i}
                  onClick={() => handleAddFluid(f.type, f.volume)}
                  className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
                >
                  {f.type} {f.volume}
                </button>
              ))}
            </div>
            <button onClick={() => setShowFluidAdd(false)} className="text-[10px] text-tertiary hover:text-tertiary/80">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowFluidAdd(true)}
            className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
          >
            <Plus size={14} /> <span>Add Fluid</span>
          </button>
        )}
      </div>

      {/* Blood Products */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Blood Products</p>
        {bloodProducts.map((b, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <div className="flex-1 min-w-0 grid grid-cols-4 gap-1 items-center">
              <span className="text-xs font-medium text-primary truncate">{b.type}</span>
              <span className="text-xs text-tertiary/70">{b.volume}</span>
              <span className="text-xs text-tertiary/70">{b.route}</span>
              <span className="text-[10px] text-tertiary/60">{b.time}</span>
            </div>
            <button onClick={() => removeBloodProduct(i)} className="p-1 hover:bg-themeredred/10 rounded transition-colors shrink-0">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        {showBloodAdd ? (
          <div className="space-y-2 px-3 py-2 rounded-lg border border-themeredred/20 bg-themeredred/5">
            <p className="text-[10px] font-semibold text-tertiary/50">Quick select:</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_BLOOD.map((b, i) => (
                <button
                  key={i}
                  onClick={() => handleAddBlood(b.type, b.volume)}
                  className="px-2.5 py-1.5 text-[11px] rounded-lg border border-tertiary/15 bg-themewhite text-tertiary hover:bg-themeredred/5 hover:border-themeredred/20 transition-all"
                >
                  {b.type} {b.volume}
                </button>
              ))}
            </div>
            <button onClick={() => setShowBloodAdd(false)} className="text-[10px] text-tertiary hover:text-tertiary/80">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowBloodAdd(true)}
            className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
          >
            <Plus size={14} /> <span>Add Blood Product</span>
          </button>
        )}
      </div>
    </div>
  )
})
