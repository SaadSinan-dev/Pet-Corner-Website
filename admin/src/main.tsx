import { Component, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/500.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import { ApiError } from './api'
import { AuthProvider, Protected } from './auth'
import { Empty, ErrorBox, Loading } from './components'
import Shell from './Shell'
import Login from './Login'
import './styles.css'
const Products = lazy(() => import('./ProductPages').then(m => ({ default: m.Products })))
const ProductEditor = lazy(() => import('./ProductPages').then(m => ({ default: m.ProductEditor })))
const Categories = lazy(() => import('./CategoryPages').then(m => ({ default: m.Categories })))
const CategoryEditor = lazy(() => import('./CategoryPages').then(m => ({ default: m.CategoryEditor })))
const Orders = lazy(() => import('./OrderPages').then(m => ({ default: m.Orders })))
const OrderDetail = lazy(() => import('./OrderPages').then(m => ({ default: m.OrderDetail })))
const SettingsPage = lazy(() => import('./SettingsPage'))
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 15000, refetchOnWindowFocus: false, retry: (count, error) => count < 1 && error instanceof ApiError && (error.status === 0 || error.status >= 500) }, mutations: { retry: false } } })
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> { state = { failed: false }; static getDerivedStateFromError() { return { failed: true } }; render() { return this.state.failed ? <div className="boundary"><ErrorBox error={new Error('تعذّر عرض لوحة الإدارة. أعد تحميل الصفحة للمحاولة مجددًا.')} retry={() => window.location.reload()} /></div> : this.props.children } }
export default function App() { return (<Boundary><QueryClientProvider client={client}><AuthProvider><BrowserRouter><Suspense fallback={<div className="route-loading"><Loading /></div>}><Routes><Route path="/login" element={<Login />} /><Route element={<Protected><Shell /></Protected>}><Route index element={<Navigate to="/orders" replace />} /><Route path="/products" element={<Products />} /><Route path="/products/new" element={<ProductEditor />} /><Route path="/products/:id" element={<ProductEditor />} /><Route path="/categories" element={<Categories />} /><Route path="/categories/new" element={<CategoryEditor />} /><Route path="/categories/:id" element={<CategoryEditor />} /><Route path="/orders" element={<Orders />} /><Route path="/orders/:id" element={<OrderDetail />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Empty headingLevel={1} title="الصفحة غير موجودة" text="قد يكون الرابط غير صحيح أو لم يعد متاحًا."><Link className="button" to="/orders">العودة إلى الطلبات</Link></Empty>} /></Route></Routes></Suspense></BrowserRouter></AuthProvider></QueryClientProvider></Boundary>) }
createRoot(document.getElementById('root')!).render(<App />)

