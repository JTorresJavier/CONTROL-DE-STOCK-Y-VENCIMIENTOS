import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <-- esto hace que los assets usen rutas relativas
  // Es una app local (no se descarga por internet): los paquetes grandes (PDF, Excel) no son problema
  build: { chunkSizeWarningLimit: 2500 },
})
