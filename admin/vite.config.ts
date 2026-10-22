import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5175, strictPort: true, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001', '/uploads': process.env.API_PROXY_TARGET || 'http://127.0.0.1:3001' } },
  test: { include: ['src/**/*.test.{ts,tsx}'], environment: 'jsdom', setupFiles: ['./src/test-setup.ts'], restoreMocks: true },
})
