import { useState } from 'react'
import { payMyOrder, payMyOrderOnDelivery, verifyPayment } from '../lib/api'
import { money, partialPayment } from '../lib/format'
import { payWithRazorpay } from '../lib/razorpay'
import type { Order } from '../lib/types'
import { ArrowIcon } from './Icons'

/**
 * Pays for this unpaid order itself: online through Razorpay, or in cash on delivery when the store
 * takes it (or the admin allowed it for this order). The order stays pending until one of them goes
 * through; it is never cancelled on its own.
 */
export function PayPendingOrder({ order, token, onPlaced }: { order: Order; token: string; onPlaced: (order: Order) => void }) {
  const [busy, setBusy] = useState<'online' | 'cod' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const split = partialPayment(order)

  const payOnline = async () => {
    setBusy('online')
    setError(null)
    try {
      const { order: ready, payment } = await payMyOrder(token, order.order_id)
      // No payment details: it was paid meanwhile (say, in another tab).
      if (!payment) {
        onPlaced(ready)
        return
      }
      const result = await payWithRazorpay(payment, 'Swahasree')
      onPlaced((await verifyPayment(order.order_id, result)).order)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const payOnDelivery = async () => {
    setBusy('cod')
    setError(null)
    try {
      onPlaced((await payMyOrderOnDelivery(token, order.order_id)).order)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="pay-pending">
      <div className="pay-pending__actions">
        <button type="button" className="account-button order-due__button" onClick={payOnline} disabled={busy !== null}>
          {busy === 'online' ? 'Waiting for payment…' : <>Pay {money(split?.online ?? order.pricing.total)} now <ArrowIcon size={16} /></>}
        </button>
        {order.cod_available && (
          <button type="button" className="text-button" onClick={payOnDelivery} disabled={busy !== null}>
            {busy === 'cod' ? 'Placing order…' : 'Pay on delivery instead'}
          </button>
        )}
      </div>
      {split && <p>{money(split.balance)} due on delivery after the online payment.</p>}
      {error && <p className="field__error" role="alert">{error}</p>}
    </div>
  )
}
