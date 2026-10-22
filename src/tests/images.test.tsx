import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import { ProductImage } from '../components/Common'
import { api } from '../lib/api'
import { CartProvider } from '../lib/cart'
import { usePageMeta } from '../lib/hooks'
import type { Product, StoreSettings } from '../lib/types'
import ProductRoute from '../pages/Product'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  document.head.querySelector('meta[property="og:image"]')?.remove()
  document.head.querySelector('link[rel="canonical"]')?.remove()
})

it.each([
  ['https://api.pet-corner.example/api/v1', '/uploads/cat.webp', 'https://api.pet-corner.example/uploads/cat.webp'],
  ['https://api.pet-corner.example/api/v1///', '/uploads/cat.webp', 'https://api.pet-corner.example/uploads/cat.webp'],
  ['http://127.0.0.1:3001/api/v1', '/uploads/cat.webp', 'http://127.0.0.1:3001/uploads/cat.webp'],
  ['/api/v1', '/uploads/cat.webp', '/uploads/cat.webp'],
  ['https://api.pet-corner.example/api/v1', '/images/cat.webp', '/images/cat.webp'],
  ['https://api.pet-corner.example/api/v1', 'https://cdn.example/cat.webp', 'https://cdn.example/cat.webp'],
])('renders image %s + %s as %s', (base, src, expected) => {
  vi.stubEnv('VITE_API_BASE_URL', base)
  render(<ProductImage src={src} alt="طعام القطط" />)
  expect(screen.getByRole('img', { name: 'طعام القطط' })).toHaveAttribute('src', expected)
})

it('preserves the accessible product fallback when a remote upload fails', () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.pet-corner.example/api/v1')
  render(<ProductImage src="/uploads/missing.webp" alt="عبوة الطعام" />)
  const image = screen.getByRole('img', { name: 'عبوة الطعام' })
  expect(image).toHaveAttribute('src', 'https://api.pet-corner.example/uploads/missing.webp')
  fireEvent.error(image)
  expect(screen.getByRole('img', { name: 'عبوة الطعام' })).toHaveTextContent('صورة المنتج غير متاحة')
})

it.each(['//uploads/other-host.webp', '/\\other-host/cat.webp', '\\\\other-host/cat.webp'])('rejects ambiguous network paths instead of loading %s', src => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.pet-corner.example/api/v1')
  render(<ProductImage src={src} alt="صورة المنتج" />)
  expect(screen.getByRole('img', { name: 'صورة المنتج' })).toHaveTextContent('صورة المنتج غير متاحة')
  expect(document.querySelector('img')).toBeNull()
})

it.each([
  ['https://api.pet-corner.example/api/v1///', 'https://api.pet-corner.example/api/v1/storefront/categories'],
  ['/api/v1/', '/api/v1/storefront/categories'],
])('normalizes the API base %s before requesting categories', async (base, expected) => {
  vi.stubEnv('VITE_API_BASE_URL', base)
  const fetcher = vi.fn().mockResolvedValue(new Response('[]', { headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetcher)
  await api.categories()
  expect(fetcher).toHaveBeenCalledWith(expected, expect.any(Object))
})

it.each([
  ['/uploads/cat.webp', 'https://api.pet-corner.example/uploads/cat.webp'],
  ['/images/cat.webp', 'https://shop.pet-corner.example/images/cat.webp'],
  ['https://cdn.example/cat.webp', 'https://cdn.example/cat.webp'],
])('uses the correct public origin for the social image %s', (src, expected) => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.pet-corner.example/api/v1/')
  vi.stubGlobal('location', { origin: 'https://shop.pet-corner.example', pathname: '/product/cat-food' })
  renderHook(() => usePageMeta('طعام القطط', 'وجبة القطط', false, src))
  expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute('content', expected)
})

it('omits a social image with an ambiguous network path', () => {
  renderHook(() => usePageMeta('طعام القطط', 'وجبة القطط', false, '//uploads/other-host.webp'))
  expect(document.head.querySelector('meta[property="og:image"]')).toBeNull()
})

it('uses API upload URLs in the product gallery, social image, and structured data', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.pet-corner.example/api/v1/')
  vi.stubEnv('VITE_SITE_URL', 'https://shop.pet-corner.example')
  const settings: StoreSettings = { storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false, codEnabled: false, checkoutEnabled: false, contactPhone: null, contactEmail: null, pages: {} }
  const product: Product = {
    id: '55de5ac3-99ec-4000-a0f1-1c0de510e840', slug: 'cat-food', name: 'طعام القطط', shortDescription: 'وجبة القطط', description: 'طعام يومي للقطط', sku: null, price: 5000, compareAtPrice: null, stock: 2, featured: true, category: { id: 'cats', name: 'طعام', slug: 'food' }, createdAt: '2026-10-22',
    images: [{ id: 'upload', url: '/uploads/cat.webp', alt: 'العبوة الأمامية' }, { id: 'local', url: '/images/cat.webp', alt: 'المكونات' }, { id: 'external', url: 'https://cdn.example/cat.webp', alt: 'صورة خارجية' }],
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  client.setQueryData(['settings'], settings)
  client.setQueryData(['product', 'cat-food'], product)
  client.setQueryData(['related', 'food'], { items: [], total: 0, page: 1, limit: 5, totalPages: 0 })
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/product/cat-food']}><CartProvider><Routes><Route path="/product/:slug" element={<ProductRoute />} /></Routes></CartProvider></MemoryRouter></QueryClientProvider>)
  expect(screen.getAllByRole('img', { name: 'العبوة الأمامية' })).toHaveLength(2)
  for (const image of screen.getAllByRole('img', { name: 'العبوة الأمامية' })) expect(image).toHaveAttribute('src', 'https://api.pet-corner.example/uploads/cat.webp')
  expect(document.head.querySelector('meta[property="og:image"]')).toHaveAttribute('content', 'https://api.pet-corner.example/uploads/cat.webp')
  await waitFor(() => expect(document.head.querySelector('script[type="application/ld+json"]')).not.toBeNull())
  const structured = JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!) as { image: string[]; offers: { url: string } }
  expect(structured.image).toEqual(['https://api.pet-corner.example/uploads/cat.webp', 'https://shop.pet-corner.example/images/cat.webp', 'https://cdn.example/cat.webp'])
  expect(structured.offers.url).toBe('https://shop.pet-corner.example/product/cat-food')
  fireEvent.click(screen.getByRole('button', { name: 'عرض الصورة 2' }))
  expect(screen.getAllByRole('img', { name: 'المكونات' })[0]).toHaveAttribute('src', '/images/cat.webp')
  view.unmount()
  client.clear()
})
