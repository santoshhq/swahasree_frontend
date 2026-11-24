import { useEffect, useId, useRef } from 'react'
import { useConfetti } from './Confetti'
import { CheckIcon, GiftIcon } from './Icons'
import { enabledFlavors, FLAVOR_LABELS, FLAVOR_LEVELS, flavorLevelOrDefault, flavorMinimumGrams } from '../lib/flavor'
import type { FlavorField, FlavorLevel, FlavorSelection, ProductCustomization } from '../lib/types'

export function FlavorLevelOptions({ field, value, onChange }: {
  field: FlavorField
  value?: FlavorLevel
  onChange: (level: FlavorLevel) => void
}) {
  const name = useId()
  const checked = flavorLevelOrDefault(value)

  return (
    <fieldset className="flavor-options">
      <legend>{FLAVOR_LABELS[field]} level</legend>
      <div className="flavor-options__choices">
        {FLAVOR_LEVELS.map((level) => (
          <label key={level}>
            <input type="radio" name={name} value={level} checked={level === checked} onChange={() => onChange(level)}
              onClick={value === undefined && level === checked ? () => onChange(level) : undefined} />
            {level}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

const weightLabel = (grams: number) => grams < 1000 ? `${grams} g` : `${grams / 1000} kg`

export function FlavorPanel({ name, grams, settings, selection, onChange, preview = false }: {
  name: string
  grams: number
  settings?: ProductCustomization
  selection?: FlavorSelection
  onChange: (field: FlavorField, level: FlavorLevel) => void
  preview?: boolean
}) {
  const titleId = useId()
  const min = flavorMinimumGrams(settings)
  const fields = enabledFlavors(settings)
  const remaining = min - grams
  const unlocked = Boolean(min && fields.length && remaining <= 0)
  const celebrated = useRef(unlocked && !preview)
  const panel = useRef<HTMLElement>(null)
  const { fire, confetti } = useConfetti()

  useEffect(() => {
    if (!unlocked || celebrated.current) return
    const frame = window.requestAnimationFrame(() => {
      celebrated.current = true
      fire(panel.current)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [unlocked, fire])

  if (!min || !fields.length) return null
  if (remaining > 0) {
    return (
      <section className="flavor-unlock" aria-labelledby={titleId}>
        <span className="flavor-unlock__icon"><GiftIcon size={22} /></span>
        <div className="flavor-unlock__body">
          <h2 id={titleId}>A little surprise awaits</h2>
          <p role="status">Add <strong>{weightLabel(remaining)} more</strong> of {name} to unlock it.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="flavor-panel" aria-labelledby={titleId} ref={panel}>
      {confetti}
      <div className="flavor-panel__head">
        <span className="flavor-panel__icon"><CheckIcon /></span>
        <div>
          <h2 id={titleId}>Customize {name}</h2>
          <p role="status">{preview ? 'Surprise unlocked! Choose your levels, then add these packs to your cart.'
            : 'Customization unlocked. Tap the levels you’d like to add to your order.'}</p>
        </div>
      </div>
      <div className="flavor-panel__fields">
        {fields.map((field) => (
          <FlavorLevelOptions key={field} field={field} value={selection?.[field]}
            onChange={(level) => onChange(field, level)} />
        ))}
      </div>
    </section>
  )
}
