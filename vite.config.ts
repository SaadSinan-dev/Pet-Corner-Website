import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001', '/uploads': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' } },
  preview: { host: '127.0.0.1', port: 4173, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001', '/uploads': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' } },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/tests/setup.ts'], css: false },
})
