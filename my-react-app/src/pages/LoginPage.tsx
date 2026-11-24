import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { Loading } from '../components/ui'
import { googleSignIn } from '../lib/api'
import { finishGoogleSignIn, readGoogleReturn } from '../lib/google'
import { useAuth } from '../state/auth'
import { useSignIn } from '../state/signIn'
import { usePageMeta } from '../lib/seo'

// Two jobs:
// - Google sends the shopper back here after "Continue with Google" (lib/google.ts), with the ID token
//   in the URL fragment: sign in with it, then go on to the page they started from.
// - Old links and bookmarks to /login: open the sign-in popup over the home page, and once signed in
//   go on to where the link asked (else the orders).
export function LoginPage() {
  usePageMeta({ title: 'Sign in', noindex: true })
  const { hash } = useLocation()
  // Read once, as the page opens: the sign-in below then forgets the attempt.
  const [google] = useState(() => readGoogleReturn(hash))
  return google ? <GoogleReturn result={google} /> : <LoginLink />
}

function GoogleReturn({ result }: { result: NonNullable<ReturnType<typeof readGoogleReturn>> }) {
  const { signIn } = useAuth()
  const { openSignIn } = useSignIn()
  const navigate = useNavigate()
  const [error, setError] = useState('error' in result ? result.error : null)
  // Once, even when React runs the effect twice in development.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    finishGoogleSignIn()
    if ('error' in result) {
      // Keep the message on screen but drop Google's answer from the address bar.
      window.history.replaceState(window.history.state, '', '/login')
      return
    }
    googleSignIn(result.idToken)
      .then((r) => {
        signIn({ token: r.access_token, customer: r.customer })
        navigate(result.from, { replace: true })
      })
      .catch((err: Error) => {
        window.history.replaceState(window.history.state, '', '/login')
        setError(err.message)
      })
  }, [result, signIn, navigate])

  if (!error) return <div className="container page"><Loading label="Signing you in…" /></div>
  return (
    <div className="container page">
      <div className="state state--error" role="alert">
        <p>{error}</p>
        <button type="button" className="text-button" onClick={() => openSignIn({ from: result.from })}>Try again</button>
        <Link to={result.from} className="text-button">Back to the shop</Link>
      </div>
    </div>
  )
}

function LoginLink() {
  const { session } = useAuth()
  const { openSignIn } = useSignIn()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/account'

  useEffect(() => {
    if (!session) openSignIn({ from })
    // Once, when the link is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <Navigate to={session ? from : '/'} replace />
}
