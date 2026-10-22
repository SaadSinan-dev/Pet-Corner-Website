import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Banknote, CheckCircle2, MessageCircle, Minus, Package, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { api, ApiError, money } from '../lib/api'
import { useCart } from '../lib/cart'
import { ProductImage } from '../components/Common'
import { usePageMeta } from '../lib/hooks'
import { checkoutSchema, clearCheckoutAttempt, DELIVERY_CONFIRMATION_MESSAGE, getCheckoutKey, readPendingCheckout, readReceiptToken, savePendingCheckout, saveReceiptToken, SYRIAN_GOVERNORATES } from '../lib/checkout'
import { orderWhatsAppUrl } from '../lib/whatsapp'
import type { CheckoutValues, PendingCheckout } from '../lib/checkout'
import type { CartLine, OrderInput, Product, StoreSettings, ValidatedCart } from '../lib/types'
import './commerce.css'

type CartRow = { productId: string; quantity: number; product: Product | null }

function cartRows(items: CartLine[], validation: ValidatedCart | undefined): CartRow[] {
  return items.map((line) => ({ ...line, product: validation?.items.find((item) => item.productId === line.productId)?.product || null }))
}

function invalidRow(row: CartRow) {
  return !row.product || row.product.stock < row.quantity || row.product.stock < 1
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'تعذّر إكمال العملية. حاول مرة أخرى.'
}

function useCommerceData() {
  const cart = useCart()
  const settings = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => api.settings(signal), staleTime: 30_000 })
  const validation = useQuery({
    queryKey: ['cart-validation', cart.items], queryFn: ({ signal }) => api.validateCart(cart.items, signal),
    enabled: cart.items.length > 0, staleTime: 0, refetchOnMount: 'always', retry: 1,
  })
  const rows = cartRows(cart.items, validation.data)
  return { cart, settings, validation, rows, hasProblems: rows.some(invalidRow) }
}

function LoadingCart() {
  return <div className="commerce-loading" role="status" aria-label="جارٍ التحقق من السلة">
    <span className="skeleton" /><span className="skeleton" /><span className="skeleton" />
    <span className="muted">نتحقق من الأسعار والكميات المتاحة…</span>
  </div>
}

function EmptyCart() {
  return <div className="commerce-empty"><ShoppingBag size={50} strokeWidth={1.3} aria-hidden="true" />
    <h2>سلتك بانتظار اختياراتك</h2><p>اكتشف ما يحتاجه رفيقك، واجمع مفضّلاته هنا.</p>
    <Link className="button" to="/shop">تصفّح المنتجات</Link>
  </div>
}

function DemoNotice({ settings }: { settings: StoreSettings }) {
  return settings.demoMode ? <div className="commerce-notice" role="note">هذا متجر تجريبي. المنتجات والأسعار المعروضة مخصّصة للتجربة، والطلب لا يُعدّ شراءً فعليًا.</div> : null
}

function DataError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="error-state" role="alert"><h2>تعذّر تحميل بيانات السلة</h2><p>{message}</p>
    <button className="button secondary" onClick={retry}>حاول مرة أخرى</button>
  </div>
}

export function CartPage() {
  usePageMeta('سلة التسوّق', 'راجع منتجاتك وكمياتها قبل إكمال طلبك من Pet Corner.', true)
  const { cart, settings, validation, rows, hasProblems } = useCommerceData()
  const pendingAttempt = readPendingCheckout()
  const subtotal = rows.reduce((sum, row) => sum + (row.product?.price || 0) * row.quantity, 0)
  const ready = settings.isSuccess && validation.isSuccess
  return <section className="container commerce-page">
    <div className="page-heading"><p className="eyebrow">اختيارات رفيقك</p><h1>سلة التسوّق</h1><p>راجع منتجاتك وكمياتها قبل إكمال الطلب.</p></div>
    {pendingAttempt && <div className="commerce-notice"><h2>تحقّق من نتيجة طلبك السابق</h2><p>لم نتمكن من تأكيد نتيجة الطلب الذي أرسلته. تحقّق منه قبل إرسال طلب جديد.</p><Link className="button secondary" to="/checkout">التحقق من الطلب السابق</Link></div>}
    {cart.items.length === 0 ? <EmptyCart /> : settings.isPending || validation.isPending ? <LoadingCart />
      : settings.isError || validation.isError ? <DataError message={errorMessage(settings.error || validation.error)} retry={() => { void settings.refetch(); void validation.refetch() }} />
        : ready ? <>
          <DemoNotice settings={settings.data} />
          {hasProblems && <div className="commerce-notice danger" role="alert">تغيّر توفّر بعض المنتجات. حدّث الكميات أو احذف المنتجات غير المتاحة لإكمال الطلب.</div>}
          <div className="commerce-grid"><div className="commerce-lines">
            {rows.map((row) => <article className="commerce-line" key={row.productId}>
              <div className="commerce-line-image">{row.product
                ? <ProductImage key={row.product.images[0]?.url || row.product.id} src={row.product.images[0]?.url} alt={row.product.images[0]?.alt || row.product.name} />
                : <Package size={32} aria-hidden="true" />}</div>
              <div><span className="commerce-line-category">{row.product?.category.name || 'منتج غير متاح'}</span>
                <h2>{row.product ? <Link to={`/product/${row.product.slug}`}>{row.product.name}</Link> : 'هذا المنتج لم يعد متاحًا'}</h2>
                {row.product && <span className="price">{money(row.product.price * row.quantity, settings.data.currencyLabel)}</span>}
                {invalidRow(row) && <div className="commerce-stock-message">{!row.product || row.product.stock < 1 ? 'يرجى إزالة هذا المنتج من السلة.' : `المتاح الآن: ${row.product.stock.toLocaleString('ar-SY')} فقط.`}
                  {row.product && row.product.stock > 0 && <button onClick={() => cart.setQuantity(row.productId, Math.min(99, row.product!.stock))}>ضبط الكمية وفق المتاح</button>}
                </div>}
              </div>
              <div className="commerce-line-actions"><div className="commerce-quantity" aria-label={`كمية ${row.product?.name || 'المنتج'}`}>
                <button aria-label={`زيادة كمية ${row.product?.name || 'المنتج'}`} disabled={!row.product || row.quantity >= Math.min(row.product.stock, 99)} onClick={() => cart.setQuantity(row.productId, row.quantity + 1)}><Plus size={15} aria-hidden="true" /></button>
                <output aria-live="polite">{row.quantity.toLocaleString('ar-SY')}</output>
                <button aria-label={`تقليل كمية ${row.product?.name || 'المنتج'}`} disabled={row.quantity <= 1} onClick={() => cart.setQuantity(row.productId, row.quantity - 1)}><Minus size={15} aria-hidden="true" /></button>
              </div><button className="commerce-remove" aria-label={`حذف ${row.product?.name || 'المنتج'} من السلة`} onClick={() => cart.remove(row.productId)}><Trash2 size={14} aria-hidden="true" />حذف المنتج</button></div>
            </article>)}
          </div><aside className="commerce-summary"><h2>ملخّص السلة</h2><dl>
            <div><dt>عدد القطع</dt><dd>{cart.count.toLocaleString('ar-SY')}</dd></div>
            <div className="commerce-total"><dt>مجموع المنتجات</dt><dd className="price">{money(subtotal, settings.data.currencyLabel)}</dd></div>
          </dl><p className="commerce-delivery-note"><Truck size={20} aria-hidden="true" /><span>{DELIVERY_CONFIRMATION_MESSAGE}</span></p>
            {hasProblems || validation.isFetching || !settings.data.checkoutEnabled || !settings.data.codEnabled
              ? <button className="button" disabled>إكمال الطلب</button> : <Link className="button" to="/checkout">إكمال الطلب</Link>}
            {(!settings.data.checkoutEnabled || !settings.data.codEnabled) && <p className="commerce-summary-note">استقبال الطلبات غير متاح حاليًا. <Link to="/contact">تواصل معنا</Link></p>}
            <Link className="button secondary" to="/shop">متابعة التسوّق</Link>
          </aside></div>
        </> : null}
  </section>
}

export function CheckoutPage() {
  usePageMeta('إكمال الطلب', 'أكمل بيانات الاستلام وراجع مجموع منتجاتك لدى Pet Corner.', true)
  const { cart, settings, validation, rows, hasProblems } = useCommerceData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [pendingAttempt, setPendingAttempt] = useState(readPendingCheckout)
  const [isRecovering, setIsRecovering] = useState(false)
  const orderInFlight = useRef(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CheckoutValues>({
    resolver: zodResolver(checkoutSchema), defaultValues: { customerName: '', phone: '', city: '', address: '', notes: '' },
  })
  const subtotal = rows.reduce((sum, row) => sum + (row.product?.price || 0) * row.quantity, 0)
  async function sendAttempt(attempt: PendingCheckout) {
    try {
      const receipt = await api.order(attempt.input, attempt.key)
      saveReceiptToken(receipt.orderCode, receipt.accessToken)
      queryClient.setQueryData(['receipt', receipt.orderCode], receipt)
      clearCheckoutAttempt()
      setPendingAttempt(null)
      cart.clear()
      navigate(`/order-success/${encodeURIComponent(receipt.orderCode)}`, { replace: true })
    } catch (error) {
      // A named stock rejection is definitive; an unspecified conflict or interrupted response still needs replay.
      if (error instanceof ApiError && ((error.status === 409 && error.code === 'OUT_OF_STOCK') || (error.status >= 400 && error.status < 500 && ![408, 409, 425, 429].includes(error.status)))) {
        clearCheckoutAttempt()
        setPendingAttempt(null)
      }
      throw error
    }
  }
  async function recoverPreviousOrder() {
    if (orderInFlight.current) return
    const attempt = readPendingCheckout() || pendingAttempt
    if (!attempt) return
    orderInFlight.current = true
    setIsRecovering(true)
    setSubmitError(null)
    try { await sendAttempt(attempt) }
    catch (error) { setSubmitError(errorMessage(error)) }
    finally { orderInFlight.current = false; setIsRecovering(false) }
  }
  async function submit(values: CheckoutValues) {
    if (orderInFlight.current) return
    if (pendingAttempt || readPendingCheckout()) {
      setSubmitError('تحقّق من نتيجة الطلب السابق قبل إرسال طلب جديد.'); return
    }
    orderInFlight.current = true
    setSubmitError(null)
    const submittedItems = cart.items.map((line) => ({ ...line }))
    try {
      const [freshCart, freshSettings] = await Promise.all([validation.refetch(), settings.refetch()])
      if (freshCart.isError || freshSettings.isError) throw freshCart.error || freshSettings.error
      if (!freshCart.data || cartRows(submittedItems, freshCart.data).some(invalidRow)) {
        setSubmitError('تغيّر توفّر أحد المنتجات. عد إلى السلة لتحديثها قبل تأكيد الطلب.'); return
      }
      if (!freshSettings.data?.checkoutEnabled || !freshSettings.data.codEnabled) {
        setSubmitError('استقبال الطلبات غير متاح حاليًا. يمكنك التواصل معنا للمساعدة.'); return
      }
      const input: OrderInput = { ...values, notes: values.notes || undefined, items: submittedItems }
      const key = await getCheckoutKey(input)
      const attempt = savePendingCheckout(input, key)
      setPendingAttempt(attempt)
      await sendAttempt(attempt)
    } catch (error) {
      setSubmitError(errorMessage(error))
    } finally { orderInFlight.current = false }
  }
  const fieldError = (name: keyof CheckoutValues) => errors[name]?.message
    ? <span className="commerce-field-error" id={`${name}-error`} role="alert">{errors[name]?.message}</span> : null
  return <section className="container commerce-page">
    <Link className="commerce-return" to="/cart"><ArrowRight size={17} aria-hidden="true" />العودة إلى السلة</Link>
    <div className="page-heading"><p className="eyebrow">خطوة أقرب إلى رفيقك</p><h1>إكمال الطلب</h1><p>أضف بيانات الاستلام. نراجع طلبك ونتواصل معك لتأكيد التوصيل.</p></div>
    {pendingAttempt && <div className="commerce-notice commerce-recovery" aria-labelledby="previous-order-title"><h2 id="previous-order-title">لم تتأكد نتيجة الطلب السابق بعد</h2><p>أرسلت طلبًا باسم {pendingAttempt.input.customerName}. تحقّق من نتيجته قبل إرسال طلب جديد؛ سنستخدم بياناته الأصلية، حتى لو عدّلت النموذج أو السلة.</p><div className="commerce-recovery-actions"><button type="button" className="button" disabled={isSubmitting || isRecovering} onClick={() => { void recoverPreviousOrder() }}>{isRecovering ? 'جارٍ التحقق من الطلب…' : 'التحقق من الطلب السابق'}</button><Link to="/contact">التواصل مع المتجر</Link></div></div>}
    {submitError && <div className="commerce-notice danger" role="alert">{submitError}</div>}
    {cart.items.length === 0 ? <EmptyCart /> : settings.isPending || validation.isPending ? <LoadingCart />
      : settings.isError || validation.isError ? <DataError message={errorMessage(settings.error || validation.error)} retry={() => { void settings.refetch(); void validation.refetch() }} />
        : !settings.data?.checkoutEnabled || !settings.data.codEnabled ? <div className="commerce-empty"><h2>الطلب غير متاح حاليًا</h2><p>يمكنك الاحتفاظ بمنتجاتك في السلة والتواصل معنا للمساعدة.</p><Link className="button" to="/contact">تواصل معنا</Link></div>
          : hasProblems ? <div className="commerce-empty" role="alert"><Package size={44} aria-hidden="true" /><h2>تحتاج السلة إلى تحديث</h2><p>تغيّر توفّر بعض المنتجات. راجع سلتك لتعديل الكميات أو إزالة المنتجات غير المتاحة.</p><Link className="button" to="/cart">مراجعة السلة</Link></div>
            : <>
              <DemoNotice settings={settings.data} />
              <form onSubmit={(event) => { void handleSubmit(submit)(event) }} noValidate className="commerce-grid">
                <section className="commerce-form"><div className="commerce-section-heading"><span aria-hidden="true">01</span><div><h2>بيانات الاستلام</h2><p>عنوان واضح، ووصول أسهل.</p></div></div><div className="commerce-form-grid">
                  <div className="field"><label htmlFor="customerName">الاسم الكامل</label><input id="customerName" autoComplete="name" maxLength={100} aria-invalid={!!errors.customerName} aria-describedby={errors.customerName ? 'customerName-error' : undefined} {...register('customerName')} />{fieldError('customerName')}</div>
                  <div className="field"><label htmlFor="phone">رقم الهاتف</label><input id="phone" type="tel" dir="ltr" autoComplete="tel" placeholder="0912345678" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'phone-error' : 'phone-hint'} {...register('phone')} /><span className="commerce-field-hint" id="phone-hint">رقم سوري بالصيغة المحلية أو الدولية.</span>{fieldError('phone')}</div>
                  <div className="field"><label htmlFor="governorate">المحافظة</label><select id="governorate" autoComplete="address-level1" defaultValue="" aria-invalid={!!errors.governorate} aria-describedby={errors.governorate ? 'governorate-error' : undefined} {...register('governorate')}><option value="" disabled>اختر المحافظة</option>{SYRIAN_GOVERNORATES.map((governorate) => <option value={governorate} key={governorate}>{governorate}</option>)}</select>{fieldError('governorate')}</div>
                  <div className="field"><label htmlFor="city">المدينة أو البلدة</label><input id="city" autoComplete="address-level2" maxLength={100} aria-invalid={!!errors.city} aria-describedby={errors.city ? 'city-error' : undefined} {...register('city')} />{fieldError('city')}</div>
                  <div className="field full"><label htmlFor="address">العنوان التفصيلي</label><textarea id="address" autoComplete="street-address" maxLength={500} placeholder="الحي، الشارع، البناء، الطابق، وأقرب علامة مميزة" aria-invalid={!!errors.address} aria-describedby={errors.address ? 'address-error' : undefined} {...register('address')} />{fieldError('address')}</div>
                  <div className="field full"><label htmlFor="notes">ملاحظات الطلب <span className="muted">(اختياري)</span></label><textarea id="notes" maxLength={1000} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'notes-error' : undefined} {...register('notes')} />{fieldError('notes')}</div>
                </div><div className="commerce-payment"><div className="commerce-payment-title"><Banknote size={23} aria-hidden="true" />الدفع عند الاستلام</div><p>طريقة الدفع المتاحة لهذا الطلب.</p></div></section>
                <aside className="commerce-summary"><h2>طلبك</h2><ul className="commerce-mini-lines">{rows.map((row) => <li key={row.productId}><span>{row.product!.name} <span className="muted">× {row.quantity.toLocaleString('ar-SY')}</span></span><span>{money(row.product!.price * row.quantity, settings.data.currencyLabel)}</span></li>)}</ul><dl>
                  <div className="commerce-subtotal"><dt>مجموع المنتجات</dt><dd className="price">{money(subtotal, settings.data.currencyLabel)}</dd></div>
                  <div><dt>تكلفة التوصيل</dt><dd>تُحدّد بعد المراجعة</dd></div>
                </dl><p className="commerce-delivery-note"><Truck size={20} aria-hidden="true" /><span>{DELIVERY_CONFIRMATION_MESSAGE}</span></p>
                  {settings.data.checkoutMessage?.trim() && settings.data.checkoutMessage.trim() !== DELIVERY_CONFIRMATION_MESSAGE && <p className="commerce-summary-note">{settings.data.checkoutMessage}</p>}
                  <button type="submit" className="button" disabled={!!pendingAttempt || isSubmitting || isRecovering || validation.isFetching || settings.isFetching}>{isSubmitting ? 'جارٍ تأكيد الطلب…' : 'تأكيد الطلب'}</button>
                  <p className="commerce-summary-note">سيُراجع المتجر الأسعار والتوفّر عند التأكيد. تُحفظ بيانات إيصالك الخاص في هذه الجلسة.</p>
                </aside>
              </form>
            </>}
  </section>
}

const statusLabels: Record<string, string> = {
  PENDING: 'قيد المراجعة', CONFIRMED: 'تم التأكيد', PREPARING: 'قيد التجهيز',
  OUT_FOR_DELIVERY: 'في طريقه إليك', DELIVERED: 'تم التسليم', CANCELLED: 'أُلغي الطلب',
}

export function OrderSuccessPage() {
  usePageMeta('إيصال الطلب', 'إيصال خاص بتفاصيل طلبك لدى Pet Corner.', true)
  const { orderCode = '' } = useParams<{ orderCode: string }>()
  const token = readReceiptToken(orderCode)
  const settings = useQuery({ queryKey: ['settings'], queryFn: ({ signal }) => api.settings(signal), staleTime: 30_000 })
  const receipt = useQuery({
    queryKey: ['receipt', orderCode], enabled: !!orderCode && !!token,
    queryFn: async ({ signal }) => {
      const response = await api.receipt(orderCode, token!, signal)
      if (response.orderCode !== orderCode) throw new Error('تعذّر التحقق من بيانات هذا الطلب.')
      return response
    }, retry: false, staleTime: 0,
  })
  if (!token) return <section className="container commerce-page"><div className="commerce-empty"><Package size={46} aria-hidden="true" /><h1>الإيصال خاص بصاحب الطلب</h1><p>تفاصيل هذا الطلب غير متاحة في هذه الجلسة. افتح الإيصال من المتصفح الذي أتممت الطلب فيه، أو تواصل مع المتجر مع ذكر رقم الطلب.</p><Link className="button" to="/contact">تواصل مع المتجر</Link></div></section>
  if (receipt.isPending) return <section className="container commerce-page"><LoadingCart /></section>
  if (receipt.isError) return <section className="container commerce-page"><div className="error-state" role="alert"><h1>تعذّر عرض الإيصال</h1><p>{errorMessage(receipt.error)}</p><button className="button secondary" onClick={() => { void receipt.refetch() }}>حاول مرة أخرى</button><Link className="button secondary" to="/contact">تواصل معنا</Link></div></section>
  const order = receipt.data
  const currencyLabel = settings.data?.currency === order.currency ? settings.data.currencyLabel : order.currency
  const shippingPending = order.deliveryFee === null || order.total === null
  const whatsappUrl = orderWhatsAppUrl(order, currencyLabel)
  return <section className="container commerce-page"><div className="commerce-receipt">
    <header className="commerce-receipt-header"><CheckCircle2 size={56} strokeWidth={1.4} aria-hidden="true" /><p className="eyebrow">شكرًا لاختيارك Pet Corner</p><h1>تم استلام طلبك</h1><p className="muted">هذه تفاصيل طلبك كما سُجّلت لدى المتجر.</p><div className="commerce-receipt-code">رقم الطلب <strong dir="ltr">{order.orderCode}</strong></div></header>
    {settings.data && <DemoNotice settings={settings.data} />}
    <section className="commerce-receipt-card" aria-label="تفاصيل الإيصال"><dl className="commerce-receipt-meta">
      <div><dt>حالة الطلب</dt><dd>{statusLabels[order.status] || order.status}</dd></div>
      <div><dt>تاريخ الطلب</dt><dd>{new Date(order.createdAt).toLocaleString('ar-SY', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
      <div><dt>الاسم</dt><dd>{order.customerName}</dd></div><div><dt>رقم الهاتف</dt><dd dir="ltr">{order.phone}</dd></div>
      <div><dt>المحافظة والمدينة</dt><dd>{order.governorate || order.regionName}، {order.city}</dd></div><div><dt>العنوان</dt><dd>{order.address}</dd></div>
      {order.notes && <div><dt>الملاحظات</dt><dd>{order.notes}</dd></div>}
    </dl><h2>المنتجات</h2>{order.items.map((item) => <article className="commerce-receipt-item" key={item.productId}><h3>{item.name}</h3><p>{item.quantity.toLocaleString('ar-SY')} × {money(item.price, currencyLabel)}</p><span className="price">{money(item.price * item.quantity, currencyLabel)}</span></article>)}
      <dl className="commerce-receipt-totals"><div><dt>مجموع المنتجات</dt><dd>{money(order.subtotal, currencyLabel)}</dd></div><div><dt>رسوم التوصيل</dt><dd>{order.deliveryFee === null ? <span className="commerce-pending">قيد التأكيد</span> : money(order.deliveryFee, currencyLabel)}</dd></div>{!shippingPending && <div className="commerce-total"><dt>الإجمالي النهائي</dt><dd>{money(order.total!, currencyLabel)}</dd></div>}</dl>
      {shippingPending && <p className="commerce-delivery-note"><Truck size={20} aria-hidden="true" /><span>{DELIVERY_CONFIRMATION_MESSAGE}</span></p>}
    </section><p className="commerce-summary-note">احتفظ برقم طلبك للمتابعة. هذا الإيصال متاح في جلسة المتصفح الحالية فقط.</p>
    {whatsappUrl && <div className="commerce-whatsapp"><a className="button" href={whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19} aria-hidden="true" />متابعة الطلب عبر واتساب</a><p>تفتح الرسالة جاهزة في واتساب، وعليك إرسالها بنفسك. طلبك محفوظ حتى إذا أغلقت التطبيق.</p></div>}
    <div className="commerce-receipt-actions"><Link className="button secondary" to="/shop">متابعة التسوّق</Link><button className="button secondary" disabled={receipt.isFetching} onClick={() => { void receipt.refetch() }}>{receipt.isFetching ? 'جارٍ تحديث الطلب…' : 'تحديث حالة الطلب'}</button><Link className="button secondary" to="/contact">التواصل مع المتجر</Link></div>
  </div></section>
}
