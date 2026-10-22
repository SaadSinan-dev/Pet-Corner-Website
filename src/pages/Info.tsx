import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Mail, MessageCircle, PawPrint, Phone, Truck } from 'lucide-react'
import { usePageMeta, useSettings } from '../lib/hooks'
import { DELIVERY_CONFIRMATION_MESSAGE } from '../lib/checkout'
import { normalizeWhatsAppNumber } from '../lib/whatsapp'
import { ErrorState } from '../components/Common'

const titles: Record<string, string> = { about: 'لهم ركن، ولنا حكاية.', contact: 'قريبون من أسئلتك.', faq: 'أسئلة صغيرة. إجابات واضحة.', shipping: 'من ركننا إلى بيتك.', privacy: 'خصوصية معلوماتك', terms: 'شروط استخدام المتجر' }
const pageLinks = [['about', 'حكايتنا'], ['contact', 'تواصل معنا'], ['faq', 'الأسئلة الشائعة'], ['shipping', 'التوصيل والاستلام'], ['privacy', 'الخصوصية'], ['terms', 'شروط الاستخدام']]
const questions = [
  ['كيف أرسل طلبًا؟', 'أضف المنتجات المتوفرة إلى السلة، راجع الكميات، وأكمل بيانات التوصيل. يظهر تأكيد الطلب ورقمه بعد حفظه في المتجر.'],
  ['هل يمكن تعديل السلة؟', 'نعم. يمكنك زيادة الكمية ضمن المخزون المتاح أو تقليلها أو حذف المنتج. نراجع الأسعار والكميات قبل إرسال الطلب.'],
  ['كيف أعرف تكلفة التوصيل؟', DELIVERY_CONFIRMATION_MESSAGE],
  ['هل تُرسل رسالة واتساب تلقائيًا؟', 'لا. بعد حفظ الطلب يمكنك فتح الرسالة الجاهزة على واتساب وإرسالها بنفسك إلى المتجر. يبقى طلبك محفوظًا حتى إذا أغلقت التطبيق.'],
  ['كيف أعود إلى ملخص طلبي؟', 'احتفظ بصفحة تأكيد الطلب في جلسة المتصفح نفسها. لحماية معلوماتك، لا يكفي رقم الطلب وحده للوصول إلى التفاصيل.'],
]

function safeSocialUrl(value: string) {
  try {
    const url = new URL(value)
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch { return null }
}

export default function InfoPage() {
  const slug = useLocation().pathname.slice(1)
  const { data: settings, isPending, isError, refetch } = useSettings()
  const page = settings?.pages[slug]
  const title = page?.title || titles[slug] || 'صفحة غير موجودة'
  const whatsapp = normalizeWhatsAppNumber(settings?.whatsappNumber)
  const socials = (settings?.socialLinks || []).map(link => ({ ...link, url: safeSocialUrl(link.url) })).filter(link => link.url && link.label.trim())
  usePageMeta(title)

  return <div className="container info-page">
    <div className="info-intro"><span className="eyebrow" dir="ltr">PET CORNER / {slug.toUpperCase()}</span><h1>{title}</h1></div>
    <div className="info-layout">
      <nav className="info-nav" aria-label="معلومات المتجر">{pageLinks.map(([path, label]) => <Link key={path} to={`/${path}`} aria-current={slug === path ? 'page' : undefined}>{label}<ArrowLeft size={15} aria-hidden="true" /></Link>)}</nav>
      <section className="info-content">
        {isPending ? <div aria-busy="true" aria-label="جارٍ تحميل معلومات المتجر"><div className="skeleton skeleton-title" /><div className="skeleton detail-copy" /></div>
          : isError ? <ErrorState retry={() => { void refetch() }} />
            : slug === 'about' ? <>
              <PawPrint size={40} strokeWidth={1.2} aria-hidden="true" /><h2>رفقة تغيّر تفاصيل اليوم.</h2>
              {page?.body ? <p className="policy-body">{page.body}</p> : <><p>نعرف أن وجبة مناسبة، ولعبة محببة، وركنًا مريحًا قد تصنع يومًا أجمل لرفيقك. من هذه التفاصيل تبدأ فكرة Pet Corner: أن تجد احتياجات القطط والكلاب في مساحة واضحة وسهلة الاستخدام.</p><p>تصفح المنتجات بحسب الفئة، راجع تفاصيل كل منتج، واجمع اختياراتك في السلة. عند إرسال الطلب، نراجع الأسعار والكميات المتاحة ونحفظ ملخص طلبك لتعود إليه.</p></>}
              <Link className="button" to="/shop">تعرّف على المتجر <ArrowLeft size={17} /></Link>
            </> : slug === 'contact' ? <>
              <h2>كيف يمكننا مساعدتك؟</h2><p className="policy-body">{page?.body || 'لأسئلة المنتجات أو متابعة طلب، استخدم وسيلة التواصل المتاحة أدناه وأرفق رقم طلبك إن وجد.'}</p>
              <div className="contact-methods">
                {whatsapp && <a className="contact-method" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer"><MessageCircle size={21} aria-hidden="true" /><span>تواصل عبر واتساب<small><bdi>+{whatsapp}</bdi></small></span><ExternalLink size={16} aria-hidden="true" /></a>}
                {settings?.contactPhone && <a className="contact-method" href={`tel:${settings.contactPhone}`}><Phone size={21} aria-hidden="true" /><bdi>{settings.contactPhone}</bdi></a>}
                {settings?.contactEmail && <a className="contact-method" href={`mailto:${settings.contactEmail}`}><Mail size={21} aria-hidden="true" /><bdi>{settings.contactEmail}</bdi></a>}
                {socials.map((link, index) => <a className="contact-method" key={`${link.url}-${index}`} href={link.url!} target="_blank" rel="noopener noreferrer"><ExternalLink size={21} aria-hidden="true" />{link.label}</a>)}
              </div>
              {!whatsapp && !settings?.contactPhone && !settings?.contactEmail && socials.length === 0 && <div className="policy-pending">تفاصيل التواصل لم تُنشر بعد. سيضيف المتجر وسيلة التواصل المعتمدة هنا قبل الإطلاق التجاري.</div>}
            </> : slug === 'shipping' ? <>
              <Truck size={36} strokeWidth={1.3} aria-hidden="true" /><h2>تفاصيل واضحة قبل تأكيد الطلب.</h2>
              <p className="policy-body">{settings?.deliveryPolicy || page?.body || 'نراجع المحافظة والمدينة والعنوان الوارد في طلبك، ثم نتواصل معك لتأكيد تفاصيل التوصيل.'}</p>
              {settings?.deliveryPolicy && page?.body && page.body !== settings.deliveryPolicy && <p className="policy-body">{page.body}</p>}
              <div className="delivery-policy-notice"><MessageCircle size={24} strokeWidth={1.4} aria-hidden="true" /><p>{settings?.checkoutMessage || DELIVERY_CONFIRMATION_MESSAGE}</p></div>
              <p>المعروض في السلة هو مجموع المنتجات. تُضاف تكلفة التوصيل ويُعتمد الإجمالي النهائي بعد مراجعة الطلب من المتجر.</p>
              <Link className="text-link" to="/faq">إجابات عن الطلب والتوصيل <ArrowLeft size={17} /></Link>
            </> : slug === 'faq' ? <>
              <h2>قبل أن تختار لرفيقك.</h2>{page?.body ? <p className="policy-body">{page.body}</p> : questions.map(([question, answer]) => <details className="faq-item" key={question}><summary>{question}</summary><p>{answer}</p></details>)}
            </> : <>
              <h2>{page?.title || title}</h2>{page?.body ? <p className="policy-body">{page.body}</p> : <div className="policy-pending">لم ينشر المتجر هذه السياسة بعد. يلزم استكمال المحتوى واعتماده قبل استقبال طلبات تجارية.</div>}
            </>}
      </section>
    </div>
  </div>
}

export function NotFound() {
  usePageMeta('الصفحة غير موجودة', undefined, true)
  return <div className="container not-found"><span className="eyebrow">404 / ضللت الطريق؟</span><PawPrint size={64} strokeWidth={1} /><h1>هذا الركن غير موجود.</h1><p>قد يكون الرابط تغيّر. احتياجات رفيقك ما زالت بانتظارك في المتجر.</p><Link className="button" to="/shop">العودة إلى المتجر <ArrowLeft size={17} /></Link></div>
}
