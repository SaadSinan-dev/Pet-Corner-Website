import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal, X } from 'lucide-react'
import { api } from '../lib/api'
import { useCategories, usePageMeta, useSettings } from '../lib/hooks'
import { Breadcrumb, EmptyState, ErrorState, ProductSkeletons } from '../components/Common'
import { ProductCard } from '../components/ProductCard'

const MAX_PRICE = 100000000
function normalizeFilters(input: URLSearchParams, categorySlug?: string) {
  const result = new URLSearchParams()
  for (const key of ['search', 'category']) {
    const value = input.get(key)?.trim()
    if (value && !(key === 'category' && categorySlug)) result.set(key, value.slice(0, key === 'search' ? 150 : 100))
  }
  for (const key of ['minPrice', 'maxPrice', 'page']) {
    const raw = input.get(key)
    const value = Number(raw)
    const valid = raw && /^\d+$/.test(raw) && Number.isSafeInteger(value)
      && (key === 'page' ? value >= 1 && (value - 1) * 12 <= 2147483647 : value >= 0 && value <= MAX_PRICE)
    if (valid) result.set(key, String(value))
  }
  if (result.has('minPrice') && result.has('maxPrice') && Number(result.get('minPrice')) > Number(result.get('maxPrice'))) {
    result.delete('minPrice'); result.delete('maxPrice')
  }
  for (const key of ['inStock', 'featured']) {
    const value = input.get(key)
    if (value === 'true' || value === 'false') result.set(key, value)
  }
  const sort = input.get('sort')
  if (sort && ['newest', 'price-asc', 'price-desc'].includes(sort)) result.set('sort', sort)
  return result
}

export default function Catalog() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [urlParams, setParams] = useSearchParams()
  const params = normalizeFilters(urlParams, slug)
  const sourceQuery = urlParams.toString()
  const normalizedQuery = params.toString()
  useEffect(() => {
    if (sourceQuery !== normalizedQuery) setParams(normalizedQuery, { replace: true })
  }, [sourceQuery, normalizedQuery, setParams])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const categories = useCategories()
  const { data: settings } = useSettings()
  const category = categories.data?.find(item => item.slug === slug)
  const queryParams = new URLSearchParams(params)
  if (slug) queryParams.set('category', slug)
  queryParams.set('limit', '12')
  const products = useQuery({ queryKey: ['products', queryParams.toString()], queryFn: ({ signal }) => api.products(queryParams, signal), placeholderData: keepPreviousData })
  const title = slug ? category?.name || 'منتجات الفئة' : 'اختيارات لكل يوم.'
  usePageMeta(title)
  function update(key: string, value: string) { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); if (key !== 'page') next.delete('page'); setParams(next) }
  function applyPrice(form: HTMLFormElement) {
    const data = new FormData(form)
    const min = String(data.get('minPrice') || '').trim()
    const max = String(data.get('maxPrice') || '').trim()
    if ([min, max].some(value => value && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > MAX_PRICE))) {
      setPriceError('أدخل سعرًا صحيحًا من صفر إلى ١٠٠٬٠٠٠٬٠٠٠.'); return
    }
    if (min && max && Number(min) > Number(max)) {
      setPriceError('يجب أن يكون السعر الأدنى أقل من السعر الأعلى أو مساويًا له.'); return
    }
    const next = new URLSearchParams(params)
    for (const [key, value] of [['minPrice', min], ['maxPrice', max]]) {
      if (value) next.set(key, String(Number(value))); else next.delete(key)
    }
    next.delete('page')
    setPriceError(null)
    setParams(next)
  }
  const activeFilters = ['category', 'minPrice', 'maxPrice', 'inStock', 'search'].filter(key => params.has(key)).length
  return <div className="container catalog-page"><Breadcrumb current={slug ? category?.name || 'الفئة' : 'كل المنتجات'} /><div className="catalog-intro"><span className="eyebrow">ركن احتياجاتهم اليومية</span><h1>{title}</h1><p>{slug ? 'كل ما يحتاجه رفيقك ضمن هذه الفئة، في مكان واحد.' : 'طعام يحبونه، ألعاب تشغل فضولهم، وعناية تليق بهم.'}</p></div>
    <div className="catalog-toolbar"><form className="catalog-search" key={params.get('search') || ''} onSubmit={event => { event.preventDefault(); update('search', String(new FormData(event.currentTarget).get('search') || '').trim()) }}><Search size={18} /><label className="sr-only" htmlFor="catalog-search">ابحث في المتجر</label><input name="search" id="catalog-search" defaultValue={params.get('search') || ''} placeholder="ابحث عن احتياجات رفيقك…" maxLength={100} /><button type="submit" className="search-submit">بحث</button></form><div className="catalog-toolbar-end"><button className="filter-toggle button secondary" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-controls="catalog-filters"><SlidersHorizontal size={17} />تصفية {activeFilters > 0 && `(${activeFilters})`}</button><label className="sort-control">ترتيب حسب<select value={params.get('sort') || 'newest'} onChange={event => update('sort', event.target.value)}><option value="newest">ترتيب المتجر</option><option value="price-asc">السعر: من الأقل</option><option value="price-desc">السعر: من الأعلى</option></select></label></div></div>
    <div className="catalog-layout"><aside id="catalog-filters" className={`catalog-filters ${filtersOpen ? 'is-open' : ''}`}><div className="filter-heading"><h2>تصفية المنتجات</h2><SlidersHorizontal size={17} /></div><fieldset><legend>الفئة</legend><label className="filter-radio"><input type="radio" name="category" checked={!slug && !params.get('category')} onChange={() => { if (slug) navigate('/shop'); else update('category', '') }} />كل المنتجات</label>{categories.data?.map(item => <label className="filter-radio" key={item.id}><input type="radio" name="category" checked={(slug || params.get('category')) === item.slug} onChange={() => { if (slug) navigate(`/category/${item.slug}`); else update('category', item.slug) }} />{item.name}<small>{item.productCount}</small></label>)}</fieldset><form key={`${params.get('minPrice')}-${params.get('maxPrice')}`} noValidate onSubmit={event => { event.preventDefault(); applyPrice(event.currentTarget) }}><fieldset><legend>نطاق السعر <small>({settings?.currencyLabel || 'ل.س'})</small></legend><div className="price-range"><label>من<input type="number" name="minPrice" min="0" max={MAX_PRICE} step="1" aria-invalid={!!priceError} aria-describedby={priceError ? 'price-filter-error' : undefined} defaultValue={params.get('minPrice') || ''} placeholder="0" /></label><span>—</span><label>إلى<input type="number" name="maxPrice" min="0" max={MAX_PRICE} step="1" aria-invalid={!!priceError} aria-describedby={priceError ? 'price-filter-error' : undefined} defaultValue={params.get('maxPrice') || ''} placeholder="الأعلى" /></label></div><button type="submit" className="button secondary apply-price">تطبيق السعر</button>{priceError && <p id="price-filter-error" role="alert" style={{ color: 'var(--danger)', fontSize: '0.8rem', marginBlockStart: 12 }}>{priceError}</p>}</fieldset></form><fieldset><legend>التوفر</legend><label className="filter-radio"><input type="checkbox" checked={params.get('inStock') === 'true'} onChange={event => update('inStock', event.target.checked ? 'true' : '')} />المتوفر فقط</label></fieldset>{activeFilters > 0 && <button className="clear-filters" onClick={() => { setPriceError(null); setParams({}) }}><X size={15} />مسح التصفية</button>}<div className="filter-help"><span>اختيار مناسب يبدأ بمعلومة.</span><Link to="/faq">الأسئلة الشائعة <ArrowLeft size={15} /></Link></div></aside>
    <section className="catalog-results" aria-label="نتائج المنتجات" aria-busy={products.isFetching}><div className="results-count">{products.data && <span>{new Intl.NumberFormat('ar').format(products.data.total)} منتج{params.get('search') ? ` لبحث «${params.get('search')}»` : ' بانتظار رفيقك'}</span>}{products.isFetching && !products.isPending && <span className="muted" role="status">جارٍ تحديث النتائج…</span>}</div>{products.isPending ? <ProductSkeletons count={6} /> : products.isError ? <ErrorState retry={() => { void products.refetch() }} /> : products.data.items.length === 0 ? <EmptyState title="لم نجد ما تبحث عنه" message="جرّب كلمة بحث أقصر أو وسّع نطاق السعر والفئة." /> : <><div className={`product-grid ${products.isPlaceholderData ? 'updating' : ''}`}>{products.data.items.map(product => <ProductCard product={product} key={product.id} />)}</div>{products.data.totalPages > 1 && <nav className="pagination" aria-label="صفحات النتائج"><button className="icon-button" disabled={products.data.page <= 1 || products.isPlaceholderData} onClick={() => update('page', String(products.data.page - 1))} aria-label="الصفحة السابقة"><ArrowRight size={18} /></button><span>صفحة {products.data.page} من {products.data.totalPages}</span><button className="icon-button" disabled={products.data.page >= products.data.totalPages || products.isPlaceholderData} onClick={() => update('page', String(products.data.page + 1))} aria-label="الصفحة التالية"><ArrowLeft size={18} /></button></nav>}</>}</section></div>
  </div>
}
