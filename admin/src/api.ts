const base = (import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/v1').replace(/\/$/, '')
let token: string | null = null
let expired: (() => void) | undefined
export function setToken(value: string | null) { token = value }
export function onSessionExpired(callback: () => void) { expired = callback; return () => { expired = undefined } }
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); this.name = 'ApiError' } }
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isUpload = options.body instanceof FormData
  try {
    const response = await fetch(`${base}${path}`, { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000), headers: { ...(!isUpload ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { message?: string | string[] } | null
      if (response.status === 401 && path !== '/auth/login') { setToken(null); expired?.() }
      throw new ApiError(Array.isArray(data?.message) ? data.message.join('، ') : data?.message || 'تعذّر إكمال العملية. حاول مرة أخرى.', response.status)
    }
    return response.status === 204 ? undefined as T : await response.json() as T
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError('تعذّر الاتصال بالخادم. تحقق من الاتصال وأعد المحاولة.', 0)
  }
}
export function save<T>(path: string, data: unknown, method = 'PATCH') { return request<T>(path, { method, body: JSON.stringify(data) }) }
export async function upload(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('اختر صورة JPEG أو PNG أو WebP.')
  if (file.size > 5 * 1024 * 1024) throw new Error('يجب ألّا يتجاوز حجم الصورة ٥ ميغابايت.')
  const body = new FormData(); body.append('file', file)
  return request<{ url: string }>('/admin/uploads', { method: 'POST', body })
}
export function imageUrl(url: string) {
  if (url.startsWith('/uploads/') && /^https?:\/\//.test(base)) return `${new URL(base).origin}${url}`
  if (url.startsWith('/images/') && import.meta.env.VITE_STOREFRONT_URL) return new URL(url, import.meta.env.VITE_STOREFRONT_URL).href
  return url
}
export const money = (amount: number | null, label = 'ل.س') => amount === null ? 'بانتظار التأكيد' : `${new Intl.NumberFormat('ar-SY').format(amount)} ${label}`
export const date = (value: string) => new Intl.DateTimeFormat('ar-SY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
