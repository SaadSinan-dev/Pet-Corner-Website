import assert from 'node:assert/strict'
import { test } from 'node:test'
import { verifyPublicDeployment } from '../../scripts/public-smoke.mjs'
const values = { store: 'https://shop.pet-corner.app', admin: 'https://admin.pet-corner.app', api: 'https://api.pet-corner.app/api/v1', revision: 'a'.repeat(40) }
function fakeFetch(overrides = {}) {
  const requests = []
  const fetcher = async (url, options) => {
    requests.push({ url, options })
    const u = new URL(url)
    if (options.method === 'OPTIONS') return new Response(null, { status: 204, headers: options.headers.Origin.endsWith('.invalid') ? {} : { 'Access-Control-Allow-Origin': options.headers.Origin } })
    if (u.pathname === '/api/v1/health') return Response.json({ status: 'ok' })
    if (u.pathname === '/api/v1/admin/products') return Response.json({}, { status: 401 })
    if (u.pathname.endsWith('/deployment.json')) return Response.json({ app: u.origin === values.store ? 'storefront' : 'admin', apiBase: values.api, siteUrl: u.origin, revision: overrides.revision || values.revision })
    if (u.pathname.endsWith('.png')) return new Response(Uint8Array.from([137,80,78,71,13,10,26,10]))
    if (u.pathname.includes('/api/v1/storefront/products')) return Response.json({ items: overrides.items || [] })
    return new Response('<html lang="ar" dir="rtl"><link href="/favicon-32.png"></html>')
  }
  return { requests, fetcher }
}
test('public verification uses only GET/OPTIONS and verifies real deployment revision contracts', async () => {
  const { requests, fetcher } = fakeFetch()
  const result = await verifyPublicDeployment(values, fetcher)
  assert.equal(result.status, 'passed')
  assert.ok(requests.every(({ options }) => ['GET', 'OPTIONS'].includes(options.method)))
  assert.ok(requests.every(({ options }) => !options.headers.Authorization))
})
test('public verification fails stale revisions and exposed seed catalog', async () => {
  await assert.rejects(() => verifyPublicDeployment(values, fakeFetch({ revision: 'b'.repeat(40) }).fetcher), /expected commit/)
  await assert.rejects(() => verifyPublicDeployment(values, fakeFetch({ items: [{ sku: 'DEMO-CAT-1' }] }).fetcher), /demo/)
})
test('public verification refuses localhost before any request', async () => {
  const { requests, fetcher } = fakeFetch()
  await assert.rejects(() => verifyPublicDeployment({ ...values, api: 'http://127.0.0.1:3001/api/v1' }, fetcher), /HTTPS/)
  assert.equal(requests.length, 0)
})
