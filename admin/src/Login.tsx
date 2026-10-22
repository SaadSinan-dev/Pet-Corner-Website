import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, PawPrint } from 'lucide-react'
import { useAuth } from './auth'
import { ErrorBox, Field, Submit } from './components'
import { ThemeButton } from './Shell'
export default function Login() {
  const { user, login, expired } = useAuth(); const location = useLocation(); const [error, setError] = useState<unknown>(null); const [pending, setPending] = useState(false)
  const from = (location.state as { from?: string } | null)?.from || '/orders'
  if (user) return <Navigate to={from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : '/orders'} replace />
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const data = new FormData(event.currentTarget); setPending(true); setError(null); try { await login(String(data.get('email')).trim(), String(data.get('password'))) } catch (e) { setError(e) } finally { setPending(false) } }
  return <div className="login-layout"><div className="login-story"><img src="/images/logo-original.png" className="login-logo" alt="Pet Corner" width="120" height="120" /><div><span className="eyebrow">PET CORNER</span><h1>كل ما يحتاجه متجرك.<br /><span>في مكان واحد.</span></h1><p>مساحة هادئة للعناية بمنتجاتك،<br />ومتابعة كل طلب حتى يصل إلى صاحبه.</p></div><div className="login-signature"><PawPrint size={24} strokeWidth={1.4} /><span>لأن العناية تبدأ بالتفاصيل.</span></div></div><div className="login-content"><div className="login-theme"><ThemeButton /></div><div className="login-form"><span className="login-lock"><LockKeyhole size={24} strokeWidth={1.5} /></span><span className="eyebrow">مرحبًا بعودتك</span><h2>تسجيل دخول الإدارة</h2><p>استخدم حسابك الإداري للوصول إلى متجرك.</p>{expired && <div className="notice">انتهت جلسة الإدارة. سجّل الدخول مجددًا للمتابعة.</div>}{!!error && <ErrorBox error={error} />}<form onSubmit={submit}><Field label="البريد الإلكتروني" name="email" type="email" autoComplete="username" dir="ltr" maxLength={254} required placeholder="name@example.com" /><Field label="كلمة المرور" name="password" type="password" autoComplete="current-password" dir="ltr" maxLength={256} required /><Submit pending={pending}>تسجيل الدخول<ArrowLeft size={18} /></Submit></form><p className="login-note">الدخول متاح للحسابات الإدارية المصرّح لها فقط.</p></div><small className="login-copyright">Pet Corner · إدارة المتجر</small></div></div>
}

