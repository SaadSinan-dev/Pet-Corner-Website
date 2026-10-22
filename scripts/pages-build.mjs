import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { pagesEnvironment } from './deployment-config.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const app = process.argv[2]
const directory = app === 'admin' ? resolve(root, 'admin') : root
const env = { ...loadEnv('production', directory, ''), ...process.env }
const publicValues = pagesEnvironment(app, env)
const revision = env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || 'local-unpublished'
if (revision !== 'local-unpublished' && !/^[a-f\d]{7,64}$/i.test(revision)) throw new Error('Build revision must be a commit hash.')
const childEnv = { ...env, ...publicValues }
// npm_execpath is provided by npm itself; no string-built shell command or secrets in arguments.
const npm = process.env.npm_execpath
if (!npm) throw new Error('Run the named pages:build npm script.')
async function run(args) {
  await new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, [npm, ...args], { cwd: directory, env: childEnv, stdio: 'inherit', windowsHide: true })
    child.once('error', () => reject(new Error('Could not run the Pages build prerequisite.')))
    child.once('exit', code => code === 0 ? resolveRun() : reject(new Error(`Pages build check failed (${code ?? 'interrupted'}).`)))
  })
}
if (app === 'admin') await run(['ci']) // Cloudflare installs only the root package automatically.
await run(['run', 'lint'])
await run(['test'])
await run(['run', 'build']) // Each build includes strict TypeScript checks.
const output = resolve(directory, 'dist')
await mkdir(output, { recursive: true })
await writeFile(resolve(output, 'deployment.json'), JSON.stringify({ app, revision, builtAt: new Date().toISOString(), apiBase: Object.values(publicValues)[0], siteUrl: Object.values(publicValues)[1] }, null, 2))
console.log(`Checked ${app} Pages artifact is ready in ${app === 'admin' ? 'admin/dist' : 'dist'}.`)
