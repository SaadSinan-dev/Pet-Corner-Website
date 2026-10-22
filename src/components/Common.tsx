import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ImageOff, PackageOpen, RefreshCw } from 'lucide-react'
import { resolveImageUrl } from '../lib/urls'

export function ProductImage({ src, alt, className = '', eager = false }: { src?: string; alt: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false)
  const imageUrl = resolveImageUrl(src)
  if (!imageUrl || failed) return <div className={`image-fallback ${className}`} role="img" aria-label={alt}><ImageOff size={34} aria-hidden="true" /><span>صورة المنتج غير متاحة</span></div>
  return <img className={className} src={imageUrl} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)} />
}
export function ErrorState({ retry, title = 'تعذّر تحميل المحتوى', message = 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى.' }: { retry?: () => void; title?: string; message?: string }) {
  return <div className="error-state" role="alert"><PackageOpen size={38} aria-hidden="true" /><h2>{title}</h2><p>{message}</p>{retry && <button className="button secondary" onClick={retry}><RefreshCw size={17} />إعادة المحاولة</button>}</div>
}
export function EmptyState({ title = 'لا توجد منتجات هنا بعد', message = 'جرّب فئة أخرى أو عدّل خيارات البحث.' }: { title?: string; message?: string }) {
  return <div className="empty-state"><PackageOpen size={44} strokeWidth={1.2} aria-hidden="true" /><h2>{title}</h2><p>{message}</p><Link className="text-link" to="/shop">تصفح المتجر <ArrowLeft size={17} /></Link></div>
}
export function ProductSkeletons({ count = 4 }: { count?: number }) {
  return <div className="product-grid" aria-label="جارٍ تحميل المنتجات" aria-busy="true">{Array.from({ length: count }, (_, i) => <div className="product-card" key={i}><div className="skeleton skeleton-image" /><div className="skeleton skeleton-label" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-price" /></div>)}</div>
}
export function Breadcrumb({ current, category }: { current: string; category?: { name: string; slug: string } }) {
  return <nav className="breadcrumb" aria-label="مسار التصفح"><Link to="/">الرئيسية</Link><span>/</span><Link to="/shop">المتجر</Link>{category && <><span>/</span><Link to={`/category/${category.slug}`}>{category.name}</Link></>}<span>/</span><span aria-current="page">{current}</span></nav>
}
