// Read-only checks. No credentials, order creation, uploads or production database access.
import { pathToFileURL } from 'node:url'
import { publicUrl } from './deployment-config.mjs'

export async function verifyPublicDeployment({ store, admin, api, revision }, fetcher = fetch) {
  store = publicUrl(store, 'store', true)
  admin = publicUrl(admin, 'admin', true)
  api = publicUrl(api, 'api')
  if (store === admin || new URL(api).pathname !== '/api/v1') throw new Error('Use independent frontend origins and an API URL ending in /api/v1.')
  if (revision && !/^[a-f\d]{7,64}$/i.test(revision)) throw new Error('Expected revision must be a commit hash.')
  const checks = []
  async function get(url, name, { status = 200, method = 'GET', headers = {} } = {}) {
    const response = await fetcher(url, { method, headers, redirect: 'error', signal: AbortSignal.timeout(15000) })
    if (response.status !== status) throw new Error(`${name}: unexpected HTTP ${response.status}.`)
    checks.push(name)
    return response
  }
  const health = await (await get(`${api}/health`, 'API readiness')).json()
  if (health.status !== 'ok') throw new Error('API did not confirm database readiness.')
  await get(`${api}/admin/products`, 'Unauthenticated administration rejected', { status: 401 })
  for (const origin of [store, admin]) {
    const preflight = await get(`${api}/storefront/cart/validate`, `CORS for ${origin}`, { status: 204, method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,authorization,idempotency-key,x-order-token' } })
    if (preflight.headers.get('access-control-allow-origin') !== origin) throw new Error('CORS did not allow an exact frontend origin.')
  }
  const denied = await fetcher(`${api}/health`, { method: 'OPTIONS', headers: { Origin: 'https://untrusted.invalid', 'Access-Control-Request-Method': 'GET' }, signal: AbortSignal.timeout(15000), redirect: 'error' })
  if (denied.headers.get('access-control-allow-origin')) throw new Error('CORS allows an unexpected origin.')
  checks.push('Unexpected origin excluded')
  for (const [app, origin, routes] of [
    ['storefront', store, ['/', '/shop', '/cart', '/checkout', '/product/__deployment_missing__', '/category/__deployment_missing__']],
    ['admin', admin, ['/login', '/orders', '/products', '/categories', '/settings']],
  ]) {
    for (const route of routes) {
      const html = await (await get(`${origin}${route}`, `${app} direct ${route}`)).text()
      if (!/<html[^>]*lang=["']ar["']/i.test(html) || !/<html[^>]*dir=["']rtl["']/i.test(html) || !html.includes('favicon-32.png')) throw new Error(`${app} returned an unexpected HTML shell.`)
    }
    const icon = await get(`${origin}/favicon-32.png`, `${app} favicon`)
    const signature = new Uint8Array(await icon.arrayBuffer()).slice(0, 8)
    if (String(signature) !== '137,80,78,71,13,10,26,10') throw new Error(`${app} favicon is not a PNG.`)
    const deployment = await (await get(`${origin}/deployment.json`, `${app} revision`)).json()
    if (deployment.app !== app || deployment.apiBase !== api || deployment.siteUrl !== origin) throw new Error(`${app} was built for different public URLs.`)
    if (revision && deployment.revision !== revision) throw new Error(`${app} has not published the expected commit yet.`)
  }
  await get(`${store}/boot.js`, 'Storefront initial splash script')
  const catalog = await (await get(`${api}/storefront/products?limit=100`, 'Public catalog')).json()
  if (!Array.isArray(catalog.items) || catalog.items.some(item => item.isDemo || item.sku?.startsWith('DEMO-'))) throw new Error('Public catalog contains known demo data or an invalid response.')
  return { status: 'passed', checks, expectedRevision: revision || null }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--help')) {
    console.log('npm run verify:public -- --store=https://REAL_STORE --admin=https://REAL_ADMIN --api=https://REAL_API/api/v1 [--revision=COMMIT_SHA]\nRead-only GET/OPTIONS checks. Use only actual public URLs after linking services. No credentials or production writes.')
  } else {
    const args = Object.fromEntries(process.argv.slice(2).map(value => { const at = value.indexOf('='); return [value.slice(2, at), value.slice(at + 1)] }))
    try { console.log(JSON.stringify(await verifyPublicDeployment(args), null, 2)) }
    catch (error) { console.error(error instanceof Error ? error.message : 'Public deployment verification failed.'); process.exitCode = 1 }
  }
}
