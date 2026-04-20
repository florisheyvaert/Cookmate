import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// VITE_API_URL is set by the Aspire AppHost (api/src/AppHost/Program.cs).
// Standalone `npm run dev` falls back to the Web project's launchSettings port.
const apiUrl = process.env.VITE_API_URL ?? 'http://localhost:5285'

// PORT is set by Aspire when launching via the AppHost.
const port = Number(process.env.PORT) || 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
      },
    },
  },
})
