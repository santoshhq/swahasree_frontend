import type { ManagerPermissions } from '../../lib/adminSession'
import { actionsText, canChange, SECTIONS } from './managerSections'

/**
 * A login ID the way it's printed on the welcome email: the MGR prefix, then the six characters
 * that make it this person's, spaced so it reads out loud easily ("MGR 7K2 QX9").
 */
export function LoginIdBadge({ id, size = 'md' }: { id: string; size?: 'md' | 'lg' }) {
  const rest = id.replace(/^MGR/, '')
  return (
    <span className={`login-badge login-badge--${size}`} aria-label={`Login ID ${id}`}>
      <span className="login-badge__prefix" aria-hidden>MGR</span>
      <span className="login-badge__code" aria-hidden>{rest.slice(0, 3)}<span className="login-badge__gap" />{rest.slice(3)}</span>
    </span>
  )
}

/**
 * Every admin section as a small icon: lit when the manager can open it, with a gold dot when they
 * can also change things there (create, edit or delete). One glance shows what someone can do.
 */
export function AccessStrip({ permissions }: { permissions: ManagerPermissions }) {
  return (
    <ul className="access-strip" aria-label="Sections they can use">
      {SECTIONS.map((s) => {
        const view = !!permissions[s.key]?.view
        const change = view && canChange(permissions, s.key)
        return (
          <li key={s.key} className={`access-strip__item${view ? ' is-on' : ''}${change ? ' can-change' : ''}`}
            title={`${s.label}: ${actionsText(permissions, s)}`}>
            <s.icon size={15} />
            <span className="visually-hidden">{s.label}: {actionsText(permissions, s)}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** The key to the strip, shown once above the list. */
export function AccessLegend() {
  return (
    <p className="access-legend" aria-hidden>
      <span className="access-legend__item"><span className="access-legend__swatch is-on" /> Can open</span>
      <span className="access-legend__item"><span className="access-legend__swatch is-on can-change" /> Can also change</span>
      <span className="access-legend__item"><span className="access-legend__swatch" /> No access</span>
    </p>
  )
}

/**
 * Whether a manager can sign in: one pill that is the whole control (track, knob and the word),
 * so it reads as a state at a glance and can be clicked anywhere. Green "Active" or grey "Paused".
 */
export function StatusToggle({ checked, onChange, label, busy = false }: {
  checked: boolean
  onChange: (on: boolean) => void
  // Who it's about, for screen readers, e.g. "Ravi Kumar can sign in".
  label: string
  busy?: boolean
}) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={busy}
      className={`status-toggle${checked ? ' is-on' : ''}`} onClick={() => onChange(!checked)}>
      <span className="status-toggle__track" aria-hidden><span className="status-toggle__knob" /></span>
      <span className="status-toggle__text">{busy ? 'Saving…' : checked ? 'Active' : 'Paused'}</span>
    </button>
  )
}
