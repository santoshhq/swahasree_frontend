import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { BRAND_LOGO as logo } from '../../lib/brand'
import { BackIcon, EyeIcon, EyeOffIcon } from '../../components/Icons'
import { BrandButton } from '../../components/ui'
import { ApiError, managerLogin } from '../../lib/api'
import { getAdminSession, saveAdminSession, type ManagerPermissions } from '../../lib/adminSession'
import { panel } from '../../lib/panelPath'
import '../../admin.css'

// Login IDs are MGR plus 6 capital letters and digits, e.g. MGR7K2QX9 (sent in the welcome email).
// The manager types the full ID; just the 6 characters after MGR are accepted too.
const ID_PREFIX = 'MGR'
const CODE_LENGTH = 6
const ID_LENGTH = ID_PREFIX.length + CODE_LENGTH

/** Capitals and digits only, no spaces, at most a full ID long ("mgr 7k2qx9" -> "MGR7K2QX9"). */
function toLoginId(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, ID_LENGTH)
}

/** The 6 characters after MGR, from a full ID or from those 6 typed on their own; null while incomplete. */
function codeOf(id: string): string | null {
  if (id.length === ID_LENGTH && id.startsWith(ID_PREFIX)) return id.slice(ID_PREFIX.length)
  // Six characters starting with MGR are most likely a full ID still being typed.
  if (id.length === CODE_LENGTH && !id.startsWith(ID_PREFIX)) return id
  return null
}

// Which part of the form a message is about, so it shows right under that field.
type LoginError = { field: 'code' | 'password' | 'form'; message: string }

/** The store manager's own sign-in page (linked from the shop's footer). The owner uses /admin-login. */
export function ManagerLoginPage() {
  const navigate = useNavigate()
  const [loginId, setLoginId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<LoginError | null>(null)

  if (getAdminSession()) return <Navigate to={panel('/admin')} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const code = codeOf(loginId)
    if (!code) return setError({ field: 'code', message: 'Enter your full login ID from your welcome email, e.g. MGR7K2QX9.' })
    if (!password) return setError({ field: 'password', message: 'Enter your password.' })
    setBusy(true)
    setError(null)
    try {
      const res = await managerLogin(`${ID_PREFIX}${code}`, password)
      if (!saveAdminSession(res.access_token, res.permissions as ManagerPermissions)) {
        throw new Error('The server sent an unreadable sign-in token. Please try again.')
      }
      navigate(panel('/admin'), { replace: true })
    } catch (err) {
      // The backend answers 401 for an unknown ID, a wrong password and a paused account, on purpose.
      setError({
        field: 'form',
        message: err instanceof ApiError && err.status === 401
          ? 'That login ID and password don’t match an active manager account. Check your welcome email, or ask the store owner.'
          : (err as Error).message,
      })
      setBusy(false)
    }
  }

  const codeError = error?.field === 'code' ? error.message : null
  const passwordError = error?.field === 'password' ? error.message : null
  const formError = error?.field === 'form' ? error.message : null

  return (
    <div className="admin-auth admin-auth--manager">
      <section className="admin-auth__card manager-auth" aria-labelledby="manager-login-title">
        <header className="manager-auth__head">
          <Link to="/" className="admin-auth__logo" aria-label="Back to the store">
            <img src={logo} alt="Swahasree" width={190} height={92} />
          </Link>
          <p className="manager-auth__eyebrow">Staff access</p>
          <h1 id="manager-login-title">Store Manager Login</h1>
          <p className="admin-auth__lead">Use the login ID and password from your welcome email.</p>
        </header>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="manager-login-id">Login ID</label>
            {/* The ID, with a counter that turns green once it's complete. */}
            <div className={`login-id-field${codeError ? ' is-error' : ''}`}>
              <input id="manager-login-id" autoComplete="username" autoCapitalize="characters" spellCheck={false}
                aria-describedby="login-id-hint" aria-invalid={codeError ? true : undefined}
                placeholder="MGR7K2QX9" maxLength={ID_LENGTH + 4} value={loginId} autoFocus
                onChange={(e) => { setLoginId(toLoginId(e.target.value)); setError(null) }} />
              <span className={`login-id-field__count${codeOf(loginId) ? ' is-full' : ''}`} aria-hidden>
                {loginId.length}/{ID_LENGTH}
              </span>
            </div>
            {/* The hint and its error share one line, so a message doesn't push the form down. */}
            {codeError
              ? <p id="login-id-hint" className="field__error" role="alert">{codeError}</p>
              : <p id="login-id-hint" className="field__hint">As in your welcome email. Small letters become capitals.</p>}
          </div>

          <div className="field">
            <label htmlFor="manager-password">Password</label>
            <div className={`password-field${passwordError ? ' is-error' : ''}`}>
              <input id="manager-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password}
                aria-describedby={passwordError ? 'manager-password-error' : undefined} aria-invalid={passwordError ? true : undefined}
                onChange={(e) => { setPassword(e.target.value); setError(null) }} />
              <button type="button" className="password-field__toggle" onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} aria-controls="manager-password">
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
            {passwordError && <p id="manager-password-error" className="field__error" role="alert">{passwordError}</p>}
          </div>

          {formError && <p className="manager-auth__alert" role="alert">{formError}</p>}
          <BrandButton type="submit" busy={busy} disabled={busy}>Sign in</BrandButton>
        </form>

        <p className="admin-auth__switch">Forgot your password? <span>The store owner can set a new one for you.</span></p>
      </section>
      <Link to="/" className="admin-auth__back"><BackIcon size={16} /> Back to store</Link>
    </div>
  )
}
