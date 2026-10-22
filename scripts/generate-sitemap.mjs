// Explicit deployment utility. Refuses to invent an origin or publish private routes.
import { writeFile } from 'node:fs/promises'
const origin = process.env.VITE_SITE_URL
if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Set VITE_SITE_URL to your real public HTTP(S) origin first.')
const site = new URL(origin)
if (site.pathname !== '/' || site.search || site.hash) throw new Error('VITE_SITE_URL must be an origin without a path/query/hash.')
const api = process.env.SITEMAP_API_URL || 'http://127.0.0.1:3001/api/v1'
async function get(path) { const response = await fetch(`${api}${path}`); if (!response.ok) throw new Error(`Catalog unavailable (${response.status})`); return response.json() }
const settings = await get('/storefront/settings')
if (settings.demoMode) throw new Error('Disable demo mode and replace the demo catalog before generating a public sitemap.')
const paths = ['/', '/shop', '/about', '/contact', '/faq', '/shipping']
for (const name of ['privacy', 'terms']) if (settings.pages[name]?.body?.trim()) paths.push(`/${name}`)
const categories = await get('/storefront/categories')
for (const category of categories) paths.push(`/category/${encodeURIComponent(category.slug)}`)
for (let page = 1, pages = 1; page <= pages; page++) {
  const result = await get(`/storefront/products?limit=100&page=${page}`)
  pages = result.totalPages
  for (const product of result.items) paths.push(`/product/${encodeURIComponent(product.slug)}`)
}
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${paths.map(path => `  <url><loc>${escape(new URL(path, site).href)}</loc></url>`).join('\n')}\n</urlset>\n`
await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml)
await writeFile(new URL('../public/robots.txt', import.meta.url), `User-agent: *\nAllow: /\nDisallow: /cart\nDisallow: /checkout\nDisallow: /order-success/\nDisallow: /api/\nSitemap: ${new URL('/sitemap.xml', site).href}\n`)
console.log(`Generated sitemap with ${paths.length} public catalog URLs. Rebuild the storefront to publish it.`)
