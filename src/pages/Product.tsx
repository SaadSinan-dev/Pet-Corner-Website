import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { api, money } from '../lib/api'
import { usePageMeta, useSettings } from '../lib/hooks'
import { useCart } from '../lib/cart'
import { Breadcrumb, ErrorState, ProductImage } from '../components/Common'
import { ProductCard } from '../components/ProductCard'
import { resolveImageUrl } from '../lib/urls'

export default function ProductRoute() {
  const { slug = '' } = useParams()
  return <ProductPage key={slug} />
}
function ProductPage() {
  const { slug = '' } = useParams()
  const [quantity, setQuantity] = useState(1)
  const [imageIndex, setImageIndex] = useState(0)
  const { add } = useCart()
  const { data: settings } = useSettings()
  const query = useQuery({ queryKey: ['product', slug], queryFn: ({ signal }) => api.product(slug, signal) })
  const product = query.data
  const related = useQuery({ queryKey: ['related', product?.category.slug], queryFn: ({ signal }) => api.products({ category: product!.category.slug, limit: '5' }, signal), enabled: !!product })
  usePageMeta(product?.name || 'تفاصيل المنتج', product?.shortDescription, false, product?.images[0]?.url)
  useEffect(() => {
    const siteUrl = import.meta.env.VITE_SITE_URL as string | undefined
    if (!product || !siteUrl || !settings || settings.demoMode) return
    document.head.querySelector('meta[property="og:type"]')?.setAttribute('content', 'product')
    const structured = document.createElement('script')
    structured.type = 'application/ld+json'
    structured.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description, ...(product.sku ? { sku: product.sku } : {}), image: product.images.map(item => resolveImageUrl(item.url)).filter(Boolean).map(url => new URL(url, siteUrl).href), offers: { '@type': 'Offer', price: product.price, priceCurrency: settings.currency, availability: `https://schema.org/${product.stock > 0 ? 'InStock' : 'OutOfStock'}`, url: new URL(`/product/${product.slug}`, siteUrl).href } })
    document.head.append(structured)
    return () => structured.remove()
  }, [product, settings])
  if (query.isPending) return <div className="container product-page"><div className="product-detail"><div className="skeleton detail-image" /><div><div className="skeleton skeleton-title" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-price" /><div className="skeleton detail-copy" /></div></div></div>
  if (query.isError) return <div className="container product-page"><ErrorState title="تعذّر عرض هذا المنتج" message="قد يكون المنتج غير متاح الآن، أو حدث خطأ في الاتصال." retry={() => { void query.refetch() }} /><Link className="text-link" to="/shop">العودة إلى المتجر <ArrowLeft size={16} /></Link></div>
  if (!product) return null
  const image = product.images[imageIndex] || product.images[0]
  return <div className="container product-page"><Breadcrumb current={product.name} category={product.category} /><div className="product-detail"><div className="product-gallery"><div className="detail-image"><ProductImage src={image?.url} alt={image?.alt || product.name} eager /></div>{product.images.length > 1 && <div className="product-thumbnails">{product.images.map((item, i) => <button className={imageIndex === i ? 'selected' : ''} onClick={() => setImageIndex(i)} key={item.id} aria-label={`عرض الصورة ${i + 1}`} aria-pressed={imageIndex === i}><ProductImage src={item.url} alt={item.alt} /></button>)}</div>}</div><div className="product-detail-copy"><Link className="eyebrow" to={`/category/${product.category.slug}`}>{product.category.name}</Link><h1>{product.name}</h1><p className="detail-summary">{product.shortDescription}</p><div className="detail-prices"><span className="price">{money(product.price, settings?.currencyLabel)}</span>{product.compareAtPrice !== null && product.compareAtPrice > product.price && <del>{money(product.compareAtPrice, settings?.currencyLabel)}</del>}</div><span className={`stock-status ${product.stock === 0 ? 'unavailable' : ''}`}><Check size={15} />{product.stock > 0 ? 'متوفر للطلب' : 'غير متوفر حاليًا'}</span><div className="detail-purchase"><div className="quantity-control"><button aria-label="تقليل الكمية" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus size={17} /></button><output aria-label="الكمية">{Math.min(quantity, Math.max(1, product.stock))}</output><button aria-label="زيادة الكمية" disabled={quantity >= Math.min(product.stock, 99)} onClick={() => setQuantity(quantity + 1)}><Plus size={17} /></button></div><button className="button" disabled={product.stock < 1} onClick={() => add(product, Math.min(quantity, product.stock))}><ShoppingBag size={19} />{product.stock > 0 ? 'أضف إلى السلة' : 'نفدت الكمية'}</button></div><div className="product-extra"><span>التوصيل <Link to="/shipping">المناطق والتكلفة <ArrowLeft size={15} /></Link></span>{product.sku && <span>رمز المنتج <bdi>{product.sku}</bdi></span>}<span>الفئة <Link to={`/category/${product.category.slug}`}>{product.category.name}</Link></span></div><details className="product-description" open><summary>تفاصيل تهمّك</summary><p>{product.description}</p></details></div></div>{related.data && related.data.items.some(item => item.id !== product.id) && <section className="related-products"><div className="section-heading"><div><span className="eyebrow">في الركن نفسه</span><h2>قد تناسب رفيقك أيضًا.</h2></div></div><div className="product-grid">{related.data.items.filter(item => item.id !== product.id).slice(0, 4).map(item => <ProductCard key={item.id} product={item} />)}</div></section>}</div>
}
