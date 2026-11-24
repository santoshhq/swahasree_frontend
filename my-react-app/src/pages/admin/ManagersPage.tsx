import { useState, type FormEvent } from 'react'
import { ErrorState, Loading } from '../../components/ui'
import { createManager, deleteManager, getManagers, updateManager, type ManagerInput, type StoreManager } from '../../lib/adminApi'
import type { ManagerAction, ManagerPermissions, ManagerSection } from '../../lib/adminSession'
import { orderDate, plural } from '../../lib/format'
import { useFetch } from '../../lib/useFetch'
import { DeleteIcon, EditIcon, ManagersIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Modal, Toast } from './AdminUi'
import { AccessLegend, AccessStrip, LoginIdBadge, StatusToggle } from './ManagerParts'
import { ACTION_LABELS, ACTIONS, fullPermissions, SECTION_GROUPS, SECTIONS, sectionsWithAccess } from './managerSections'

type PopupState = { mode: 'create' } | { mode: 'edit'; manager: StoreManager } | null
type ToastState = { message: string; kind: 'success' | 'error' } | null

// "RK" for Ravi Kumar: the row's avatar.
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')

export function ManagersPage() {
  const managers = useFetch((signal) => getManagers(signal), 'admin-managers')
  const [popup, setPopup] = useState<PopupState>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const [overrides, setOverrides] = useState<Record<string, StoreManager | 'deleted'>>({})
  // The manager whose Active / Paused is being saved, so a double click can't send it twice.
  const [toggling, setToggling] = useState<string | null>(null)

  const rows = (managers.data ?? [])
    .map((m) => overrides[m.manager_id] ?? m)
    .filter((m): m is StoreManager => m !== 'deleted')
  const active = rows.filter((m) => m.status).length

  const toggle = async (m: StoreManager, status: boolean) => {
    setToggling(m.manager_id)
    try {
      const res = await updateManager(m.manager_id, { status })
      setOverrides((o) => ({ ...o, [m.manager_id]: res.manager }))
      setToast({ message: status ? `${m.full_name} is active and can sign in.` : `${m.full_name} is paused and can’t sign in.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setToggling(null)
    }
  }

  const remove = async (m: StoreManager) => {
    try {
      await deleteManager(m.manager_id)
      setOverrides((o) => ({ ...o, [m.manager_id]: 'deleted' }))
      setToast({ message: `${m.full_name} was removed.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const closePopup = (changed: boolean) => {
    setPopup(null)
    if (changed) {
      setOverrides({})
      managers.reload()
    }
  }

  return (
    <>
      <AdminPageHead
        title="Managers"
        subtitle={rows.length
          ? `${plural(rows.length, 'manager')}, ${active} active. Each one sees only the parts of the panel you allow.`
          : 'Staff who help run the store. Each one sees only the parts of the panel you allow.'}
        actions={<button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add manager</button>}
      />

      {managers.loading && !managers.data ? (
        <Loading />
      ) : managers.error ? (
        <ErrorState message={managers.error.message} onRetry={managers.reload} />
      ) : rows.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><ManagersIcon size={28} /></span>
          <h2>No managers yet</h2>
          <p>Add someone to help with orders or products. They get a login ID by email and sign in from Store Manager Login in the shop's footer.</p>
          <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add manager</button>
        </div>
      ) : (
        <>
          <AccessLegend />
          <ul className="manager-list panel">
            {rows.map((m) => {
              const sections = sectionsWithAccess(m.permissions).length
              return (
                <li key={m.manager_id} className={`manager-row${m.status ? '' : ' is-off'}`}>
                  <span className="manager-row__avatar" aria-hidden>{initials(m.full_name)}</span>
                  <div className="manager-row__who">
                    <button type="button" className="manager-row__name" onClick={() => setPopup({ mode: 'edit', manager: m })}>{m.full_name}</button>
                    <span className="manager-row__email">{m.email_id}</span>
                  </div>
                  <LoginIdBadge id={m.login_id} />
                  <div className="manager-row__access">
                    <AccessStrip permissions={m.permissions} />
                    <span className="manager-row__meta">
                      {sections ? `${plural(sections, 'section')} of ${SECTIONS.length}` : 'No sections yet'}
                      {', '}{m.last_login_at ? `last signed in ${orderDate(m.last_login_at)}` : 'never signed in'}
                    </span>
                  </div>
                  <StatusToggle checked={m.status} busy={toggling === m.manager_id} onChange={(v) => toggle(m, v)} label={`${m.full_name} can sign in`} />
                  <div className="manager-row__actions">
                    <button className="admin-icon-button" onClick={() => setPopup({ mode: 'edit', manager: m })} aria-label={`Edit ${m.full_name}`} title="Edit"><EditIcon /></button>
                    <ConfirmButton label={`Remove ${m.full_name}`} icon={<DeleteIcon />} onConfirm={() => remove(m)} confirm={{
                      title: `Remove ${m.full_name}?`,
                      message: <p>Login ID {m.login_id} stops working straight away. To stop them for a while instead, set them to Paused.</p>,
                      confirmLabel: 'Remove manager',
                    }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {popup && (
        <ManagerPopup
          key={popup.mode === 'edit' ? popup.manager.manager_id : 'new'}
          manager={popup.mode === 'edit' ? popup.manager : null}
          onClose={closePopup}
          onToast={setToast}
        />
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

type Step = 'details' | 'permissions'
const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'permissions', label: 'Permissions' },
]

/**
 * Adding a manager is two steps: who they are (Details), then Next, then what they can do
 * (Permissions), where the save happens. Editing uses the same two steps, but either can be opened
 * from the step bar and saved from.
 */
function ManagerPopup({ manager, onClose, onToast }: {
  manager: StoreManager | null
  // changed: the list needs loading again.
  onClose: (changed: boolean) => void
  onToast: (toast: ToastState) => void
}) {
  const editing = !!manager
  const [step, setStep] = useState<Step>('details')
  const [fullName, setFullName] = useState(manager?.full_name ?? '')
  const [email, setEmail] = useState(manager?.email_id ?? '')
  const [mobile, setMobile] = useState(manager?.mobile_number ?? '')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState(manager?.status ?? true)
  const [permissions, setPermissions] = useState<ManagerPermissions>(() =>
    fullPermissions(manager?.permissions ?? { dashboard: { view: true } }),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // After adding: the new login ID, shown big so the owner can pass it on.
  const [created, setCreated] = useState<{ manager: StoreManager; emailSent: boolean } | null>(null)

  /** What's wrong with the details, if anything; checked before Next and before saving. */
  const detailsProblem = (): string | null => {
    if (!fullName.trim()) return 'Enter their name.'
    if (!/^[6-9]\d{9}$/.test(mobile)) return 'Enter a 10-digit mobile number.'
    if (!editing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Enter their email. The login ID is sent there.'
    if (!editing && password.length < 8) return 'Set a password of at least 8 characters.'
    if (editing && password && password.length < 8) return 'A new password needs at least 8 characters. Leave it empty to keep theirs.'
    return null
  }

  const goTo = (next: Step) => {
    if (next === 'permissions') {
      const problem = detailsProblem()
      if (problem) return setError(problem)
    }
    setError(null)
    setStep(next)
  }

  // Ticking create, edit or delete ticks view (you can't work on what you can't see);
  // unticking view clears the rest of that row.
  const tick = (section: ManagerSection, action: ManagerAction, on: boolean) => {
    setPermissions((p) => {
      const row = { ...p[section], [action]: on }
      if (on && action !== 'view') row.view = true
      if (!on && action === 'view') for (const a of ACTIONS) if (a in row) row[a] = false
      return { ...p, [section]: row }
    })
  }
  const viewEverything = () => setPermissions((p) => fullPermissions(Object.fromEntries(SECTIONS.map((s) => [s.key, { ...p[s.key], view: true }]))))
  const clearAll = () => setPermissions(fullPermissions({}))
  const ticked = sectionsWithAccess(permissions).length

  const save = async () => {
    const problem = detailsProblem()
    if (problem) {
      setStep('details')
      return setError(problem)
    }
    setError(null)
    setSaving(true)
    try {
      if (editing) {
        await updateManager(manager.manager_id, {
          full_name: fullName.trim(), mobile_number: mobile, permissions, status, ...(password ? { password } : {}),
        })
        onToast({ message: `${fullName.trim()} was saved.${password ? ' Let them know their new password.' : ''}`, kind: 'success' })
        onClose(true)
      } else {
        const input: ManagerInput = { full_name: fullName.trim(), email_id: email.trim(), mobile_number: mobile, password, permissions, status }
        const res = await createManager(input)
        setCreated({ manager: res.manager, emailSent: res.email_sent })
      }
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
    }
  }

  // Enter in a details field means Next (or Save when editing the last step).
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (step === 'details') goTo('permissions')
    else void save()
  }

  if (created) return <CreatedPass manager={created.manager} emailSent={created.emailSent} onDone={() => onClose(true)} />

  const onPermissions = step === 'permissions'
  const saveLabel = saving ? 'Saving…' : editing ? 'Save changes' : 'Add and email login ID'

  return (
    <Modal
      open
      wide
      title={editing ? `Edit ${manager.full_name}` : 'Add a manager'}
      subtitle={<Stepper step={step} onPick={editing ? goTo : undefined} />}
      onClose={() => onClose(false)}
      footer={
        <>
          {onPermissions ? (
            <button type="button" className="admin-button admin-button--ghost" onClick={() => goTo('details')} disabled={saving}>Back</button>
          ) : (
            <button type="button" className="admin-button admin-button--ghost" onClick={() => onClose(false)}>Cancel</button>
          )}
          <span className="manager-popup__spacer" />
          {/* Editing: save from either step. Adding: Next first, then save from Permissions. */}
          {editing && !onPermissions && (
            <button type="button" className="admin-button admin-button--ghost" onClick={() => void save()} disabled={saving}>{saveLabel}</button>
          )}
          {onPermissions ? (
            <button type="button" className="admin-button" onClick={() => void save()} disabled={saving}>{saveLabel}</button>
          ) : (
            <button type="button" className="admin-button" onClick={() => goTo('permissions')}>Next: permissions</button>
          )}
        </>
      }
    >
      <form id="manager-form" onSubmit={submit} noValidate className="manager-form">
        {!onPermissions ? (
          <div className="manager-form__step" key="details">
            <div className="manager-form__details">
              <div className="admin-field">
                <label htmlFor="mg-name" className="admin-label">Name</label>
                <input id="mg-name" className="admin-input" maxLength={100} value={fullName} autoFocus onChange={(e) => { setFullName(e.target.value); setError(null) }} />
              </div>
              <div className="admin-field">
                <label htmlFor="mg-mobile" className="admin-label">Mobile</label>
                <input id="mg-mobile" className="admin-input" inputMode="numeric" maxLength={10} value={mobile}
                  onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '')); setError(null) }} />
              </div>
              <div className="admin-field">
                <label htmlFor="mg-email" className="admin-label">Email</label>
                <input id="mg-email" type="email" className="admin-input" value={email} disabled={editing}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }} />
                <p className="admin-hint">{editing ? 'The email can’t be changed. Remove the manager and add them again to use another.' : 'Their login ID is sent here.'}</p>
              </div>
              <div className="admin-field">
                <label htmlFor="mg-password" className="admin-label">{editing ? 'New password' : 'Password'}</label>
                <input id="mg-password" type="text" className="admin-input" autoComplete="new-password" value={password}
                  placeholder={editing ? 'Leave empty to keep theirs' : 'At least 8 characters'} onChange={(e) => { setPassword(e.target.value); setError(null) }} />
                <p className="admin-hint">{editing ? 'Only if they forgot theirs.' : 'Sent with the login ID. They can change it from My profile.'}</p>
              </div>
            </div>
            <div className="manager-form__status">
              <div>
                <p className="admin-label">Sign-in</p>
                <p className="admin-hint">{status ? 'They can sign in as soon as they get the email.' : 'The account is kept, but they can’t sign in until you make it active.'}</p>
              </div>
              <StatusToggle checked={status} onChange={setStatus} label="This manager can sign in" />
            </div>
            {editing && <p className="manager-form__current">Login ID <LoginIdBadge id={manager.login_id} /></p>}
          </div>
        ) : (
          <div className="manager-form__step" key="permissions">
            {/* Fixed while the sections scroll: what this is, the shortcuts and the column names. */}
            <div className="perm-fixed">
              <div className="perm-fixed__head">
                <div>
                  <h3>What {fullName.trim().split(/\s+/)[0] || 'they'} can do</h3>
                  <p className="admin-hint">{ticked ? `${plural(ticked, 'section')} of ${SECTIONS.length} allowed. ` : 'Nothing allowed yet. '}Ticking Create, Edit or Delete ticks View too.</p>
                </div>
                <div className="perm-fixed__presets">
                  <button type="button" className="text-button" onClick={viewEverything}>View everything</button>
                  <button type="button" className="text-button" onClick={clearAll}>Clear all</button>
                </div>
              </div>
              <div className="perm-row perm-row--header" aria-hidden>
                <span>Section</span>
                {ACTIONS.map((a) => <span key={a} className="perm-row__cell">{ACTION_LABELS[a]}</span>)}
              </div>
            </div>

            <div className="perm-rows" role="group" aria-label="Permissions by section">
              {SECTION_GROUPS.map((g) => (
                <section key={g.heading} aria-label={g.heading}>
                  <p className="perm-group">{g.heading}</p>
                  {g.sections.map((s) => {
                    const on = !!permissions[s.key]?.view
                    return (
                      <div key={s.key} className={`perm-row${on ? ' is-on' : ''}`}>
                        <span className="perm-row__section">
                          <span className="perm-row__icon"><s.icon size={16} /></span>
                          <span>
                            {s.label}
                            {s.note && <small>{s.note}</small>}
                          </span>
                        </span>
                        {ACTIONS.map((a) => (
                          <span key={a} className="perm-row__cell">
                            {s.actions.includes(a) ? (
                              <input type="checkbox" checked={!!permissions[s.key]?.[a]} onChange={(e) => tick(s.key, a, e.target.checked)}
                                aria-label={`${ACTION_LABELS[a]} ${s.label}`} />
                            ) : (
                              <span className="perm-row__none" title={`${s.label} has no ${ACTION_LABELS[a].toLowerCase()}`} aria-hidden>—</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                </section>
              ))}
            </div>
          </div>
        )}
        {error && <p className="field__error manager-form__error" role="alert">{error}</p>}
      </form>
    </Modal>
  )
}

/** "1 Details — 2 Permissions" under the popup's title. When editing, either step can be opened from here. */
function Stepper({ step, onPick }: { step: Step; onPick?: (step: Step) => void }) {
  const at = STEPS.findIndex((s) => s.key === step)
  return (
    <ol className="manager-stepper" aria-label="Steps">
      {STEPS.map((s, i) => {
        const state = i === at ? 'is-current' : i < at ? 'is-done' : ''
        const inner = (
          <>
            <span className="manager-stepper__num" aria-hidden>{i < at ? '✓' : i + 1}</span>
            <span>{s.label}</span>
          </>
        )
        return (
          <li key={s.key} className={`manager-stepper__step ${state}`} aria-current={i === at ? 'step' : undefined}>
            {onPick ? <button type="button" onClick={() => onPick(s.key)}>{inner}</button> : <span className="manager-stepper__label">{inner}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** Shown once, right after adding: the new login ID, big, with a copy button. */
function CreatedPass({ manager, emailSent, onDone }: { manager: StoreManager; emailSent: boolean; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(manager.login_id)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <Modal
      open
      title={`${manager.full_name} is added`}
      onClose={onDone}
      footer={<button type="button" className="admin-button" onClick={onDone}>Done</button>}
    >
      <div className="created-pass">
        <span className="created-pass__avatar" aria-hidden>{initials(manager.full_name)}</span>
        <p className="created-pass__label">Their login ID</p>
        <LoginIdBadge id={manager.login_id} size="lg" />
        <button type="button" className="text-button" onClick={copy}>{copied ? 'Copied' : 'Copy login ID'}</button>
        <p className={`created-pass__note${emailSent ? '' : ' is-warn'}`} role="status">
          {emailSent
            ? `We emailed it to ${manager.email_id}, with the password you set. They sign in from Store Manager Login in the shop's footer.`
            : `The email to ${manager.email_id} couldn't be sent. Give them this login ID and the password you set yourself.`}
        </p>
      </div>
    </Modal>
  )
}
