import type { Category, CartLine, OrderInput, OrderReceipt, Product, ProductPage, StoreSettings, ValidatedCart } from './types'
import { apiBaseUrl } from './urls'

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  constructor(message: string, status: number, code?: string) { super(message); this.name = 'ApiError'; this.status = status; this.code = code }
}
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const timeout = AbortSignal.timeout(15000)
  try {
    const response = await fetch(`${apiBaseUrl()}${path}`, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout, headers: { 'Content-Type': 'application/json', ...options.headers } })
    if (!response.ok) {
      const data = await response.json().catch(() => null) as { message?: string | string[]; code?: string } | null
      const message = Array.isArray(data?.message) ? data.message.join('، ') : data?.message
      throw new ApiError(message || 'تعذّر إكمال الطلب. حاول مرة أخرى.', response.status, data?.code)
    }
    return await response.json() as T
  } catch (error) {
    if (error instanceof ApiError || (error instanceof DOMException && error.name === 'AbortError')) throw error
    throw new ApiError('تعذّر الاتصال بالمتجر. تحقق من اتصالك وحاول مرة أخرى.', 0)
  }
}
export const api = {
  settings: (signal?: AbortSignal) => request<StoreSettings>('/storefront/settings', { signal }),
  categories: (signal?: AbortSignal) => request<Category[]>('/storefront/categories', { signal }),
  products: (params: URLSearchParams | Record<string, string> = {}, signal?: AbortSignal) => request<ProductPage>(`/storefront/products?${new URLSearchParams(params)}`, { signal }),
  product: (slug: string, signal?: AbortSignal) => request<Product>(`/storefront/products/${encodeURIComponent(slug)}`, { signal }),
  validateCart: (items: CartLine[], signal?: AbortSignal) => request<ValidatedCart>('/storefront/cart/validate', { method: 'POST', body: JSON.stringify({ items }), signal }),
  order: (input: OrderInput, key: string) => request<OrderReceipt>('/storefront/orders', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify(input) }),
  receipt: (code: string, token: string, signal?: AbortSignal) => request<OrderReceipt>(`/storefront/orders/${encodeURIComponent(code)}`, { headers: { 'X-Order-Token': token }, signal }),
}
export function money(amount: number, label = 'ل.س') { return `${new Intl.NumberFormat('ar-SY', { maximumFractionDigits: 0 }).format(amount)} ${label}` }
