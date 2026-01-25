import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ADTMC/',
  plugins: [
    tailwindcss(),
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    copyPublicDir: true,
    // Add cache busting but with predictable names
    rollupOptions: {
      output: {
        // Don't use hash in filenames for main files
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
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