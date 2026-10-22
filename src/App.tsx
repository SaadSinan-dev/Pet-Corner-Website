import { lazy, Suspense, Component } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CartProvider } from './lib/cart'
import { ApiError } from './lib/api'
import { Shell } from './components/Shell'
import { ErrorState } from './components/Common'
import Home from './pages/Home'
const Catalog = lazy(() => import('./pages/Catalog'))
const Product = lazy(() => import('./pages/Product'))
const Info = lazy(() => import('./pages/Info'))
const NotFound = lazy(() => import('./pages/Info').then(module => ({ default: module.NotFound })))
const Cart = lazy(() => import('./pages/Commerce').then(module => ({ default: module.CartPage })))
const Checkout = lazy(() => import('./pages/Commerce').then(module => ({ default: module.CheckoutPage })))
const Success = lazy(() => import('./pages/Commerce').then(module => ({ default: module.OrderSuccessPage })))
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30000, retry: (count, error) => count < 1 && (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) }, mutations: { retry: false } } })
class AppBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="container page-error"><ErrorState title="تعذّر عرض الصفحة" message="أعد تحميل الصفحة للمحاولة مجددًا. سلتك محفوظة في هذا المتصفح." retry={() => window.location.reload()} /></div> : this.props.children }
}
export default function App() {
  return <AppBoundary><QueryClientProvider client={queryClient}><CartProvider><BrowserRouter><Suspense fallback={<div className="container route-loading" role="status" aria-label="جارٍ تحميل الصفحة"><div className="skeleton skeleton-title" /><div className="skeleton detail-copy" /></div>}><Routes><Route element={<Shell />}><Route index element={<Home />} /><Route path="shop" element={<Catalog />} /><Route path="category/:slug" element={<Catalog />} /><Route path="product/:slug" element={<Product />} /><Route path="cart" element={<Cart />} /><Route path="checkout" element={<Checkout />} /><Route path="order-success/:orderCode" element={<Success />} />{['about', 'contact', 'faq', 'shipping', 'privacy', 'terms'].map(path => <Route key={path} path={path} element={<Info />} />)}<Route path="*" element={<NotFound />} /></Route></Routes></Suspense></BrowserRouter></CartProvider></QueryClientProvider></AppBoundary>
}
