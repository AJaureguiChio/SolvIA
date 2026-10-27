import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Las variables viven en el .env de la raíz del repositorio; solo se exponen las VITE_*.
  envDir: '..',
  server: { port: 5173, strictPort: true },
})
