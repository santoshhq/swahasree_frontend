import { useState, type ReactNode } from 'react'
import { readStored, writeStored } from '../lib/storage'
import { AuthContext, type Session } from './auth'

// v2: Google sign-in sessions. Older email-code sessions have another shape and are dropped.
const KEY = 'swahasree_session_v2'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => readStored<Session | null>(KEY, null))
  const [expiredEmail, setExpiredEmail] = useState<string | null>(null)

  const signIn = (next: Session) => {
    writeStored(KEY, next)
    setSession(next)
    setExpiredEmail(null)
  }
  // Also used when the API says the token has expired (it lasts a day).
  const signOut = (reason?: 'expired') => {
    setExpiredEmail(reason === 'expired' ? session?.customer.email ?? null : null)
    writeStored(KEY, null)
    setSession(null)
  }

  return <AuthContext.Provider value={{ session, expiredEmail, signIn, signOut }}>{children}</AuthContext.Provider>
}
