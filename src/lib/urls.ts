export function apiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '')
}

export function resolveImageUrl(src?: string | null) {
  if (!src || /^[\\/]{2}/.test(src)) return ''
  const base = apiBaseUrl()
  // Upload records belong to the API; bundled /images assets belong to the storefront.
  if (src.startsWith('/uploads/') && /^https?:\/\//i.test(base)) return `${new URL(base).origin}${src}`
  return src
}
