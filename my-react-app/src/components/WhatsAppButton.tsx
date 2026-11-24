import { WHATSAPP_URL } from '../lib/format'
import { WhatsAppIcon } from './Icons'

/**
 * A round WhatsApp button pinned to the bottom-right corner: opens a chat with the store in
 * WhatsApp (the app on phones, WhatsApp Web on computers). Shown on every page of the shop and
 * in the admin and manager panels.
 */
export function WhatsAppButton() {
  if (!WHATSAPP_URL) return null
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      className="whatsapp-button"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
    >
      <WhatsAppIcon size={30} />
    </a>
  )
}
