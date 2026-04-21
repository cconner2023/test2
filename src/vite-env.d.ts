/// <reference types="vite/client" />

declare const __APP_VERSION__: string
declare const __BUILD_ID__: string

declare module '*.svg' {
  const src: string
  export default src
}

// Tour system: global flag for WriteNotePage section override
interface Window {
  __tourNoteOverride?: boolean
}

// Virtual module from vite-plugin-pwa
declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean
    onNeedRefresh?: () => void
    onOfflineReady?: () => void
    onRegistered?: (registration: ServiceWorkerRegistration | undefined) => void
    onRegisterError?: (error: Error) => void
  }

  export function registerSW(options?: RegisterSWOptions): (reloadPage?: boolean) => Promise<void>
}
