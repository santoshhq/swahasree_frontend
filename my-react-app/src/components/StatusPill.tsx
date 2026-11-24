import { STATUS_LABELS } from '../lib/format'
import type { OrderStatus } from '../lib/types'

export function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status status--${status}`}>{STATUS_LABELS[status] ?? status}</span>
}
