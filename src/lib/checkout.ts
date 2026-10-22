import { z } from 'zod'
import type { OrderInput } from './types'

export function normalizePhone(value: string): string {
  const digits = value.replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[\s()-]/g, '')
  if (digits.startsWith('00963')) return `+963${digits.slice(5)}`
  if (digits.startsWith('963')) return `+${digits}`
  if (digits.startsWith('0')) return `+963${digits.slice(1)}`
  return digits
}

export const SYRIAN_GOVERNORATES = ['دمشق', 'ريف دمشق', 'القنيطرة', 'درعا', 'السويداء', 'حمص', 'حماة', 'طرطوس', 'اللاذقية', 'إدلب', 'حلب', 'الرقة', 'دير الزور', 'الحسكة'] as const
export const DELIVERY_CONFIRMATION_MESSAGE = 'سيتم تأكيد تكلفة التوصيل والإجمالي النهائي معك عبر واتساب بعد مراجعة تفاصيل الطلب'

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2, 'أدخل الاسم الكامل.').max(100, 'الاسم طويل جدًا.'),
  phone: z.string().transform(normalizePhone).refine((value) => /^\+963[1-9]\d{7,8}$/.test(value), 'أدخل رقمًا سوريًا صالحًا، مثل 0912345678 أو +963912345678.'),
  governorate: z.enum(SYRIAN_GOVERNORATES, { error: 'اختر المحافظة.' }),
  city: z.string().trim().min(2, 'أدخل اسم المدينة أو البلدة.').max(100, 'اسم المدينة طويل جدًا.'),
  address: z.string().trim().min(8, 'أدخل عنوانًا تفصيليًا يساعدنا في الوصول إليك.').max(500, 'يجب ألا يتجاوز العنوان ٥٠٠ حرف.'),
  notes: z.string().trim().max(1000, 'يجب ألا تتجاوز الملاحظات ١٠٠٠ حرف.').optional(),
})
export type CheckoutValues = z.infer<typeof checkoutSchema>

const ATTEMPT_KEY = 'pet-corner:checkout-attempt'
const RECEIPT_PREFIX = 'pet-corner:receipt:'
const memorySessionValues = new Map<string, string | null>()
const failedSessionWrites = new Set<string>()
// Validate saved attempts without trimming or normalizing any part of the original payload.
// The server hashes that exact payload; changing even a legacy field would break recovery.
const savedCustomerFields = {
  customerName: z.string().min(2).max(100), phone: z.string().min(1).max(40),
  city: z.string().min(2).max(100), address: z.string().min(8).max(500), notes: z.string().max(1000).optional(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100) }).strict()).min(1).max(50),
}
const pendingInputSchema = z.union([
  z.object({ ...savedCustomerFields, governorate: z.enum(SYRIAN_GOVERNORATES) }).strict(),
  z.object({ ...savedCustomerFields, regionId: z.string().min(1) }).strict(),
])
const storedAttemptSchema = z.object({
  fingerprint: z.string().regex(/^[\da-f]{64}$/i), key: z.string().uuid(), input: pendingInputSchema.optional(),
})
type CheckoutAttempt = { fingerprint: string; key: string; input?: OrderInput }
export interface PendingCheckout { key: string; input: OrderInput }

function readSessionValue(key: string): string | null {
  if (failedSessionWrites.has(key)) return memorySessionValues.get(key) ?? null
  try {
    const value = sessionStorage.getItem(key)
    memorySessionValues.set(key, value)
    return value
  } catch { return memorySessionValues.get(key) ?? null }
}

function writeSessionValue(key: string, value: string | null) {
  memorySessionValues.set(key, value)
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
    failedSessionWrites.delete(key)
  } catch {
    // Readable storage may still contain an older value after a failed write or removal.
    failedSessionWrites.add(key)
  }
}

function readAttempt(): CheckoutAttempt | null {
  const stored = readSessionValue(ATTEMPT_KEY)
  if (!stored) return null
  try {
    const parsed = storedAttemptSchema.safeParse(JSON.parse(stored) as unknown)
    return parsed.success ? parsed.data : null
  } catch { return null }
}

function writeAttempt(attempt: CheckoutAttempt) {
  writeSessionValue(ATTEMPT_KEY, JSON.stringify(attempt))
}

export function readPendingCheckout(): PendingCheckout | null {
  const attempt = readAttempt()
  return attempt?.input ? { key: attempt.key, input: attempt.input } : null
}

export function savePendingCheckout(input: OrderInput, key: string): PendingCheckout {
  const attempt = readAttempt()
  if (!attempt || attempt.key !== key) throw new Error('تعذّر حفظ بيانات الطلب للمحاولة مجددًا. يرجى إعادة المحاولة.')
  const capturedInput: OrderInput = { ...input, items: input.items.map((line) => ({ ...line })) }
  writeAttempt({ ...attempt, input: capturedInput })
  return { key, input: capturedInput }
}

export async function getCheckoutKey(input: OrderInput): Promise<string> {
  const payload = JSON.stringify({
    customerName: input.customerName, phone: input.phone,
    ...(input.governorate !== undefined ? { governorate: input.governorate } : { regionId: input.regionId }),
    city: input.city, address: input.address, notes: input.notes || '',
    items: [...input.items].sort((a, b) => a.productId.localeCompare(b.productId)),
  })
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload))
  const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('')
  let attempt = readAttempt()
  if (attempt?.input && attempt.fingerprint !== fingerprint) throw new Error('تحقّق من نتيجة الطلب السابق قبل إرسال طلب جديد.')
  if (!attempt || attempt.fingerprint !== fingerprint) attempt = { fingerprint, key: crypto.randomUUID() }
  writeAttempt(attempt)
  return attempt.key
}

export function clearCheckoutAttempt() {
  writeSessionValue(ATTEMPT_KEY, null)
}

export function saveReceiptToken(code: string, token: string) {
  if (!code || !token) return
  writeSessionValue(`${RECEIPT_PREFIX}${code}`, token)
}

export function readReceiptToken(code: string): string | null {
  return readSessionValue(`${RECEIPT_PREFIX}${code}`) || null
}
