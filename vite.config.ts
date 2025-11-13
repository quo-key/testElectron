import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: {
    port: 5173
  },
  // Ensure production built index.html uses relative paths so it works when loaded
  // via file:// or from Electron's local files
  base: './',
  build: {
    outDir: 'dist'
  }
}))
