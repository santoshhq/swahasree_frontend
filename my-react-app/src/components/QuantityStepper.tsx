import { MAX_QUANTITY } from '../state/cart'
import { MinusIcon, PlusIcon } from './Icons'

export function QuantityStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="One less">
        <MinusIcon size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= MAX_QUANTITY} aria-label="One more">
        <PlusIcon size={16} />
      </button>
    </div>
  )
}
