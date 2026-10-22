import { money } from './api'
import type { OrderReceipt } from './types'

export function normalizeWhatsAppNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const formatted = value.trim().replace(/[\s()-]/g, '')
  const international = formatted.startsWith('00') ? formatted.slice(2) : formatted.replace(/^\+/, '')
  return /^[1-9]\d{7,14}$/.test(international) ? international : null
}

// This only prepares a link. Opening WhatsApp and sending the message are customer actions.
export function orderWhatsAppUrl(order: OrderReceipt, currencyLabel = order.currency): string | null {
  const number = normalizeWhatsAppNumber(order.whatsappNumber)
  if (!number) return null
  const shippingPending = order.deliveryFee === null || order.total === null
  const message = [
    `مرحبًا، أود متابعة طلبي رقم ${order.orderCode}`,
    '', 'المنتجات:',
    ...order.items.map((item) => `${item.name} × ${item.quantity} — ${money(item.price * item.quantity, currencyLabel)}`),
    '', `مجموع المنتجات: ${money(order.subtotal, currencyLabel)}`,
    ...(shippingPending
      ? ['تكلفة التوصيل والإجمالي النهائي قيد التأكيد بعد مراجعة تفاصيل الطلب.']
      : [`تكلفة التوصيل: ${money(order.deliveryFee!, currencyLabel)}`, `الإجمالي النهائي: ${money(order.total!, currencyLabel)}`]),
    '', `الاسم: ${order.customerName}`, `رقم الهاتف: ${order.phone}`,
    `المحافظة: ${order.governorate || order.regionName}`, `المدينة أو المنطقة: ${order.city}`,
    `العنوان: ${order.address}`,
    ...(order.notes ? [`ملاحظات: ${order.notes}`] : []),
  ].join('\n')
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}
