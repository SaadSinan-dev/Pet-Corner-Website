import { existsSync } from 'node:fs'
import { defineConfig } from '@playwright/test'

const databaseMarker = process.env.PET_CORNER_BROWSER_DB || ''
if (!/^pet_corner_browser_\d+_[a-f0-9]+_test$/.test(databaseMarker)
  || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== `/${databaseMarker}`) {
  throw new Error('Run node scripts/test-browser.mjs to provision isolated browser-test services and data.')
}

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  || (process.platform === 'win32' && existsSync(edge) ? edge : undefined)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5176',
    browserName: 'chromium',
    launchOptions: executablePath ? { executablePath } : {},
    viewport: { width: 1280, height: 900 },
    locale: 'ar-SY',
    reducedMotion: 'reduce',
    actionTimeout: 20_000,
    navigationTimeout: 20_000,
    screenshot: 'only-on-failure',
    // Requests contain ephemeral administrator credentials and private receipt tokens.
    trace: 'off',
    video: 'off',
  },
  webServer: [
    { command: 'node dist/src/main.js', cwd: './api', env: { PORT: '3002', HOST: '127.0.0.1' }, url: 'http://127.0.0.1:3002/api/v1/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false, timeout: 30_000 },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5177 --strictPort', cwd: './admin', url: 'http://127.0.0.1:5177', reuseExistingServer: false, timeout: 30_000 },
  ],
})
