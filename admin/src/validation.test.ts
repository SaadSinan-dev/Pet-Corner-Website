import { describe, expect, it } from 'vitest'
import { blankProduct, customerWhatsApp, integer, nextStatuses, productPayload, validateProduct } from './validation'
describe('commercial product input', () => {
  const valid = { ...blankProduct, name: 'غذاء القطط', slug: 'cat-food', description: 'وصف تفصيلي', shortDescription: 'وصف المنتج', categoryId: 'category-id', price: '12000', stock: '5', images: [{ url: '/uploads/cat.webp', alt: 'غذاء القطط' }] }
  it('rejects incomplete products and invalid sale price before saving', () => { expect(validateProduct(blankProduct)).toHaveProperty('images'); expect(validateProduct({ ...valid, compareAtPrice: '12000' })).toHaveProperty('compareAtPrice'); expect(validateProduct({ ...valid, compareAtPrice: '12500' })).toEqual({}) })
  it('preserves ordered image metadata and clears optional values as null', () => { const payload = productPayload({ ...valid, images: [...valid.images, { url: 'https://example.com/food.webp', alt: 'صورة خلفية' }] }); expect(payload.price).toBe(12000); expect(payload.sku).toBeNull(); expect(payload.compareAtPrice).toBeNull(); expect(payload.images.map(i => i.alt)).toEqual(['غذاء القطط', 'صورة خلفية']) })
  it('rejects fractional, scientific, missing and overflowing monetary values', () => { for (const value of ['', '-1', '1.5', '1e4', '100000001', 'Infinity']) expect(integer(value)).toBe(false); expect(integer('0')).toBe(true); expect(validateProduct({ ...valid, images: [{ url: 'javascript:alert(1)', alt: 'صورة' }] })).toHaveProperty('images') })
})
describe('order operations', () => {
  it('limits cancellation to before dispatch and leaves completed orders final', () => { expect(nextStatuses('PREPARING')).toEqual(['OUT_FOR_DELIVERY', 'CANCELLED']); expect(nextStatuses('OUT_FOR_DELIVERY')).toEqual(['DELIVERED']); expect(nextStatuses('DELIVERED')).toEqual([]); expect(nextStatuses('CANCELLED')).toEqual([]) })
  it('prepares an encoded WhatsApp draft and normalizes Syrian local numbers', () => { const url = customerWhatsApp('0944 123 456', 'الطلب PC-123 قيد التأكيد'); expect(url).toContain('https://wa.me/963944123456?text='); expect(decodeURIComponent(url!)).toContain('قيد التأكيد'); expect(customerWhatsApp('123', 'رسالة')).toBeNull() })
})
