// jsdom implements localStorage/sessionStorage but not window.matchMedia.
// Product code reads it at module scope (isPWA in src/lib/supabase.ts), so the
// stub has to exist before any test file's imports run — hence setupFiles.
// matches:false keeps isPWA false, the same value the suite saw under the old
// 'node' environment.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList
}
