import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Plus, Check, ArrowUpLeft } from 'lucide-react'
import type { Product } from '../lib/types'
import { money } from '../lib/api'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/hooks'
import { ProductImage } from './Common'

export function ProductCard({ product }: { product: Product }) {
  const { add, items, notice } = useCart()
  const [quantityBeforeAdd, setQuantityBeforeAdd] = useState<number | null>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const quantity = items.find(item => item.productId === product.id)?.quantity || 0
  const added = quantityBeforeAdd !== null && quantity > quantityBeforeAdd && notice === 'أُضيف المنتج إلى سلتك.'
  useEffect(() => () => clearTimeout(feedbackTimer.current), [])
  const { data: settings } = useSettings()
  const discounted = product.compareAtPrice !== null && product.compareAtPrice > product.price
  function addToCart() {
    clearTimeout(feedbackTimer.current)
    setQuantityBeforeAdd(quantity)
    add(product)
    feedbackTimer.current = setTimeout(() => setQuantityBeforeAdd(null), 1800)
  }
  return <article className={`product-card${added ? ' product-card-added' : ''}`}>
    <Link className="product-image-link" to={`/product/${product.slug}`} tabIndex={-1} aria-hidden="true">
      <ProductImage src={product.images[0]?.url} alt={product.images[0]?.alt || product.name} />
      {product.stock === 0 ? <span className="product-badge sold-out">غير متوفر</span> : discounted && <span className="product-badge">خصم {Math.round((1 - product.price / product.compareAtPrice!) * 100)}٪</span>}
      <span className="image-arrow"><ArrowUpLeft size={20} /></span>
    </Link>
    <Link className="product-category" to={`/category/${product.category.slug}`}>{product.category.name}</Link>
    <h3><Link to={`/product/${product.slug}`}>{product.name}</Link></h3>
    <p className="product-short">{product.shortDescription}</p>
    <div className="product-card-bottom"><div className="prices"><span className="price">{money(product.price, settings?.currencyLabel)}</span>{discounted && <del>{money(product.compareAtPrice!, settings?.currencyLabel)}</del>}</div><button className={`add-button${added ? ' is-added' : ''}`} aria-label={added ? `أُضيف ${product.name} إلى السلة. إضافة قطعة أخرى` : `إضافة ${product.name} إلى السلة`} disabled={product.stock < 1} onClick={addToCart}>{added ? <Check size={20} aria-hidden="true" /> : <Plus size={20} aria-hidden="true" />}</button></div>
  </article>
}
