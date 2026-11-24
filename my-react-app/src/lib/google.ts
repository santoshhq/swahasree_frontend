// "Continue with Google" as a full-page redirect (OpenID Connect, response_type=id_token): every click
// goes to Google's account page, and Google sends the shopper back to /login with an ID token in the
// URL fragment. The backend checks that token with Google before signing the customer in, the same
// token Google's own sign-in button would have handed over.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const PENDING_KEY = 'swahasree_google_signin'

// The OAuth client ID from Google Cloud Console, the same one the backend has as GOOGLE_CLIENT_ID.
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

// Must be listed under "Authorized redirect URIs" for this client in Google Cloud Console.
export const googleRedirectUri = () => `${window.location.origin}/login`

type Pending = { state: string; nonce: string; from: string }

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Leaves the store for Google's account chooser; `from` is where to land once signed in.
export function startGoogleSignIn(from: string) {
  if (!GOOGLE_CLIENT_ID) return
  const pending: Pending = { state: randomToken(), nonce: randomToken(), from }
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending))
  } catch {
    // Without storage the state can't be checked on the way back; readGoogleReturn reports that.
  }
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: googleRedirectUri(),
    response_type: 'id_token',
    scope: 'openid email profile',
    state: pending.state,
    nonce: pending.nonce,
    // Always show the account chooser, even with one Google account signed in.
    prompt: 'select_account',
  })
  window.location.assign(`${AUTH_URL}?${params}`)
}

export type GoogleReturn = { idToken: string; from: string } | { error: string; from: string }

// Google's answer in the URL fragment of /login, or null when the page wasn't opened by Google.
// Reading has no side effects (React may render twice); finishGoogleSignIn forgets the attempt.
export function readGoogleReturn(hash: string): GoogleReturn | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  if (!params.has('state')) return null

  let pending: Pending | null = null
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    pending = raw ? (JSON.parse(raw) as Pending) : null
  } catch {
    pending = null
  }
  const from = pending?.from ?? '/'

  if (!pending || params.get('state') !== pending.state) {
    return { error: "That sign-in link has expired. Please continue with Google again.", from }
  }
  const error = params.get('error')
  if (error) {
    return { error: error === 'access_denied' ? 'Google sign-in was cancelled.' : "Google couldn't sign you in. Please try again.", from }
  }
  const idToken = params.get('id_token')
  if (!idToken || tokenNonce(idToken) !== pending.nonce) {
    return { error: "Google couldn't sign you in. Please try again.", from }
  }
  return { idToken, from }
}

// The nonce inside the ID token, to make sure it was issued for the sign-in this browser started.
function tokenNonce(idToken: string): string | undefined {
  try {
    const payload = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return (JSON.parse(atob(payload)) as { nonce?: string }).nonce
  } catch {
    return undefined
  }
}

export function finishGoogleSignIn() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Nothing was stored.
  }
}
