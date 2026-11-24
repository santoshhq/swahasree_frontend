import { useEffect, useRef, useState } from 'react'
import { CheckIcon, PasteIcon } from './Icons'

const LABEL = 'Paste code'
const DONE_LABEL = 'Code pasted'
// How long "Code pasted" shows before the button goes back to "Paste code".
const RESET_MS = 2000

/**
 * Fills a one-time code box from the clipboard, for a code the person copied from our email.
 * The website never has the code itself (only the email does), so this pastes rather than copies.
 * Reading the clipboard needs HTTPS (or localhost) and, in some browsers, the person's OK; when it
 * isn't allowed or holds no code, a short message asks them to type it instead.
 */
export function PasteCodeButton({ length = 6, onPaste }: { length?: number; onPaste: (code: string) => void }) {
  const [state, setState] = useState<'idle' | 'reading' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const paste = async () => {
    window.clearTimeout(timer.current)
    setMessage(null)
    if (!window.isSecureContext || !navigator.clipboard?.readText) {
      setMessage("This browser can't paste here. Please type the code.")
      return
    }
    setState('reading')
    try {
      const text = await navigator.clipboard.readText()
      // The first run of exactly `length` digits, so "482913 is your code" pastes 482913.
      const code = text.match(/\d+/g)?.find((digits) => digits.length === length)
      if (!code) {
        setState('idle')
        setMessage(`No ${length}-digit code found. Copy the code from the email first.`)
        return
      }
      onPaste(code)
      setState('done')
      timer.current = window.setTimeout(() => setState('idle'), RESET_MS)
    } catch {
      // Permission refused, or the page wasn't in focus.
      setState('idle')
      setMessage("Couldn't paste. Please type the code.")
    }
  }

  return (
    <div className="paste-code">
      <button type="button" className={`paste-code__button${state === 'done' ? ' is-done' : ''}`} onClick={paste} disabled={state === 'reading'}>
        {state === 'done' ? <CheckIcon size={16} /> : <PasteIcon />}
        <span>{state === 'done' ? DONE_LABEL : LABEL}</span>
      </button>
      <span className="paste-code__message" role="status">{message}</span>
    </div>
  )
}
