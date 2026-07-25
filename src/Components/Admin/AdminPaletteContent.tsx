/**
 * Temporary dev surface: one card per theme, light then dark, stacked in a
 * single column. Each card carries its own data-theme scope, so the swatches
 * resolve straight from App.css — no JS colour table to drift out of sync.
 */

const THEME_NAMES = ['default', 'ironclad', 'void', 'slipstream', 'topo'] as const
const MODES = ['light', 'dark'] as const

type ThemeId = `${(typeof THEME_NAMES)[number]}-${(typeof MODES)[number]}`

const THEME_IDS: ThemeId[] = THEME_NAMES.flatMap(name =>
  MODES.map(mode => `${name}-${mode}` as ThemeId),
)

// Ordered the way a surface is built: canvas, separators, text, accents, status.
const TOKENS = [
  'themewhite', 'themewhite2', 'themewhite3', 'glass-tint',
  'themegray1', 'themegray2',
  'primary', 'secondary', 'tertiary',
  'themeblue1', 'themeblue2', 'themeblue3', 'zone-accent',
  'themegreen', 'themeyellow', 'themeyellowlow', 'themered', 'themeredred', 'themepurple',
]

export function AdminPaletteContent() {
  return (
    <div className="px-4 pt-1 pb-4 flex flex-col gap-3">
      {THEME_IDS.map(id => (
        <div key={id} data-theme={id} className="rounded-lg overflow-hidden border border-primary/15">
          <div className="bg-themewhite p-3">
            <p className="text-[10pt] font-semibold text-primary mb-2">{id}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TOKENS.map(token => (
                <div key={token} className="min-w-0">
                  <div
                    className="h-12 rounded-md border border-primary/15"
                    style={{ backgroundColor: `var(--color-${token})` }}
                  />
                  <p className="mt-1 text-[9pt] text-secondary truncate">{token}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
