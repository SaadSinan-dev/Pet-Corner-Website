import type { Image, Status } from './types'
export function integer(value: string, max = 100000000) { return value.trim() !== '' && /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= max }
export const validImage = (value: string) => /^(?:\/(?:uploads|images)\/[a-zA-Z0-9_./-]+|https:\/\/[^\s<>"']+)$/.test(value)
export const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
export interface ProductForm { name: string; slug: string; shortDescription: string; description: string; sku: string; price: string; compareAtPrice: string; stock: string; categoryId: string; active: boolean; featured: boolean; position: string; images: Image[] }
export const blankProduct: ProductForm = { name: '', slug: '', shortDescription: '', description: '', sku: '', price: '', compareAtPrice: '', stock: '0', categoryId: '', active: true, featured: false, position: '0', images: [] }
export function validateProduct(form: ProductForm) {
  const errors: Record<string, string> = {}
  if (form.name.trim().length < 2 || form.name.length > 200) errors.name = 'أدخل اسمًا بين حرفين و٢٠٠ حرف.'
  if (!validSlug(form.slug) || form.slug.length > 120) errors.slug = 'استخدم أحرفًا إنجليزية صغيرة وأرقامًا وشرطات، مثال: cat-food.'
  if (!form.shortDescription.trim() || form.shortDescription.length > 350) errors.shortDescription = 'أدخل وصفًا مختصرًا حتى ٣٥٠ حرفًا.'
  if (!form.description.trim() || form.description.length > 10000) errors.description = 'أدخل وصفًا حتى ١٠٬٠٠٠ حرف.'
  if (!integer(form.price)) errors.price = 'أدخل سعرًا صحيحًا بين ٠ و١٠٠٬٠٠٠٬٠٠٠.'
  if (form.compareAtPrice && (!integer(form.compareAtPrice) || Number(form.compareAtPrice) <= Number(form.price))) errors.compareAtPrice = 'يجب أن يكون السعر السابق أعلى من السعر الحالي.'
  if (!integer(form.stock, 1000000)) errors.stock = 'أدخل كمية صحيحة بين ٠ ومليون.'
  if (!integer(form.position, 1000000)) errors.position = 'أدخل ترتيبًا صحيحًا بين ٠ ومليون.'
  if (!form.categoryId) errors.categoryId = 'اختر فئة المنتج.'
  if (form.sku.length > 100) errors.sku = 'رمز المنتج لا يتجاوز ١٠٠ حرف.'
  if (!form.images.length || form.images.length > 10 || form.images.some(i => !validImage(i.url) || !i.alt.trim() || i.alt.length > 200)) errors.images = 'أضف من صورة إلى ١٠ صور مع وصف بديل لكل صورة.'
  return errors
}
export function productPayload(form: ProductForm) { return { ...form, name: form.name.trim(), shortDescription: form.shortDescription.trim(), description: form.description.trim(), sku: form.sku.trim() || null, price: Number(form.price), compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : null, stock: Number(form.stock), position: Number(form.position), images: form.images.map(i => ({ url: i.url, alt: i.alt.trim() })) } }
export function nextStatuses(status: Status): Status[] { const next: Partial<Record<Status, Status>> = { PENDING: 'CONFIRMED', CONFIRMED: 'PREPARING', PREPARING: 'OUT_FOR_DELIVERY', OUT_FOR_DELIVERY: 'DELIVERED' }; return [...(next[status] ? [next[status]!] : []), ...(['PENDING', 'CONFIRMED', 'PREPARING'].includes(status) ? ['CANCELLED' as const] : [])] }
export function customerWhatsApp(phone: string, message: string) { let number = phone.replace(/\D/g, ''); if (number.startsWith('00')) number = number.slice(2); if (number.startsWith('0')) number = `963${number.slice(1)}`; return /^[1-9]\d{6,14}$/.test(number) ? `https://wa.me/${number}?text=${encodeURIComponent(message)}` : null }
