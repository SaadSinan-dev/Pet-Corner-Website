import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFile, mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Never run browser fixtures against the developer's catalog or running services.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiRoot = resolve(root, 'api')
const requireApi = createRequire(resolve(apiRoot, 'package.json'))
const { parse } = requireApi('dotenv')
const { Client } = requireApi('pg')
let fileEnv = {}
try { fileEnv = parse(await readFile(resolve(apiRoot, '.env'))) } catch { /* An explicit environment is also supported. */ }
const source = process.env.DATABASE_URL || fileEnv.DATABASE_URL
if (!source) throw new Error('Configure the API PostgreSQL DATABASE_URL before running isolated browser tests.')
const database = `pet_corner_browser_${Date.now()}_${randomBytes(4).toString('hex')}_test`
const connection = new URL(source)
connection.pathname = '/postgres'
const client = new Client({ connectionString: connection.href })
try {
  await client.connect()
  // The identifier consists exclusively of this script's trusted generated characters.
  await client.query(`CREATE DATABASE "${database}" ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`)
} catch {
  throw new Error('Could not create the isolated browser-test database. The configured PostgreSQL user needs CREATEDB permission.')
} finally { await client.end() }
const isolated = new URL(source)
isolated.pathname = `/${database}`
const uploadDir = resolve(root, 'test-results', 'browser-uploads', database)
await mkdir(uploadDir, { recursive: true })
const env = {
  ...fileEnv, ...process.env,
  NODE_ENV: 'test', DATABASE_URL: isolated.href, TEST_DATABASE_URL: isolated.href,
  PET_CORNER_BROWSER_DB: database,
  JWT_SECRET: randomBytes(48).toString('base64url'),
  ORDER_TOKEN_SECRET: randomBytes(48).toString('base64url'),
  PORT: '3002', HOST: '127.0.0.1',
  CORS_ORIGINS: 'http://127.0.0.1:5176,http://127.0.0.1:5177',
  APP_PUBLIC_URL: 'http://127.0.0.1:5176', ADMIN_PUBLIC_URL: 'http://127.0.0.1:5177',
  PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:5176',
  PLAYWRIGHT_ADMIN_URL: 'http://127.0.0.1:5177',
  PLAYWRIGHT_API_URL: 'http://127.0.0.1:3002',
  API_PROXY_TARGET: 'http://127.0.0.1:3002',
  VITE_API_BASE_URL: 'http://127.0.0.1:3002/api/v1', VITE_ADMIN_API_BASE_URL: 'http://127.0.0.1:3002/api/v1',
  VITE_STOREFRONT_URL: 'http://127.0.0.1:5176',
  UPLOAD_DIR: uploadDir, STORAGE_PROVIDER: 'local', PUBLIC_UPLOAD_BASE_URL: '/uploads',
}
async function run(script, args = [], cwd = root) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [script, ...args], { cwd, env, stdio: ['inherit', 'pipe', 'pipe'], windowsHide: true })
    const redact = chunk => String(chunk).split(source).join('[database]').split(isolated.href).join('[isolated database]')
    child.stdout.on('data', chunk => process.stdout.write(redact(chunk)))
    child.stderr.on('data', chunk => process.stderr.write(redact(chunk)))
    child.once('error', () => reject(new Error('Could not start the browser-test prerequisite process.')))
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`Browser-test process failed (${code ?? 'interrupted'}).`)))
  })
}
console.log(`Browser tests use a newly created isolated database: ${database}`)
try {
  await run(resolve(apiRoot, 'node_modules/typescript/bin/tsc'), ['-p', 'tsconfig.json'], apiRoot)
  await run(resolve(apiRoot, 'node_modules/prisma/build/index.js'), ['migrate', 'deploy'], apiRoot)
  await run(resolve(apiRoot, 'dist/prisma/seed.js'), [], apiRoot)
  await run(resolve(root, 'node_modules/@playwright/test/cli.js'), ['test', ...process.argv.slice(2)])
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Browser tests failed.')
  process.exitCode = 1
} finally {
  // Retain only this dedicated database for inspecting a failed run. No existing data is touched.
  console.log(`Isolated browser-test database retained for inspection: ${database}`)
}
