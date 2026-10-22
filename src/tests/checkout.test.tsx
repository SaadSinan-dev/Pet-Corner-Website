/// <reference types="node" />
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { webcrypto } from 'node:crypto'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkoutSchema, clearCheckoutAttempt, getCheckoutKey, normalizePhone, readPendingCheckout, readReceiptToken, savePendingCheckout, saveReceiptToken } from '../lib/checkout'
import { api, ApiError } from '../lib/api'
import { CartProvider } from '../lib/cart'
import { CartPage, CheckoutPage, OrderSuccessPage } from '../pages/Commerce'
import type { OrderInput, OrderReceipt, Product, StoreSettings } from '../lib/types'

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111'
const input: OrderInput = {
  customerName: 'سارة أحمد', phone: '+963912345678', governorate: 'دمشق', city: 'دمشق',
  address: 'المزة، شارع الجامعة، بناء ١٢', items: [{ productId: PRODUCT_ID, quantity: 2 }],
}
const product: Product = {
  id: PRODUCT_ID, name: 'طعام القطط', slug: 'cat-food', shortDescription: '', description: '', sku: null,
  price: 35000, compareAtPrice: null, stock: 3, featured: false, images: [],
  category: { id: 'cats', name: 'القطط', slug: 'cats' }, createdAt: '2026-10-21T00:00:00Z',
}
const settings: StoreSettings = {
  storeName: 'Pet Corner', currency: 'SYP', currencyLabel: 'ل.س', demoMode: false,
  codEnabled: true, checkoutEnabled: true, contactPhone: null, contactEmail: null,
  deliveryRegions: [{ id: 'damascus', name: 'دمشق', fee: 5000 }], pages: {},
}
const receipt: OrderReceipt = {
  id: 'order-1', orderCode: 'PC-ONE', accessToken: 'secret-token', status: 'PENDING',
  customerName: 'سارة أحمد', phone: '+963912345678', governorate: 'دمشق', regionName: 'دمشق', city: 'دمشق', whatsappNumber: '+963912345678',
  address: 'المزة، شارع الجامعة، بناء ١٢', notes: null,
  items: [{ productId: PRODUCT_ID, name: 'طعام القطط', price: 35000, quantity: 2 }],
  subtotal: 70000, deliveryFee: null, total: null, currency: 'SYP', createdAt: '2026-10-21T00:00:00Z',
}
beforeEach(() => { sessionStorage.clear(); localStorage.clear(); vi.stubGlobal('crypto', webcrypto) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); clearCheckoutAttempt(); vi.unstubAllGlobals() })

function mountCheckout() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><CartProvider><MemoryRouter initialEntries={['/checkout']}><Routes>
    <Route path="/cart" element={<CartPage />} />
    <Route path="/checkout" element={<CheckoutPage />} />
    <Route path="/order-success/:orderCode" element={<OrderSuccessPage />} />
  </Routes></MemoryRouter></CartProvider></QueryClientProvider>)
  return { client, ...view }
}

function mountReceipt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/order-success/PC-ONE']}><Routes>
    <Route path="/order-success/:orderCode" element={<OrderSuccessPage />} />
  </Routes></MemoryRouter></QueryClientProvider>)
  return { client, ...view }
}

async function fillCheckout() {
  await screen.findByLabelText('الاسم الكامل')
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: input.customerName } })
  fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '٠٩١٢٣٤٥٦٧٨' } })
  fireEvent.change(screen.getByLabelText('المحافظة'), { target: { value: 'دمشق' } })
  fireEvent.change(screen.getByLabelText('المدينة أو البلدة'), { target: { value: input.city } })
  fireEvent.change(screen.getByLabelText('العنوان التفصيلي'), { target: { value: input.address } })
}

describe('checkout validation and recovery', () => {
  it('shows pending shipping until the server provides the quoted delivery fee and final total', async () => {
    saveReceiptToken('PC-ONE', 'secret-token')
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    const getReceipt = vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const { client } = mountReceipt()
    await screen.findByText('تم استلام طلبك')
    expect(screen.getByText('سيتم تأكيد تكلفة التوصيل والإجمالي النهائي معك عبر واتساب بعد مراجعة تفاصيل الطلب')).toBeTruthy()
    expect(screen.queryByText('الإجمالي النهائي')).toBeNull()
    expect(screen.getByText('قيد التأكيد')).toBeTruthy()
    getReceipt.mockResolvedValue({ ...receipt, deliveryFee: 5000, total: 75000 })
    await client.invalidateQueries({ queryKey: ['receipt', 'PC-ONE'] })
    await screen.findByText('الإجمالي النهائي')
    expect(screen.queryByText('قيد التأكيد')).toBeNull()
    expect(screen.getByText(/٧٥٬٠٠٠/)).toBeTruthy()
    client.clear()
  })

  it('prepares an encoded WhatsApp message from the saved receipt without opening or sending automatically', async () => {
    saveReceiptToken('PC-ONE', 'secret-token')
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    vi.spyOn(api, 'receipt').mockResolvedValue({ ...receipt, items: [{ ...receipt.items[0], name: 'طعام & قطط #١' }] })
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { client } = mountReceipt()
    const link = await screen.findByRole('link', { name: 'متابعة الطلب عبر واتساب' })
    const url = new URL(link.getAttribute('href')!)
    expect(url.origin + url.pathname).toBe('https://wa.me/963912345678')
    const text = url.searchParams.get('text')!
    expect(text).toContain('PC-ONE')
    expect(text).toContain('طعام & قطط #١')
    expect(text).toContain('× 2')
    expect(text).toContain('مجموع المنتجات')
    expect(text).toContain('سارة أحمد')
    expect(text).toContain('+963912345678')
    expect(text).toContain('تكلفة التوصيل والإجمالي النهائي قيد التأكيد')
    expect(text).not.toContain('secret-token')
    expect(screen.getByText(/تفتح الرسالة جاهزة.*إرسالها بنفسك/)).toBeTruthy()
    expect(open).not.toHaveBeenCalled()
    client.clear()
  })

  it.each([null, '', 'not-a-number', '0912345678', '+96312', 'https://evil.example'])('hides WhatsApp when the saved store number is invalid: %s', async (whatsappNumber) => {
    saveReceiptToken('PC-ONE', 'secret-token')
    vi.spyOn(api, 'settings').mockResolvedValue({ ...settings, contactPhone: '+963912345678' })
    vi.spyOn(api, 'receipt').mockResolvedValue({ ...receipt, whatsappNumber })
    const { client } = mountReceipt()
    await screen.findByText('تم استلام طلبك')
    expect(screen.queryByRole('link', { name: 'متابعة الطلب عبر واتساب' })).toBeNull()
    client.clear()
  })

  it.each([
    ['٠٩١٢ ٣٤٥ ٦٧٨', '+963912345678'], ['۰۰۹۶۳۹۱۲۳۴۵۶۷۸', '+963912345678'],
    ['+963 (912) 345-678', '+963912345678'], ['0112345678', '+963112345678'],
  ])('normalizes Syrian phone %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected)
  })

  it('rejects incomplete customer data and invalid telephone numbers', () => {
    expect(checkoutSchema.safeParse({ ...input, phone: '123', address: '' }).success).toBe(false)
    const result = checkoutSchema.safeParse({ ...input, phone: '٠٩١٢٣٤٥٦٧٨' })
    expect(result.success && result.data.phone).toBe('+963912345678')
  })

  it('requires one of the fourteen Syrian governorates without a delivery fee selection', () => {
    expect(checkoutSchema.safeParse({ ...input, governorate: '' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...input, governorate: 'غير موجودة' }).success).toBe(false)
    expect(checkoutSchema.safeParse({ ...input, governorate: 'القنيطرة' }).success).toBe(true)
  })

  it('offers all fourteen governorates and submits without a legacy delivery region or computed fee', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue({ ...settings, deliveryRegions: [] })
    vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product, productId: PRODUCT_ID, quantity: 2 }] })
    const order = vi.spyOn(api, 'order').mockResolvedValue(receipt)
    vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const { client } = mountCheckout()
    await fillCheckout()
    expect(screen.getAllByRole('option')).toHaveLength(15)
    expect(screen.queryByText('الإجمالي النهائي')).toBeNull()
    expect(screen.getByText('سيتم تأكيد تكلفة التوصيل والإجمالي النهائي معك عبر واتساب بعد مراجعة تفاصيل الطلب')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('تم استلام طلبك')
    expect(order.mock.calls[0][0]).toMatchObject(input)
    expect(order.mock.calls[0][0]).not.toHaveProperty('regionId')
    expect(order.mock.calls[0][0]).not.toHaveProperty('deliveryFee')
    client.clear()
  })

  it('preserves a legacy pending payload and its original key without upgrading its fields', async () => {
    const { governorate: _governorate, ...customer } = input
    const legacy = { ...customer, regionId: 'damascus' }
    const key = await getCheckoutKey(legacy)
    savePendingCheckout(legacy, key)
    vi.resetModules()
    const reloaded = await import('../lib/checkout')
    expect(reloaded.readPendingCheckout()).toEqual({ key, input: legacy })
    expect(await reloaded.getCheckoutKey(legacy)).toBe(key)
    expect(reloaded.readPendingCheckout()?.input).not.toHaveProperty('governorate')
    const originalPayload = JSON.stringify({ customerName: legacy.customerName, phone: legacy.phone, regionId: legacy.regionId,
      city: legacy.city, address: legacy.address, notes: '', items: legacy.items })
    const originalDigest = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(originalPayload))
    const originalFingerprint = Array.from(new Uint8Array(originalDigest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    expect(JSON.parse(sessionStorage.getItem('pet-corner:checkout-attempt')!).fingerprint).toBe(originalFingerprint)
  })

  it('replays a legacy saved order through checkout unchanged even when checkout is now disabled', async () => {
    const { governorate: _governorate, ...customer } = input
    const legacy = { ...customer, regionId: 'damascus' }
    const key = await getCheckoutKey(legacy)
    savePendingCheckout(legacy, key)
    vi.spyOn(api, 'settings').mockResolvedValue({ ...settings, checkoutEnabled: false })
    const validate = vi.spyOn(api, 'validateCart')
    const placeOrder = vi.spyOn(api, 'order').mockResolvedValue(receipt)
    vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const { client } = mountCheckout()
    fireEvent.click(await screen.findByRole('button', { name: 'التحقق من الطلب السابق' }))
    await screen.findByText('تم استلام طلبك')
    expect(placeOrder.mock.calls[0]).toEqual([legacy, key])
    expect(validate).not.toHaveBeenCalled()
    expect(readPendingCheckout()).toBeNull()
    client.clear()
  })

  it('preserves an attempt key for retries and reloads but changes it for changed order data', async () => {
    const first = await getCheckoutKey(input)
    expect(first).toMatch(/^[0-9a-f-]{36}$/)
    expect(await getCheckoutKey({ ...input })).toBe(first)
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toContain(first)
    vi.resetModules()
    const afterReload = await import('../lib/checkout')
    expect(await afterReload.getCheckoutKey(input)).toBe(first)
    const changed = await getCheckoutKey({ ...input, address: 'عنوان آخر في دمشق' })
    expect(changed).not.toBe(first)
  })

  it('requires the receipt token belonging to the exact order code', () => {
    saveReceiptToken('PC-ONE', 'private-first-token')
    expect(readReceiptToken('PC-ONE')).toBe('private-first-token')
    expect(readReceiptToken('PC-TWO')).toBeNull()
    sessionStorage.removeItem('pet-corner:receipt:PC-ONE')
    expect(readReceiptToken('PC-ONE')).toBeNull()
  })

  it('restores an unresolved payload after a module reload and prevents a changed payload from replacing it', async () => {
    const key = await getCheckoutKey(input)
    savePendingCheckout(input, key)
    vi.resetModules()
    const reloaded = await import('../lib/checkout')
    expect(reloaded.readPendingCheckout()).toEqual({ key, input })
    await expect(reloaded.getCheckoutKey({ ...input, customerName: 'اسم مختلف' })).rejects.toThrow()
    expect(readPendingCheckout()).toEqual({ key, input })
    clearCheckoutAttempt()
    expect(readPendingCheckout()).toBeNull()
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toBeNull()
  })

  it('keeps a pending order usable when quota rejects writes while storage reads still succeed', async () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const key = await getCheckoutKey(input)
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toBeNull()
    expect(() => savePendingCheckout(input, key)).not.toThrow()
    expect(readPendingCheckout()).toEqual({ key, input })
    expect(await getCheckoutKey(input)).toBe(key)
    writes.mockRestore()
    savePendingCheckout(input, key)
    expect(JSON.parse(sessionStorage.getItem('pet-corner:checkout-attempt') || '{}')).toMatchObject({ key, input })
    clearCheckoutAttempt()
    expect(readPendingCheckout()).toBeNull()
  })

  it('masks a stale persisted attempt after quota failures and a failed clear', async () => {
    const originalKey = await getCheckoutKey(input)
    const changedInput = { ...input, address: 'عنوان جديد في مدينة دمشق' }
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    const currentKey = await getCheckoutKey(changedInput)
    expect(currentKey).not.toBe(originalKey)
    savePendingCheckout(changedInput, currentKey)
    expect(readPendingCheckout()).toEqual({ key: currentKey, input: changedInput })
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toContain(originalKey)
    const removals = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    clearCheckoutAttempt()
    expect(readPendingCheckout()).toBeNull()
    const nextKey = await getCheckoutKey(input)
    expect(nextKey).not.toBe(originalKey)
    expect(nextKey).not.toBe(currentKey)
    writes.mockRestore()
    removals.mockRestore()
    clearCheckoutAttempt()
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toBeNull()
  })

  it('uses the latest receipt token after a quota failure until a later write succeeds', () => {
    saveReceiptToken('PC-QUOTA', 'old-token')
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    saveReceiptToken('PC-QUOTA', 'latest-token')
    saveReceiptToken('PC-QUOTA-NEW', 'new-token')
    expect(sessionStorage.getItem('pet-corner:receipt:PC-QUOTA')).toBe('old-token')
    expect(sessionStorage.getItem('pet-corner:receipt:PC-QUOTA-NEW')).toBeNull()
    expect(readReceiptToken('PC-QUOTA')).toBe('latest-token')
    expect(readReceiptToken('PC-QUOTA-NEW')).toBe('new-token')
    expect(readReceiptToken('PC-UNRELATED')).toBeNull()
    writes.mockRestore()
    saveReceiptToken('PC-QUOTA', 'persisted-token')
    expect(sessionStorage.getItem('pet-corner:receipt:PC-QUOTA')).toBe('persisted-token')
    sessionStorage.removeItem('pet-corner:receipt:PC-QUOTA')
    expect(readReceiptToken('PC-QUOTA')).toBeNull()
    saveReceiptToken('PC-QUOTA-NEW', 'persisted-new-token')
    sessionStorage.removeItem('pet-corner:receipt:PC-QUOTA-NEW')
    expect(readReceiptToken('PC-QUOTA-NEW')).toBeNull()
  })

  it('retains pending orders and receipt access when browser storage is fully blocked', async () => {
    const reads = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const removals = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    const key = await getCheckoutKey(input)
    savePendingCheckout(input, key)
    expect(readPendingCheckout()).toEqual({ key, input })
    saveReceiptToken('PC-BLOCKED', 'private-token')
    expect(readReceiptToken('PC-BLOCKED')).toBe('private-token')
    clearCheckoutAttempt()
    expect(readPendingCheckout()).toBeNull()
    reads.mockRestore(); writes.mockRestore(); removals.mockRestore()
    clearCheckoutAttempt()
    saveReceiptToken('PC-BLOCKED', 'persisted-token')
    sessionStorage.removeItem('pet-corner:receipt:PC-BLOCKED')
  })

  it('retains the form and cart after failure, then clears only after a confirmed server order', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product, productId: PRODUCT_ID, quantity: 2 }] })
    const placeOrder = vi.spyOn(api, 'order').mockRejectedValueOnce(new Error('الاتصال غير متاح')).mockResolvedValue(receipt)
    vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><CartProvider><MemoryRouter initialEntries={['/checkout']}><Routes>
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/order-success/:orderCode" element={<OrderSuccessPage />} />
    </Routes></MemoryRouter></CartProvider></QueryClientProvider>)
    await screen.findByLabelText('الاسم الكامل')
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: input.customerName } })
    fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '٠٩١٢٣٤٥٦٧٨' } })
    fireEvent.change(screen.getByLabelText('المحافظة'), { target: { value: 'دمشق' } })
    fireEvent.change(screen.getByLabelText('المدينة أو البلدة'), { target: { value: input.city } })
    fireEvent.change(screen.getByLabelText('العنوان التفصيلي'), { target: { value: input.address } })
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('الاتصال غير متاح')
    expect(JSON.parse(localStorage.getItem('pet-corner:cart') || '[]')).toEqual(input.items)
    expect((screen.getByLabelText('الاسم الكامل') as HTMLInputElement).value).toBe(input.customerName)
    const firstKey = placeOrder.mock.calls[0][1]
    fireEvent.click(await screen.findByRole('button', { name: 'التحقق من الطلب السابق' }))
    await screen.findByText('تم استلام طلبك')
    await waitFor(() => expect(localStorage.getItem('pet-corner:cart')).toBe('[]'))
    expect(placeOrder.mock.calls[1][1]).toBe(firstKey)
    expect(readReceiptToken('PC-ONE')).toBe('secret-token')
    expect(screen.getByText('المزة، شارع الجامعة، بناء ١٢')).toBeTruthy()
    client.clear()
  })

  it('recovers a committed order with its exact original payload after a lost response and consumed stock', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    const validation = vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product, productId: PRODUCT_ID, quantity: 2 }] })
    const placeOrder = vi.spyOn(api, 'order').mockRejectedValueOnce(new ApiError('انتهت مهلة الاتصال', 0)).mockResolvedValue(receipt)
    vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const { client } = mountCheckout()
    await fillCheckout()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('انتهت مهلة الاتصال')
    fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'هبة محمد' } })
    validation.mockResolvedValue({ items: [{ product: { ...product, stock: 0 }, productId: PRODUCT_ID, quantity: 2 }] })
    await client.invalidateQueries({ queryKey: ['cart-validation'] })
    await screen.findByText('تحتاج السلة إلى تحديث')
    const callsBeforeRecovery = validation.mock.calls.length
    expect(JSON.parse(localStorage.getItem('pet-corner:cart') || '[]')).toEqual(input.items)
    fireEvent.click(screen.getByRole('button', { name: 'التحقق من الطلب السابق' }))
    await screen.findByText('تم استلام طلبك')
    expect(placeOrder.mock.calls[1][0]).toMatchObject(input)
    expect(placeOrder.mock.calls[1][1]).toBe(placeOrder.mock.calls[0][1])
    expect(validation.mock.calls.length).toBe(callsBeforeRecovery)
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toBeNull()
    expect(localStorage.getItem('pet-corner:cart')).toBe('[]')
    client.clear()
  })

  it('offers persisted-order recovery after reload even with an empty cart and disabled or unavailable storefront data', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    const getSettings = vi.spyOn(api, 'settings').mockResolvedValue(settings)
    const validation = vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product, productId: PRODUCT_ID, quantity: 2 }] })
    const placeOrder = vi.spyOn(api, 'order').mockRejectedValueOnce(new ApiError('تعذّر وصول نتيجة الطلب', 503)).mockResolvedValue(receipt)
    vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const firstView = mountCheckout()
    await fillCheckout()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('تعذّر وصول نتيجة الطلب')
    const persisted = JSON.parse(sessionStorage.getItem('pet-corner:checkout-attempt') || '{}') as { input?: OrderInput; key?: string }
    expect(persisted.input).toMatchObject(input)
    expect(persisted.key).toBe(placeOrder.mock.calls[0][1])
    firstView.unmount()
    firstView.client.clear()
    localStorage.setItem('pet-corner:cart', '[]')
    getSettings.mockResolvedValue({ ...settings, checkoutEnabled: false, codEnabled: false, deliveryRegions: [] })
    validation.mockRejectedValue(new ApiError('بيانات السلة غير متاحة', 503))
    const secondView = mountCheckout()
    fireEvent.click(await screen.findByRole('button', { name: 'التحقق من الطلب السابق' }))
    await screen.findByText('تم استلام طلبك')
    expect(placeOrder.mock.calls[1][0]).toEqual(placeOrder.mock.calls[0][0])
    expect(placeOrder.mock.calls[1][1]).toBe(persisted.key)
    expect(readReceiptToken('PC-ONE')).toBe('secret-token')
    expect(sessionStorage.getItem('pet-corner:checkout-attempt')).toBeNull()
    secondView.client.clear()
  })

  it.each([[422, false], [409, true], [503, true], [429, true]] as const)('handles order response %i without losing unresolved requests', async (status, unresolved) => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product, productId: PRODUCT_ID, quantity: 2 }] })
    vi.spyOn(api, 'order').mockRejectedValue(new ApiError('تعذّر تأكيد الطلب', status))
    const { client } = mountCheckout()
    await fillCheckout()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('تعذّر تأكيد الطلب')
    expect(Boolean(readPendingCheckout())).toBe(unresolved)
    expect(Boolean(screen.queryByRole('button', { name: 'التحقق من الطلب السابق' }))).toBe(unresolved)
    expect(localStorage.getItem('pet-corner:cart')).toBe(JSON.stringify(input.items))
    client.clear()
  })

  it('clears a definitive stock rejection so the shopper can correct quantities and submit a new order', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    let currentStock = 3
    vi.spyOn(api, 'validateCart').mockImplementation(async (items) => ({ items: items.map((line) => ({ ...line, product: { ...product, stock: currentStock } })) }))
    const placeOrder = vi.spyOn(api, 'order').mockRejectedValueOnce(new ApiError('الكمية المتاحة غير كافية', 409, 'OUT_OF_STOCK')).mockResolvedValue({
      ...receipt, items: [{ ...receipt.items[0], quantity: 1 }], subtotal: 35000, total: 40000,
    })
    vi.spyOn(api, 'receipt').mockResolvedValue({ ...receipt, items: [{ ...receipt.items[0], quantity: 1 }], subtotal: 35000, total: 40000 })
    const { client } = mountCheckout()
    await fillCheckout()
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('الكمية المتاحة غير كافية')
    expect(readPendingCheckout()).toBeNull()
    expect(screen.queryByRole('button', { name: 'التحقق من الطلب السابق' })).toBeNull()
    expect(localStorage.getItem('pet-corner:cart')).toBe(JSON.stringify(input.items))
    currentStock = 1
    fireEvent.click(screen.getByRole('link', { name: 'العودة إلى السلة' }))
    fireEvent.click(await screen.findByRole('button', { name: 'تقليل كمية طعام القطط' }))
    fireEvent.click(await screen.findByRole('link', { name: 'إكمال الطلب' }))
    await fillCheckout()
    await waitFor(() => expect((screen.getByRole('button', { name: 'تأكيد الطلب' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(screen.getByRole('button', { name: 'تأكيد الطلب' }))
    await screen.findByText('تم استلام طلبك')
    expect(placeOrder.mock.calls[1][0].items).toEqual([{ productId: PRODUCT_ID, quantity: 1 }])
    expect(placeOrder.mock.calls[1][1]).not.toBe(placeOrder.mock.calls[0][1])
    client.clear()
  })

  it('blocks a stale cart with insufficient stock before it can submit', async () => {
    localStorage.setItem('pet-corner:cart', JSON.stringify(input.items))
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    vi.spyOn(api, 'validateCart').mockResolvedValue({ items: [{ product: { ...product, stock: 1 }, productId: PRODUCT_ID, quantity: 2 }] })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><CartProvider><MemoryRouter><CheckoutPage /></MemoryRouter></CartProvider></QueryClientProvider>)
    await screen.findByText('تحتاج السلة إلى تحديث')
    expect(screen.queryByRole('button', { name: 'تأكيد الطلب' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('pet-corner:cart') || '[]')).toEqual(input.items)
    client.clear()
  })

  it('shows no private receipt data when only an order code is supplied', async () => {
    vi.spyOn(api, 'settings').mockResolvedValue(settings)
    const getReceipt = vi.spyOn(api, 'receipt').mockResolvedValue(receipt)
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    client.setQueryData(['receipt', 'PC-ONE'], receipt)
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/order-success/PC-ONE']}><Routes>
      <Route path="/order-success/:orderCode" element={<OrderSuccessPage />} />
    </Routes></MemoryRouter></QueryClientProvider>)
    expect(screen.getByText('الإيصال خاص بصاحب الطلب')).toBeTruthy()
    expect(screen.queryByText('سارة أحمد')).toBeNull()
    expect(getReceipt).not.toHaveBeenCalled()
    client.clear()
  })
})

