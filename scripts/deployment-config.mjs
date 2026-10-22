// Pure deployment validation: messages include variable names, never their values.
export function publicUrl(value, name, originOnly = false) {
  const invalid = () => new Error(`${name} must be an explicit public HTTPS ${originOnly ? 'origin' : 'URL'} without credentials, query or fragment.`)
  let url
  try { url = new URL(value) } catch { throw invalid() }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  const privateHost = /(^|\.)(localhost|local|internal|lan|home|arpa|invalid|test|example|example\.com|example\.org|example\.net)$/.test(host)
    || !host.includes('.') || /^(0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(host)
    || /^198\.(18|19)\./.test(host) || /^(22[4-9]|23\d|24\d|25[0-5])\./.test(host)
    || !/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d](?:[a-z\d-]*[a-z\d])?$/.test(host)
    || host.includes(':') || host.includes('*')
  if (url.protocol !== 'https:' || privateHost || url.username || url.password || url.search || url.hash || (originOnly && url.pathname !== '/')) throw invalid()
  return originOnly ? url.origin : url.href.replace(/\/$/, '')
}

export function pagesEnvironment(app, env) {
  const fields = app === 'storefront' ? ['VITE_API_BASE_URL', 'VITE_SITE_URL'] : app === 'admin' ? ['VITE_ADMIN_API_BASE_URL', 'VITE_ADMIN_SITE_URL', 'VITE_STOREFRONT_URL'] : null
  if (!fields) throw new Error('Unknown Pages application.')
  for (const name of Object.keys(env)) {
    if (name.startsWith('VITE_') && /(SECRET|PASSWORD|TOKEN|DATABASE|PRIVATE|KEY)/i.test(name)) throw new Error(`${name} cannot be exposed in a public browser build.`)
  }
  const result = {}
  for (const [index, name] of fields.entries()) {
    result[name] = publicUrl(env[name], name, index > 0)
    if (index === 0 && new URL(result[name]).pathname !== '/api/v1') throw new Error(`${name} must end with /api/v1.`)
  }
  if (app === 'admin' && result.VITE_ADMIN_SITE_URL === result.VITE_STOREFRONT_URL) throw new Error('Admin and storefront must use independent origins.')
  return result
}
