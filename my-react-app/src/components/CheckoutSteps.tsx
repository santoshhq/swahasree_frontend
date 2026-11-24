import { CartIcon, CardIcon, CheckIcon, PinIcon, TruckIcon } from './Icons'

const STEPS = [
  { Icon: CartIcon, label: 'Your cart' },
  { Icon: PinIcon, label: 'Address' },
  { Icon: CardIcon, label: 'Payment' },
  { Icon: CheckIcon, label: 'Confirmation' },
  { Icon: TruckIcon, label: 'Delivery' },
]

export function CheckoutSteps({ current }: { current: number }) {
  return (
    <ol className="checkout-steps pantry-checkout-steps" aria-label={`Order step ${current} of ${STEPS.length}`}>
      {STEPS.map(({ Icon, label }, i) => {
        const state = i + 1 < current ? 'done' : i + 1 === current ? 'current' : 'next'
        return (
          <li key={label} className={`checkout-steps__step is-${state}`} aria-current={state === 'current' ? 'step' : undefined}>
            <span className="pantry-checkout-steps__icon" aria-hidden>{state === 'done' ? <CheckIcon size={20} /> : <Icon size={20} />}</span>
            <span className="checkout-steps__label">{label}{state === 'done' && <span className="visually-hidden"> (done)</span>}</span>
          </li>
        )
      })}
    </ol>
  )
}
