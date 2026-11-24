import { useState, type ReactNode } from 'react'
import { SignInDialog } from '../components/SignInDialog'
import { SignInContext, type SignInOptions } from './signIn'

// One sign-in popup for the whole shop. Each opening mounts it afresh (key). Its Google button leaves
// for Google; the shopper comes back signed in through /login (LoginPage).
export function SignInProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<{ n: number; open: boolean } & SignInOptions>({ n: 0, open: false })

  const openSignIn = (options?: SignInOptions) =>
    setRequest((r) => (r.open ? r : { n: r.n + 1, open: true, from: options?.from, purpose: options?.purpose }))
  const close = () => setRequest((r) => ({ ...r, open: false }))

  return (
    <SignInContext.Provider value={{ openSignIn }}>
      {children}
      {request.n > 0 && (
        <SignInDialog
          key={request.n}
          open={request.open}
          purpose={request.purpose}
          from={request.from}
          onClose={close}
        />
      )}
    </SignInContext.Provider>
  )
}
