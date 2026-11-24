import { createContext, useContext } from 'react'
import type { Customer } from '../lib/types'

export type Session = { token: string; customer: Customer }

export type AuthState = {
  session: Session | null
  // Set when the sign-in ran out (rather than the customer signing out), so the login page can say
  // why and fill in the email.
  expiredEmail: string | null
  signIn: (session: Session) => void
  signOut: (reason?: 'expired') => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside <AuthProvider>')
  return auth
}
