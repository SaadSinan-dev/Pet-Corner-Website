import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Menu, Moon, Search, ShoppingBag, Sun, X, PawPrint, MapPin, ArrowUpLeft } from 'lucide-react'
import { useCart } from '../lib/cart'
import { useCategories, useSettings } from '../lib/hooks'
import { useTheme } from '../lib/theme'
import { MobileDrawer } from './MobileDrawer'

const copyrightYear = new Date().getFullYear()
export function Brand({ light = false }: { light?: boolean }) {
  const { data: settings } = useSettings()
  return <Link className={`brand ${light ? 'brand-light' : ''}`} to="/" aria-label={`${settings?.storeName || 'Pet Corner'} — الرئيسية`}><img src="/images/logo-original.png" width="52" height="52" alt="" /><span><strong dir="auto">{settings?.storeName || 'PET CORNER'}<span className="brand-period">.</span></strong><small>رفقة تستحق الاهتمام</small></span></Link>
}
function ThemeToggle({ label = false }: { label?: boolean }) {
  const { theme, toggle } = useTheme()
  const text = theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'
  return <button className={label ? 'drawer-theme' : 'icon-button theme-toggle'} onClick={toggle} aria-label={text}>{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}{label && <span>{text}</span>}</button>
}
export function Shell() {
  const [menuAt, setMenuAt] = useState<string | null>(null)
  const [searchAt, setSearchAt] = useState<string | null>(null)
  const { count, notice, dismissNotice } = useCart()
  const { data: settings } = useSettings()
  const { data: categories = [] } = useCategories()
  const catCategories = categories.filter(category => /cat|قط/.test(`${category.slug} ${category.name}`))
  const dogCategories = categories.filter(category => /dog|كلب|كلاب/.test(`${category.slug} ${category.name}`))
  const location = useLocation()
  const menu = menuAt === location.key
  const search = searchAt === location.key
  const setMenu = (open: boolean) => setMenuAt(open ? location.key : null)
  const setSearch = (open: boolean) => setSearchAt(open ? location.key : null)
  const navigate = useNavigate()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('main')?.focus({ preventScroll: true }) }, [location.pathname])
  useEffect(() => {
    if (!search) { dialog.current?.close(); return }
    dialog.current?.showModal()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [search])
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(dismissNotice, 4500); return () => clearTimeout(timer) }, [notice, dismissNotice])
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 701px)')
    const closeOnDesktop = () => { if (wide.matches) setMenuAt(null) }
    wide.addEventListener('change', closeOnDesktop)
    return () => wide.removeEventListener('change', closeOnDesktop)
  }, [])
  return <>
    <a className="skip-link" href="#main">انتقل إلى المحتوى</a>
    <div className="announcement"><div className="container"><span><PawPrint size={13} aria-hidden="true" /> تفاصيل صغيرة، تصنع فرقًا في يومهم.</span><Link to="/shipping">معلومات التوصيل <ArrowLeft size={13} /></Link></div></div>
    <header className="site-header"><div className="container header-inner"><Brand />
      <nav className="desktop-nav" aria-label="التنقل الرئيسي"><NavLink to="/" end>الرئيسية</NavLink><NavLink to="/shop">المتجر</NavLink>{catCategories[0] && <NavLink to={`/category/${catCategories[0].slug}`}>للقطط</NavLink>}{dogCategories[0] && <NavLink to={`/category/${dogCategories[0].slug}`}>للكلاب</NavLink>}<NavLink to="/about">حكايتنا</NavLink></nav>
      <div className="header-actions"><button className="icon-button" onClick={() => setSearch(true)} aria-label="البحث عن منتجات"><Search size={21} /></button><ThemeToggle /><span className="header-divider" /><Link className="cart-link" to="/cart" aria-label={`سلة التسوق، ${count} منتجات`}><ShoppingBag size={21} /><span className="cart-label">السلة</span><span className="cart-count" key={count}>{count}</span></Link><button className="icon-button mobile-menu-button" aria-expanded={menu} aria-controls="mobile-nav" aria-label="فتح القائمة" onClick={() => setMenu(true)}><Menu /></button></div>
    </div></header>
    <MobileDrawer open={menu} close={() => setMenu(false)}><div className="drawer-header"><Brand /><button className="icon-button" autoFocus onClick={() => setMenu(false)} aria-label="إغلاق القائمة"><X /></button></div><div className="drawer-intro"><span className="eyebrow">PET CORNER</span><p>كل ما يحتاجه رفيقك.<br /><strong>في ركن واحد.</strong></p></div><nav aria-label="التنقل على الهاتف" onClick={event => { if ((event.target as HTMLElement).closest('a')) setMenu(false) }}><NavLink to="/" end>الرئيسية <ArrowLeft size={17} /></NavLink><NavLink to="/shop">جميع المنتجات <ArrowLeft size={17} /></NavLink>{[...catCategories, ...dogCategories].length > 0 && <div className="drawer-categories"><span>للقطط والكلاب</span>{[...catCategories, ...dogCategories].map(category => <Link key={category.id} to={`/category/${category.slug}`}>{category.name}<small>{category.productCount}</small></Link>)}</div>}<Link to="/about">من نحن</Link><Link to="/contact">تواصل معنا</Link><Link to="/faq">الأسئلة الشائعة</Link><Link to="/shipping">سياسة التوصيل</Link><Link className="drawer-cart" to="/cart"><span><ShoppingBag size={18} />سلة التسوق</span><b>{count}</b></Link></nav><div className="drawer-bottom"><ThemeToggle label /><span>لرفقة تجعل الحياة أجمل.</span></div></MobileDrawer>
    {settings?.demoMode && <div className="demo-strip">نسخة تجريبية — المنتجات والأسعار بيانات للاختبار، والطلبات لا تُنفّذ تجاريًا.</div>}
    <main id="main" tabIndex={-1}><Outlet /></main>
    <footer className="site-footer"><div className="container"><div className="footer-top"><div className="footer-story"><Brand light /><p>{settings?.footerText || 'لهم مكان في قلوبنا.\nولكل ما يحتاجونه، مكان هنا.'}</p><span className="footer-location"><MapPin size={15} /> موجه للسوق السوري</span>{settings?.socialLinks?.some(link => /^https?:\/\//.test(link.url)) && <div className="footer-socials">{settings.socialLinks.filter(link => /^https?:\/\//.test(link.url)).map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ArrowUpLeft size={14} /></a>)}</div>}</div><div><h2>اكتشف {settings?.storeName || 'Pet Corner'}</h2><Link to="/shop">تصفح المتجر</Link>{catCategories[0] && <Link to={`/category/${catCategories[0].slug}`}>عالم القطط</Link>}{dogCategories[0] && <Link to={`/category/${dogCategories[0].slug}`}>عالم الكلاب</Link>}<Link to="/about">حكايتنا</Link></div><div><h2>نحن هنا للمساعدة</h2><Link to="/contact">تواصل معنا</Link><Link to="/faq">الأسئلة الشائعة</Link><Link to="/shipping">التوصيل والاستلام</Link><Link to="/cart">سلة التسوق</Link></div><div className="footer-note"><PawPrint size={29} strokeWidth={1.1} /><h2>اهتمام يبدأ باختيارك.</h2><p>طعام، لعب، وعناية.<br />احتياجات يومية لرفقة أجمل.</p><Link className="footer-shop" to="/shop">اختر لرفيقك <ArrowLeft size={17} /></Link></div></div><div className="footer-bottom"><span dir="auto">© {copyrightYear} {settings?.storeName || 'Pet Corner'}</span><div><Link to="/privacy">الخصوصية</Link><Link to="/terms">شروط الاستخدام</Link></div><span className="footer-signoff">من أجل كل ذيل سعيد.</span></div></div></footer>
    {notice && <div className="cart-toast" role="status" key={notice}><Check size={19} /><span>{notice}</span><Link to="/cart">عرض السلة</Link><button className="icon-button" aria-label="إغلاق التنبيه" onClick={dismissNotice}><X size={17} /></button></div>}
    <dialog ref={dialog} className="search-dialog" onClose={() => setSearch(false)} onClick={event => { if (event.target === event.currentTarget) setSearch(false) }}><div className="search-dialog-inner"><div className="dialog-heading"><h2>عن ماذا يبحث رفيقك؟</h2><button className="icon-button" autoFocus onClick={() => setSearch(false)} aria-label="إغلاق البحث"><X /></button></div><form onSubmit={event => { event.preventDefault(); const value = new FormData(event.currentTarget).get('search')?.toString().trim() || ''; navigate(`/shop${value ? `?search=${encodeURIComponent(value)}` : ''}`); setSearch(false) }}><label className="sr-only" htmlFor="site-search">ابحث في المنتجات</label><Search size={21} /><input id="site-search" name="search" placeholder="طعام، ألعاب، أو مستلزمات عناية…" maxLength={100} /><button className="button" type="submit">بحث <ArrowLeft size={17} /></button></form><p>ابدأ باسم المنتج أو نوعه، وسنساعدك في الوصول إليه.</p></div></dialog>
  </>
}
