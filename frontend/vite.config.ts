import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // Generate manifest.json in outDir
    manifest: true,
  },
})
