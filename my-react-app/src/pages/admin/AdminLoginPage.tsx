import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { BRAND_LOGO as logo, BRAND_LOGO_SIZE } from '../../lib/brand'
import { BrandButton } from '../../components/ui'
import { ApiError, adminLogin } from '../../lib/api'
import { getAdminSession, saveAdminSession } from '../../lib/adminSession'
import { panel } from '../../lib/panelPath'
import '../../admin.css'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (getAdminSession()) return <Navigate to={panel('/admin')} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || !password) {
      setError('Enter your admin email and password')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const { access_token } = await adminLogin(email.trim(), password)
      if (!saveAdminSession(access_token)) throw new Error('The server sent an unreadable sign-in token. Please try again.')
      navigate(panel('/admin'), { replace: true })
    } catch (err) {
      // The backend answers 401 for both an unknown email and a wrong password, on purpose.
      setError(err instanceof ApiError && err.status === 401 ? 'That email and password don’t match an admin account.' : (err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="admin-auth">
      <section className="admin-auth__card" aria-labelledby="admin-login-title">
        <Link to="/" className="admin-auth__logo" aria-label="Back to the store">
          <img src={logo} alt="Swahasree" {...BRAND_LOGO_SIZE} />
        </Link>
        <h1 id="admin-login-title">Store admin</h1>
        <p className="admin-auth__lead">Sign in to manage products, orders and coupons.</p>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" autoComplete="username" inputMode="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setError(null) }} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="admin-password">Password</label>
            <div className="password-field">
              <input id="admin-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                onChange={(e) => { setPassword(e.target.value); setError(null) }} />
              <button type="button" className="text-button" onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
          </div>
          {error && <p className="field__error" role="alert">{error}</p>}
          <BrandButton type="submit" busy={busy} disabled={busy}>Sign in</BrandButton>
        </form>
      </section>
      <Link to="/" className="admin-auth__back">Back to the store</Link>
    </div>
  )
}
