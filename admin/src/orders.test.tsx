import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { OrderDetail } from './OrderPages'
import type { Order } from './types'
const fixture: Order = { id: 'order-1', orderCode: 'PC-REAL-1', customerName: 'عميل الاختبار', phone: '0944123456', governorate: 'دمشق', regionName: 'دمشق', city: 'المزة', address: 'عنوان تفصيلي للاختبار', notes: null, status: 'PREPARING', subtotal: 12000, deliveryFee: null, total: null, currency: 'SYP', createdAt: '2026-10-20T12:00:00.000Z', items: [{ productId: 'product-1', name: 'اسم محفوظ وقت الطلب', quantity: 2, price: 6000 }], history: [] }
function mount() { render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={['/orders/order-1']}><Routes><Route path="/orders/:id" element={<OrderDetail />} /></Routes></MemoryRouter></QueryClientProvider>) }
afterEach(() => vi.unstubAllGlobals())
it('keeps an unquoted order pending, saves a numeric fee, and shows the server total', async () => {
  let order = { ...fixture }
  const fetcher = vi.fn().mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/delivery')) { expect(JSON.parse(String(options.body))).toEqual({ deliveryFee: 3500 }); order = { ...order, deliveryFee: 3500, total: 15500 } }
    return new Response(JSON.stringify(order))
  }); vi.stubGlobal('fetch', fetcher); mount(); await screen.findByRole('heading', { name: 'طلب PC-REAL-1' }); expect(screen.getAllByText('بانتظار التأكيد')).toHaveLength(2); expect(screen.getByText('اسم محفوظ وقت الطلب')).toBeInTheDocument(); expect(screen.getByRole('link', { name: /التواصل عبر واتساب/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/963944123456?text=')); fireEvent.change(screen.getByLabelText(/تكلفة التوصيل الفعلية/), { target: { value: '3500' } }); fireEvent.click(screen.getByRole('button', { name: 'حفظ تكلفة التوصيل' })); await screen.findByText('تم حفظ تكلفة التوصيل وتحديث الإجمالي من الخادم.'); await waitFor(() => expect(screen.queryByText('بانتظار التأكيد')).not.toBeInTheDocument()); expect(fetcher.mock.calls.some(call => String(call[0]).endsWith('/delivery') && call[1].method === 'PATCH')).toBe(true)
})
it('shows a useful server transition error when dispatch is attempted before a quote', async () => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string) => url.endsWith('/status') ? new Response(JSON.stringify({ message: 'حدد تكلفة التوصيل قبل إرسال الطلب' }), { status: 409 }) : new Response(JSON.stringify(fixture)))); mount(); await screen.findByRole('heading', { name: 'طلب PC-REAL-1' }); fireEvent.change(screen.getByLabelText(/الحالة التالية/), { target: { value: 'OUT_FOR_DELIVERY' } }); fireEvent.click(screen.getByRole('button', { name: 'تحديث حالة الطلب' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('حدد تكلفة التوصيل قبل إرسال الطلب')); expect(screen.getAllByText('قيد التجهيز').length).toBeGreaterThan(0)
})
