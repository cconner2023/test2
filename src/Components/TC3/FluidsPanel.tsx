import { memo } from 'react'
import { Plus, X } from 'lucide-react'
import { useTC3Store } from '../../stores/useTC3Store'

export const FluidsPanel = memo(function FluidsPanel() {
  const fluids = useTC3Store((s) => s.card.march.circulation.fluids)
  const bloodProducts = useTC3Store((s) => s.card.march.circulation.bloodProducts)
  const addFluid = useTC3Store((s) => s.addFluid)
  const removeFluid = useTC3Store((s) => s.removeFluid)
  const addBloodProduct = useTC3Store((s) => s.addBloodProduct)
  const removeBloodProduct = useTC3Store((s) => s.removeBloodProduct)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-primary mb-1">Fluids & Blood Products</h3>
        <p className="text-[11px] text-tertiary/70">IV fluids and blood product administration</p>
      </div>

      {/* Fluids */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Fluids</p>
        {fluids.map((f, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <span className="text-xs text-tertiary">{f.type} — {f.volume}</span>
            <button onClick={() => removeFluid(i)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addFluid({ type: 'Normal Saline', volume: '1000mL' })}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Fluid</span>
        </button>
      </div>

      {/* Blood Products */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-tertiary/50 tracking-widest uppercase">Blood Products</p>
        {bloodProducts.map((b, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-tertiary/15 bg-themewhite2">
            <span className="text-xs text-tertiary">{b.type} — {b.volume}</span>
            <button onClick={() => removeBloodProduct(i)} className="ml-auto p-1 hover:bg-themeredred/10 rounded transition-colors">
              <X size={14} className="text-themeredred/60" />
            </button>
          </div>
        ))}
        <button
          onClick={() => addBloodProduct({ type: 'Whole Blood', volume: '1 unit' })}
          className="flex items-center gap-1.5 text-[11px] text-themeredred hover:text-themeredred/80 transition-colors px-1 py-1"
        >
          <Plus size={14} /> <span>Add Blood Product</span>
        </button>
      </div>
    </div>
  )
})
