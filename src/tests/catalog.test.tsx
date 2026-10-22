import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Catalog from '../pages/Catalog'
import { api } from '../lib/api'
import type { StoreSettings } from '../lib/types'

const settings: StoreSettings = {
  storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false,
  codEnabled: false, checkoutEnabled: false, contactPhone: null, contactEmail: null,
  deliveryRegions: [], pages: {},
}

function CurrentLocation() {
  const location = useLocation()
  return <output aria-label="المسار الحالي">{location.pathname}{location.search}</output>
}

function renderCatalog(path = '/shop') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <CurrentLocation /><Routes><Route path="shop" element={<Catalog />} /><Route path="category/:slug" element={<Catalog />} /></Routes>
  </MemoryRouter></QueryClientProvider>)
  return client
}

beforeEach(() => {
  vi.spyOn(api, 'settings').mockResolvedValue(settings)
  vi.spyOn(api, 'categories').mockResolvedValue([
    { id: 'cats', name: 'طعام القطط', slug: 'cat-food', image: null, productCount: 2 },
    { id: 'dogs', name: 'طعام الكلاب', slug: 'dog-food', image: null, productCount: 2 },
  ])
  vi.spyOn(api, 'products').mockResolvedValue({ items: [], total: 0, page: 1, limit: 12, totalPages: 0 })
})
afterEach(() => vi.restoreAllMocks())

describe('catalog filters', () => {
  it('keeps a reversed price range out of the URL and explains how to correct it', async () => {
    const client = renderCatalog()
    await screen.findByText('لم نجد ما تبحث عنه')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'من' }), { target: { value: '50000' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'إلى' }), { target: { value: '30000' } })
    fireEvent.submit(screen.getByRole('button', { name: 'تطبيق السعر' }).closest('form')!)
    expect(screen.getByRole('alert')).toHaveTextContent('الأدنى')
    expect(screen.getByLabelText('المسار الحالي')).toHaveTextContent(/^\/shop$/)
    fireEvent.change(screen.getByRole('spinbutton', { name: 'إلى' }), { target: { value: '60000' } })
    fireEvent.submit(screen.getByRole('button', { name: 'تطبيق السعر' }).closest('form')!)
    await waitFor(() => expect(screen.getByLabelText('المسار الحالي')).toHaveTextContent('/shop?minPrice=50000&maxPrice=60000'))
    expect(screen.queryByRole('alert')).toBeNull()
    client.clear()
  })

  it('rejects a price beyond the API limit before changing the catalog query', async () => {
    const client = renderCatalog()
    await screen.findByText('لم نجد ما تبحث عنه')
    fireEvent.change(screen.getByRole('spinbutton', { name: 'إلى' }), { target: { value: '100000001' } })
    fireEvent.submit(screen.getByRole('button', { name: 'تطبيق السعر' }).closest('form')!)
    expect(screen.getByRole('alert')).toBeVisible()
    expect(screen.getByLabelText('المسار الحالي')).toHaveTextContent(/^\/shop$/)
    client.clear()
  })

  it('repairs malformed URL filters before sending them to the API', async () => {
    const client = renderCatalog('/shop?search=food&minPrice=bad&maxPrice=100000001&page=no&sort=wrong&inStock=yes&unexpected=1')
    await waitFor(() => expect(screen.getByLabelText('المسار الحالي')).toHaveTextContent(/^\/shop\?search=food$/))
    expect(api.products).toHaveBeenCalledWith(new URLSearchParams('search=food&limit=12'), expect.any(AbortSignal))
    client.clear()
  })

  it('changes category through the router without a document navigation', async () => {
    const client = renderCatalog('/category/cat-food')
    fireEvent.click(await screen.findByRole('radio', { name: /طعام الكلاب/ }))
    await waitFor(() => expect(screen.getByLabelText('المسار الحالي')).toHaveTextContent(/^\/category\/dog-food$/))
    expect(screen.getByRole('radio', { name: /طعام الكلاب/ })).toBeChecked()
    client.clear()
  })
})
