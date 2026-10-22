import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { CartProvider, useCart } from '../lib/cart'
import { api } from '../lib/api'
import { CartPage } from '../pages/Commerce'
import type { Product } from '../lib/types'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const SECOND_ID = '22222222-2222-4222-8222-222222222222'
const product: Product = {
  id: PRODUCT_ID, name: 'طعام القطط', slug: 'cat-food', shortDescription: '', description: '', sku: null,
  price: 35000, compareAtPrice: null, stock: 3, featured: false, images: [],
  category: { id: 'cats', name: 'القطط', slug: 'cats' }, createdAt: '2026-10-21T00:00:00Z',
}

function Probe() {
  const cart = useCart()
  return <><output aria-label="cart">{JSON.stringify(cart.items)}</output><output aria-label="count">{cart.count}</output>
    <button onClick={() => cart.add(product, 5)}>add</button>
    <button onClick={() => cart.setQuantity(PRODUCT_ID, 0)}>remove</button>
    <span>{cart.notice}</span></>
}

beforeEach(() => localStorage.clear())
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('persistent cart', () => {
  it('loads only valid IDs and positive integer quantities and caps oversized values', () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify([
      { productId: PRODUCT_ID, quantity: 2, price: 1 }, { productId: PRODUCT_ID, quantity: 1 },
      { productId: SECOND_ID, quantity: 999999 }, { productId: '', quantity: 2 },
      { productId: PRODUCT_ID, quantity: -3 }, { productId: PRODUCT_ID, quantity: 1.5 },
      { productId: 'not-a-valid-id', quantity: 2 }, null,
    ]))
    render(<CartProvider><Probe /></CartProvider>)
    expect(JSON.parse(screen.getByLabelText('cart').textContent || '[]')).toEqual([
      { productId: PRODUCT_ID, quantity: 3 }, { productId: SECOND_ID, quantity: 99 },
    ])
    expect(JSON.parse(localStorage.getItem('pet-corner:cart') || '[]')).toEqual([
      { productId: PRODUCT_ID, quantity: 3 }, { productId: SECOND_ID, quantity: 99 },
    ])
  })

  it('recovers from corrupt storage and limits additions to actual stock', () => {
    localStorage.setItem('pet-corner:cart', '{broken')
    render(<CartProvider><Probe /></CartProvider>)
    expect(screen.getByLabelText('count').textContent).toBe('0')
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByLabelText('count').textContent).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByLabelText('count').textContent).toBe('3')
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))
    expect(screen.getByLabelText('count').textContent).toBe('0')
    expect(localStorage.getItem('pet-corner:cart')).toBe('[]')
  })

  it('stays usable when the browser blocks storage access', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    render(<CartProvider><Probe /></CartProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByLabelText('count').textContent).toBe('3')
  })

  it('keeps restored carts within the API line limit and refuses further distinct products', () => {
    const lines = Array.from({ length: 55 }, (_, index) => ({ productId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, quantity: 1 }))
    localStorage.setItem('pet-corner:cart', JSON.stringify(lines))
    render(<CartProvider><Probe /></CartProvider>)
    expect(screen.getByLabelText('count').textContent).toBe('50')
    fireEvent.click(screen.getByRole('button', { name: 'add' }))
    expect(screen.getByLabelText('count').textContent).toBe('50')
    expect(JSON.parse(localStorage.getItem('pet-corner:cart') || '[]')).toHaveLength(50)
  })

  it('replaces a failed cart photograph with an accessible image fallback', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify([{ productId: PRODUCT_ID, quantity: 1 }]))
    vi.spyOn(api, 'settings').mockResolvedValue({
      storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false, codEnabled: true,
      checkoutEnabled: true, contactPhone: null, contactEmail: null, deliveryRegions: [], pages: {},
    })
    vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{
      product: { ...product, images: [{ id: 'photo', url: '/missing.jpg', alt: 'طعام القطط' }] }, productId: PRODUCT_ID, quantity: 1,
    }] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><CartProvider><MemoryRouter><CartPage /></MemoryRouter></CartProvider></QueryClientProvider>)
    const image = await screen.findByRole('img', { name: 'طعام القطط' })
    fireEvent.error(image)
    expect(screen.getByText('صورة المنتج غير متاحة')).toBeTruthy()
    expect(image.isConnected).toBe(false)
    client.clear()
  })
})
