import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    https: {
      key: fs.readFileSync('../certificate/99.valpher.com-key.pem'),
      cert: fs.readFileSync('../certificate/99.valpher.com-crt.pem'),
    },
    proxy: {
      '/api': {
        target: 'https://localhost:5168',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: '../static/dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    // Generate manifest.json in outDir
    manifest: true,
  },
})
