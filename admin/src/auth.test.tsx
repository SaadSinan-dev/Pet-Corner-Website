import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, Protected, useAuth } from './auth'
import { setToken } from './api'
import Login from './Login'
function Private() { const { user, logout } = useAuth(); return <><h1>{user?.email}</h1><button onClick={logout}>خروج</button></> }
function mount() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><AuthProvider><MemoryRouter initialEntries={['/products']}><Routes><Route path="/login" element={<Login />} /><Route path="/products" element={<Protected><Private /></Protected>} /></Routes></MemoryRouter></AuthProvider></QueryClientProvider>) }
afterEach(() => { setToken(null); vi.unstubAllGlobals() })
it('protects deep links, verifies the session before access, and leaves no token in storage', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: 'secret-token' }))).mockResolvedValueOnce(new Response(JSON.stringify({ id: '1', email: 'admin@example.com', role: 'ADMIN' }))); vi.stubGlobal('fetch', fetcher); mount(); expect(screen.getByRole('heading', { name: 'تسجيل دخول الإدارة' })).toBeInTheDocument(); fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/), { target: { value: 'admin@example.com' } }); fireEvent.change(screen.getByLabelText(/كلمة المرور/), { target: { value: 'test-password' } }); fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' })); await screen.findByRole('heading', { name: 'admin@example.com' }); expect(fetcher.mock.calls[1][0]).toBe(`${(import.meta.env.VITE_ADMIN_API_BASE_URL || '/api/v1').replace(/\/$/, '')}/auth/me`); expect(fetcher.mock.calls[1][1].headers.Authorization).toBe('Bearer secret-token'); expect(Object.values(localStorage)).not.toContain('secret-token'); expect(Object.values(sessionStorage)).not.toContain('secret-token'); fireEvent.click(screen.getByRole('button', { name: 'خروج' })); await screen.findByRole('heading', { name: 'تسجيل دخول الإدارة' })
})
it('keeps the login screen visible when credentials fail', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: 'بيانات الدخول غير صحيحة' }), { status: 401 }))); mount(); fireEvent.change(screen.getByLabelText(/البريد الإلكتروني/), { target: { value: 'bad@example.com' } }); fireEvent.change(screen.getByLabelText(/كلمة المرور/), { target: { value: 'wrong' } }); fireEvent.click(screen.getByRole('button', { name: 'تسجيل الدخول' })); await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('بيانات الدخول غير صحيحة')); expect(screen.getByRole('heading', { name: 'تسجيل دخول الإدارة' })).toBeInTheDocument()
})
