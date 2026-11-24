import { createContext, useContext } from 'react'

export type SignInOptions = {
  // A page to go to once signed in (e.g. back to a product with ?notify=). Without it the shopper
  // stays where they are, which then shows them signed in.
  from?: string
  // checkout: opened on the way to checkout, so the popup says the cart is waiting.
  purpose?: 'checkout'
}

export type SignInState = {
  // Opens the sign-in popup (SignInDialog) over the current page.
  openSignIn: (options?: SignInOptions) => void
}

export const SignInContext = createContext<SignInState | null>(null)

export function useSignIn(): SignInState {
  const signIn = useContext(SignInContext)
  if (!signIn) throw new Error('useSignIn must be used inside <SignInProvider>')
  return signIn
}
