import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InfoPage from '../pages/Info'
import { api } from '../lib/api'
import type { StoreSettings } from '../lib/types'
import { DELIVERY_CONFIRMATION_MESSAGE } from '../lib/checkout'

const settings: StoreSettings = {
  storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false,
  codEnabled: false, checkoutEnabled: false, contactPhone: '+963912345678', contactEmail: 'store@example.com',
  deliveryRegions: [], pages: {},
}

function renderInfo(slug: string, data: StoreSettings) {
  vi.spyOn(api, 'settings').mockResolvedValue(data)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/${slug}`]}><InfoPage /></MemoryRouter></QueryClientProvider>)
  return client
}
afterEach(() => vi.restoreAllMocks())

describe('managed information pages', () => {
  it.each(['about', 'faq', 'contact'])('displays the configured %s title and plain-text body', async (slug) => {
    const client = renderInfo(slug, { ...settings, pages: { [slug]: { title: 'عنوان المتجر المعتمد', body: 'محتوى معتمد من الإدارة <script>example</script>' } } })
    expect(await screen.findByRole('heading', { name: 'عنوان المتجر المعتمد', level: 1 })).toBeVisible()
    expect(screen.getByText('محتوى معتمد من الإدارة <script>example</script>')).toBeVisible()
    if (slug === 'contact') {
      expect(screen.getByRole('link', { name: '+963912345678' })).toHaveAttribute('href', 'tel:+963912345678')
      expect(screen.getByRole('link', { name: 'store@example.com' })).toHaveAttribute('href', 'mailto:store@example.com')
    }
    client.clear()
  })

  it.each([
    ['about', 'رفقة تغيّر تفاصيل اليوم.'], ['faq', 'كيف أرسل طلبًا؟'], ['contact', 'كيف يمكننا مساعدتك؟'],
  ])('retains helpful fallback content when %s has no managed page', async (slug, content) => {
    const client = renderInfo(slug, settings)
    expect(await screen.findByText(content)).toBeVisible()
    client.clear()
  })

  it('shows managed delivery policy and pending confirmation without old region fees', async () => {
    const client = renderInfo('shipping', { ...settings, deliveryRegions: [{ id: 'old', name: 'منطقة قديمة', fee: 12500 }], deliveryPolicy: 'سياسة توصيل معتمدة من الإدارة' })
    expect(await screen.findByText('سياسة توصيل معتمدة من الإدارة')).toBeVisible()
    expect(screen.getByText(DELIVERY_CONFIRMATION_MESSAGE)).toBeVisible()
    expect(screen.queryByText('منطقة قديمة')).not.toBeInTheDocument()
    expect(screen.queryByText(/اختر منطقتك/)).not.toBeInTheDocument()
    client.clear()
  })

  it('uses the configured checkout message and only valid configured external links', async () => {
    const client = renderInfo('contact', { ...settings, whatsappNumber: '+963 912 345 678', socialLinks: [{ label: 'حساب المتجر', url: 'https://example.com/pet-corner' }, { label: 'رابط غير آمن', url: 'javascript:alert(1)' }] })
    expect(await screen.findByRole('link', { name: /واتساب/ })).toHaveAttribute('href', 'https://wa.me/963912345678')
    expect(screen.getByRole('link', { name: 'حساب المتجر' })).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.queryByRole('link', { name: 'رابط غير آمن' })).not.toBeInTheDocument()
    client.clear()
  })

  it('displays the configured shipping checkout message', async () => {
    const client = renderInfo('shipping', { ...settings, checkoutMessage: 'نراجع الطلب ثم نخبرك بتكلفة التوصيل.' })
    expect(await screen.findByText('نراجع الطلب ثم نخبرك بتكلفة التوصيل.')).toBeVisible()
    client.clear()
  })
})
