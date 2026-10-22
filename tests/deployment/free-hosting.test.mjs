import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url))
const { load } = apiRequire('js-yaml')
test('Render template cannot provision paid databases or persistent disks', async () => {
  const render = load(await readFile(new URL('../../render.yaml', import.meta.url), 'utf8'))
  assert.equal(render.services.length, 1)
  assert.equal(render.databases, undefined)
  const service = render.services[0]
  assert.equal(service.type, 'web'); assert.equal(service.plan, 'free'); assert.equal(service.disk, undefined)
  assert.equal(service.autoDeployTrigger, 'checksPass')
  assert.equal(service.healthCheckPath, '/api/v1/health')
  assert.equal(service.envVars.find(value => value.key === 'STORAGE_PROVIDER').value, 'supabase')
  for (const name of ['DATABASE_URL', 'DIRECT_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) assert.equal(service.envVars.find(value => value.key === name).sync, false)
})
test('Supabase server keys are absent from both Pages environment examples and production CI', async () => {
  for (const path of ['../../.env.production.example', '../../admin/.env.production.example', '../../.github/workflows/ci.yml']) {
    const text = await readFile(new URL(path, import.meta.url), 'utf8')
    assert.ok(!text.includes('SUPABASE_SERVICE_ROLE_KEY'))
  }
  const workflow = load(await readFile(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8'))
  assert.ok(workflow.jobs.quality.env.DIRECT_URL.includes('petcorner_ci_test'))
  assert.ok(workflow.jobs.quality.env.TEST_DATABASE_URL.includes('petcorner_ci_test'))
})
