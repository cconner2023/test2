import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
    // No VitePWA plugin
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: true
  },
  server: {
    port: 3000,
    host: true
  },
  preview: {
    port: 4173,
    host: true,
    open: '/ADTMC/'
  }
})