import { useEffect } from 'react'
import { useSignIn } from '../state/signIn'
import { UserIcon } from './Icons'
import { BrandButton } from './ui'

/**
 * In place of a page that needs an account (orders, an order) while signed out: the sign-in popup
 * opens straight away, and if it's closed this says why the page is empty and opens it again.
 * Once signed in, the page itself shows instead, so the shopper stays where they meant to go.
 */
export function SignInPrompt({ title, text }: { title: string; text: string }) {
  const { openSignIn } = useSignIn()

  useEffect(() => {
    openSignIn()
    // Once, when the page opens signed out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="container page">
      <section className="signin-prompt" aria-labelledby="signin-prompt-title">
        <span className="signin-prompt__icon"><UserIcon size={26} /></span>
        <h1 id="signin-prompt-title">{title}</h1>
        <p>{text}</p>
        <BrandButton type="button" onClick={() => openSignIn()}>Sign in</BrandButton>
      </section>
    </div>
  )
}
