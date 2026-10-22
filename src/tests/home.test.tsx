import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import Home from '../pages/Home'
import { api } from '../lib/api'
import { CartProvider } from '../lib/cart'
import { ProductCard } from '../components/ProductCard'
import type { Product } from '../lib/types'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })

it('renders managed hero fields and real categories without invented category destinations', async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.pet-corner.example/api/v1/')
  vi.spyOn(api, 'settings').mockResolvedValue({ storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false, codEnabled: false, checkoutEnabled: false, contactPhone: null, contactEmail: null, pages: {}, heroEyebrow: 'رفقة جميلة', heroTitle: 'عنوان معتمد للمتجر', heroDescription: 'وصف معتمد من لوحة التحكم', heroButtonText: 'اختر لرفيقك', heroImageUrl: '/uploads/hero.webp' })
  vi.spyOn(api, 'categories').mockResolvedValue([{ id: 'real', name: 'العناية اليومية', slug: 'care', productCount: 0, image: '/uploads/care.webp' }])
  vi.spyOn(api, 'products').mockResolvedValue({ items: [], total: 0, page: 1, limit: 4, totalPages: 0 })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter><Home /></MemoryRouter></QueryClientProvider>)
  expect(await screen.findByRole('heading', { name: 'عنوان معتمد للمتجر', level: 1 })).toBeVisible()
  expect(screen.getByText('رفقة جميلة')).toBeVisible()
  expect(screen.getByText('وصف معتمد من لوحة التحكم')).toBeVisible()
  expect(screen.getByRole('link', { name: 'اختر لرفيقك' })).toHaveAttribute('href', '/shop')
  expect(document.querySelector('.hero-photo')).toHaveAttribute('src', 'https://api.pet-corner.example/uploads/hero.webp')
  expect(document.querySelector('.category-icon img')).toHaveAttribute('src', 'https://api.pet-corner.example/uploads/care.webp')
  fireEvent.error(document.querySelector('.hero-photo')!)
  expect(document.querySelector('.hero-photo')).toHaveAttribute('src', '/images/hero-pets.webp')
  fireEvent.error(document.querySelector('.category-icon img')!)
  expect(document.querySelector('.category-icon img')).not.toBeVisible()
  expect(document.querySelector('a[href="/category/cat-food"]')).toBeNull()
  expect(document.querySelector('a[href="/category/dog-food"]')).toBeNull()
  client.clear()
})

it('shows add feedback only when cart quantity really increases', () => {
  localStorage.clear()
  const product: Product = { id: '55de5ac3-99ec-4000-a0f1-1c0de510e840', slug: 'real-product', name: 'منتج من المتجر', shortDescription: '', description: '', sku: null, price: 5000, compareAtPrice: null, stock: 1, featured: true, images: [], category: { id: 'category', name: 'عناية', slug: 'care' }, createdAt: '2026-10-22' }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['settings'], { currencyLabel: 'ل.س' })
  render(<QueryClientProvider client={client}><MemoryRouter><CartProvider><ProductCard product={product} /></CartProvider></MemoryRouter></QueryClientProvider>)
  const button = screen.getByRole('button', { name: /إضافة منتج من المتجر إلى السلة/ })
  expect(screen.getByText('صورة المنتج غير متاحة')).toBeVisible()
  fireEvent.click(button)
  expect(button).toHaveClass('is-added')
  fireEvent.click(button)
  expect(button).not.toHaveClass('is-added')
  client.clear()
})
