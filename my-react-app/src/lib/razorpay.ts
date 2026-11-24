import type { RazorpayResult } from './api'
import type { RazorpayCheckout } from './types'

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js'

type RazorpayInstance = { open: () => void }
declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance
  }
}

let loading: Promise<void> | null = null

// Loaded only when someone pays online, so the rest of the store doesn't download it.
function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      script.remove()
      reject(new Error("Couldn't load the payment window. Check your internet connection and try again."))
    }
    document.body.appendChild(script)
  })
  return loading
}

export class PaymentDismissed extends Error {
  constructor() {
    super('Payment was cancelled. Your order is saved; press Pay to try again.')
  }
}

/**
 * Open Razorpay's payment window. Resolves with the three values to verify on the backend once
 * the customer has paid; rejects with PaymentDismissed if they close the window without paying.
 * A failed attempt (card declined, etc.) stays inside the window so they can try another way.
 */
export async function payWithRazorpay(checkout: RazorpayCheckout, storeName: string): Promise<RazorpayResult> {
  await loadScript()
  const Razorpay = window.Razorpay
  if (!Razorpay) throw new Error("Couldn't load the payment window. Please try again.")
  return new Promise<RazorpayResult>((resolve, reject) => {
    const instance = new Razorpay({
      key: checkout.key,
      order_id: checkout.razorpay_order_id,
      amount: checkout.amount,
      currency: checkout.currency,
      name: storeName,
      description: `Order ${checkout.order_number}`,
      prefill: checkout.prefill,
      theme: { color: '#00503c' },
      handler: (response: RazorpayResult) => resolve(response),
      modal: { ondismiss: () => reject(new PaymentDismissed()), confirm_close: true },
    })
    instance.open()
  })
}
