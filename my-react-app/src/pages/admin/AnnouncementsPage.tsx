import { useState, type FormEvent } from 'react'
import { AnnouncementStrip } from '../../components/AnnouncementBar'
import { ErrorState, Loading } from '../../components/ui'
import {
  createAnnouncement, deleteAnnouncement, getAdminAnnouncements, setAnnouncementStatus, updateAnnouncement,
  type AnnouncementBar, type AnnouncementInput,
} from '../../lib/adminApi'
import type { AnnouncementLine, AnnouncementScroll } from '../../lib/api'
import { BRAND_RED } from '../../lib/brand'
import { plural } from '../../lib/format'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { AnnouncementIcon, DeleteIcon, EditIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Modal, Panel, Switch, Toast } from './AdminUi'

// Same limits and defaults as the backend (models/announcement_bar_model.py).
const MIN_HEIGHT = 20
const MAX_HEIGHT = 200
const MIN_SECONDS = 3
const MAX_SECONDS = 120
const SCROLL_STYLES: { id: AnnouncementScroll; name: string; description: string }[] = [
  { id: 'static', name: 'Standard', description: 'Stays still in the middle. Several lines take turns.' },
  { id: 'right_to_left', name: 'Right to left', description: 'Runs in from the right and out to the left.' },
  { id: 'left_to_right', name: 'Left to right', description: 'Runs in from the left and out to the right.' },
]
const scrollName = (id: AnnouncementScroll) => SCROLL_STYLES.find((s) => s.id === id)?.name ?? 'Standard'
const DEFAULT_INPUT: AnnouncementInput = {
  content: [{ text: '', coupon_code: null, link: null }],
  height_px: 40,
  background_color: BRAND_RED,
  text_color: '#ffffff',
  scroll_style: 'static',
  scroll_seconds: 15,
  status: true,
}
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const MAX_LINES = 5

type PopupState = { mode: 'create' } | { mode: 'edit'; announcement: AnnouncementBar } | null
type ToastState = { message: string; kind: 'success' | 'error' } | null

// "#fff" → "#ffffff": the colour picker only takes the six-digit form.
const sixDigit = (hex: string) =>
  /^#[0-9a-fA-F]{3}$/.test(hex) ? `#${hex.slice(1).split('').map((c) => c + c).join('')}` : hex

const firstLine = (a: Pick<AnnouncementBar, 'content'>) => a.content.find((l) => l.text.trim())?.text ?? 'Announcement'

/**
 * The thin bar above the store header. The admin can keep several, but only one is switched on
 * at a time: switching one on (or adding one switched on) switches the others off; the backend
 * does the same, so the storefront never shows two.
 */
export function AnnouncementsPage() {
  const loaded = useFetch((signal) => getAdminAnnouncements(signal), 'admin-announcements')
  if (loaded.loading && !loaded.data) return <Loading />
  if (loaded.error || !loaded.data) {
    return <ErrorState message={loaded.error?.message ?? 'Could not load the announcements'} onRetry={loaded.reload} />
  }
  return <AnnouncementManager initial={loaded.data} />
}

function AnnouncementManager({ initial }: { initial: AnnouncementBar[] }) {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('announcements')
  const [list, setList] = useState(initial)
  const [popup, setPopup] = useState<PopupState>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState>(null)
  const live = list.find((a) => a.status) ?? null

  // Puts a saved announcement in the list; if it's on, every other one is now off.
  const apply = (saved: AnnouncementBar, isNew = false) =>
    setList((current) => {
      const update = (a: AnnouncementBar) =>
        a.announcement_id === saved.announcement_id ? saved : saved.status && a.status ? { ...a, status: false } : a
      return isNew ? [saved, ...current.map(update)] : current.map(update)
    })

  const toggle = async (a: AnnouncementBar, status: boolean) => {
    setBusy(a.announcement_id)
    try {
      const res = await setAnnouncementStatus(a.announcement_id, status)
      const switchedOff = status && live && live.announcement_id !== a.announcement_id
      apply(res.announcement)
      setToast({
        message: status
          ? `“${firstLine(a)}” is now shown on the store.${switchedOff ? ' The one that was on has been switched off.' : ''}`
          : `“${firstLine(a)}” is hidden. The store shows no announcement bar.`,
        kind: 'success',
      })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setBusy(null)
    }
  }

  const remove = async (a: AnnouncementBar) => {
    try {
      await deleteAnnouncement(a.announcement_id)
      setList((current) => current.filter((x) => x.announcement_id !== a.announcement_id))
      setToast({ message: 'Announcement deleted.', kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const saved = (announcement: AnnouncementBar, isNew: boolean, message: string) => {
    apply(announcement, isNew)
    setPopup(null)
    setToast({ message, kind: 'success' })
  }

  return (
    <>
      <AdminPageHead
        title="Announcement bar"
        subtitle={list.length
          ? `${plural(list.length, 'announcement')}. ${live ? 'One is shown above the store header.' : 'None is switched on, so the store shows no bar.'} Only one can be on at a time.`
          : 'A thin strip above the store header for news, offers or delivery notices. Only one can be on at a time.'}
        actions={can.create ? <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add announcement</button> : undefined}
      />

      {live && (
        <Panel title="Showing on the store now">
          <AnnouncementStrip {...live} preview />
        </Panel>
      )}

      {list.length === 0 ? (
        <div className="panel empty-panel">
          <span className="empty-panel__icon"><AnnouncementIcon size={28} /></span>
          <h2>Add your first announcement</h2>
          <p>Like “Free delivery on orders above ₹999” or “Fresh harvest honey is here”. Choose its height and colours, and switch it on to show it above the header.</p>
          {can.create && <button className="admin-button" onClick={() => setPopup({ mode: 'create' })}>Add announcement</button>}
        </div>
      ) : (
        <div className="panel panel--flush">
          <div className="table-wrap">
            <table className="table table--cards">
              <thead>
                <tr>
                  <th>Announcement</th><th>Style</th><th>Shown</th>
                  <th className="table__actions"><span className="visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.announcement_id} className={a.status ? undefined : 'is-muted'}>
                    <td className="cell-main">
                      <span className="table__strong">{firstLine(a)}</span>
                      {a.content.length > 1 && <span className="table__sub">+ {plural(a.content.length - 1, 'more line')}, shown in turn</span>}
                    </td>
                    <td data-label="Style">
                      <span className="announce-style">
                        <span className="announce-swatch" style={{ background: a.background_color, color: a.text_color }} aria-hidden>Aa</span>
                        <span className="table__sub">{a.height_px} px · {a.scroll_style === 'static' ? 'Standard' : `${scrollName(a.scroll_style)}, ${a.scroll_seconds}s`}</span>
                      </span>
                    </td>
                    <td data-label="Shown">
                      <div className="switch-row">
                        <Switch
                          checked={a.status}
                          onChange={(v) => toggle(a, v)}
                          label={`Show “${firstLine(a)}” on the store`}
                          disabled={!can.edit || busy !== null}
                        />
                        <span>{a.status ? 'On' : 'Off'}</span>
                      </div>
                    </td>
                    <td className="table__actions">
                      {can.edit && (
                        <button className="admin-icon-button" onClick={() => setPopup({ mode: 'edit', announcement: a })} aria-label={`Edit “${firstLine(a)}”`} title="Edit">
                          <EditIcon />
                        </button>
                      )}
                      {can.delete && <ConfirmButton label={`Delete “${firstLine(a)}”`} icon={<DeleteIcon />} onConfirm={() => remove(a)} confirm={{
                        title: 'Delete this announcement?',
                        message: <p>{a.status ? 'It is on now, so the store will show no announcement bar. ' : ''}This can't be undone. To pause it instead, switch it off.</p>,
                        confirmLabel: 'Delete announcement',
                      }} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {popup && (
        <AnnouncementPopup
          key={popup.mode === 'edit' ? popup.announcement.announcement_id : 'new'}
          announcement={popup.mode === 'edit' ? popup.announcement : null}
          otherIsLive={!!live && (popup.mode === 'create' || live.announcement_id !== popup.announcement.announcement_id)}
          onClose={() => setPopup(null)}
          onSaved={saved}
          onError={(message) => setToast({ message, kind: 'error' })}
        />
      )}
      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

function AnnouncementPopup({ announcement, otherIsLive, onClose, onSaved, onError }: {
  announcement: AnnouncementBar | null
  // Another announcement is on: saving this one switched on will switch that one off.
  otherIsLive: boolean
  onClose: () => void
  onSaved: (announcement: AnnouncementBar, isNew: boolean, message: string) => void
  onError: (message: string) => void
}) {
  const [form, setForm] = useState<AnnouncementInput>(() => announcement
    ? {
        content: announcement.content.length ? announcement.content : [{ text: '', coupon_code: null, link: null }],
        height_px: announcement.height_px,
        background_color: sixDigit(announcement.background_color),
        text_color: sixDigit(announcement.text_color),
        scroll_style: announcement.scroll_style ?? 'static',
        scroll_seconds: announcement.scroll_seconds ?? 15,
        status: announcement.status,
      }
    : DEFAULT_INPUT)
  // The height as typed, so the box can be cleared while typing a new number.
  const [heightText, setHeightText] = useState(String(form.height_px))
  const [secondsText, setSecondsText] = useState(String(form.scroll_seconds))
  const [problem, setProblem] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const change = (changes: Partial<AnnouncementInput>) => {
    setForm((f) => ({ ...f, ...changes }))
    setProblem(null)
  }
  // Each line keeps its own text, coupon code and link; editing one field leaves the others alone.
  const setLine = (i: number, changes: Partial<AnnouncementLine>) =>
    change({ content: form.content.map((l, j) => (j === i ? { ...l, ...changes } : l)) })
  const setHeight = (value: number) => {
    change({ height_px: value })
    setHeightText(String(value))
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    // Blank text lines are dropped; a coupon code is uppercased like the backend stores it, and
    // blank coupon/link boxes become null (no coupon, no link) rather than empty strings.
    const content = form.content
      .map((line) => ({
        text: line.text.trim(),
        coupon_code: line.coupon_code?.trim().toUpperCase() || null,
        link: line.link?.trim() || null,
      }))
      .filter((line) => line.text)
    const height = Number(heightText)
    if (!content.length) return setProblem('Write the announcement text')
    if (!Number.isInteger(height) || height < MIN_HEIGHT || height > MAX_HEIGHT) {
      return setProblem(`Height must be a whole number from ${MIN_HEIGHT} to ${MAX_HEIGHT} px`)
    }
    const seconds = Number(secondsText)
    if (form.scroll_style !== 'static' && (!Number.isInteger(seconds) || seconds < MIN_SECONDS || seconds > MAX_SECONDS)) {
      return setProblem(`Speed must be a whole number from ${MIN_SECONDS} to ${MAX_SECONDS} seconds`)
    }
    if (!HEX.test(form.background_color) || !HEX.test(form.text_color)) return setProblem(`Use hex colours such as ${BRAND_RED}.`)
    // A standard bar keeps its last speed, in case it's set to scroll again later.
    const input: AnnouncementInput = { ...form, content, height_px: height, scroll_seconds: form.scroll_style === 'static' ? form.scroll_seconds : seconds }
    setSaving(true)
    try {
      const res = announcement
        ? await updateAnnouncement(announcement.announcement_id, input)
        : await createAnnouncement(input)
      const note = input.status && otherIsLive ? ' The one that was on has been switched off.' : ''
      onSaved(res.announcement, !announcement, `Announcement ${announcement ? 'saved' : 'added'}.${note}`)
    } catch (err) {
      setSaving(false)
      onError((err as Error).message)
    }
  }

  const previewHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Number(heightText) || MIN_HEIGHT))
  const previewSeconds = Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Number(secondsText) || MIN_SECONDS))
  const hasText = form.content.some((l) => l.text.trim())

  return (
    <Modal
      open
      wide
      title={announcement ? 'Edit announcement' : 'New announcement'}
      subtitle="Shown above the store header on every page."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose}>Cancel</button>
          <button type="submit" form="announcement-form" className="admin-button" disabled={saving}>
            {saving ? 'Saving…' : announcement ? 'Save changes' : 'Add announcement'}
          </button>
        </>
      }
    >
      <form id="announcement-form" className="announce-form" onSubmit={submit} noValidate>
        <div className="announce-form__preview">
          <span className="admin-label">Preview</span>
          {hasText
            ? <AnnouncementStrip content={form.content} height_px={previewHeight} background_color={form.background_color} text_color={form.text_color}
                scroll_style={form.scroll_style} scroll_seconds={previewSeconds} preview />
            : <p className="admin-hint admin-hint--tight">Write the text below to see the bar.</p>}
        </div>

        <fieldset className="announce-form__lines">
          <legend className="admin-label">Text</legend>
          {form.content.map((line, i) => (
            <div key={i} className="announce-form__line">
              <div className="announce-form__line-fields">
                <input
                  className="admin-input"
                  maxLength={300}
                  autoFocus={i === 0}
                  value={line.text}
                  placeholder={i === 0 ? 'e.g. Free delivery on orders above ₹999' : 'Another line'}
                  aria-label={`Line ${i + 1} text`}
                  onChange={(e) => setLine(i, { text: e.target.value })}
                />
                <div className="announce-form__line-extra">
                  <input
                    className="admin-input"
                    maxLength={40}
                    value={line.coupon_code ?? ''}
                    placeholder="Coupon code (optional)"
                    aria-label={`Line ${i + 1} coupon code`}
                    autoCapitalize="characters"
                    spellCheck={false}
                    onChange={(e) => setLine(i, { coupon_code: e.target.value.replace(/\s+/g, '').toUpperCase() || null })}
                  />
                  <input
                    className="admin-input"
                    maxLength={300}
                    value={line.link ?? ''}
                    placeholder="Link (optional), e.g. /shop"
                    aria-label={`Line ${i + 1} link`}
                    spellCheck={false}
                    onChange={(e) => setLine(i, { link: e.target.value || null })}
                  />
                </div>
              </div>
              {form.content.length > 1 && (
                <button type="button" className="admin-icon-button" aria-label={`Remove line ${i + 1}`} title="Remove line"
                  onClick={() => change({ content: form.content.filter((_, j) => j !== i) })}>
                  <DeleteIcon />
                </button>
              )}
            </div>
          ))}
          {form.content.length < MAX_LINES && (
            <button type="button" className="admin-button admin-button--ghost announce-form__add"
              onClick={() => change({ content: [...form.content, { text: '', coupon_code: null, link: null }] })}>
              Add another line
            </button>
          )}
        </fieldset>

        <div className="admin-field">
          <label htmlFor="an-height" className="admin-label">Height (px)</label>
          <div className="announce-form__height">
            <input type="range" min={MIN_HEIGHT} max={MAX_HEIGHT} step={1} value={previewHeight}
              aria-label="Height in pixels" onChange={(e) => setHeight(Number(e.target.value))} />
            <input id="an-height" className="admin-input" inputMode="numeric" maxLength={3} value={heightText}
              onChange={(e) => {
                const text = e.target.value.replace(/\D/g, '')
                setHeightText(text)
                setProblem(null)
                if (text) setForm((f) => ({ ...f, height_px: Number(text) }))
              }} />
          </div>
          <p className="admin-hint admin-hint--tight">From {MIN_HEIGHT} to {MAX_HEIGHT} px. 36–48 px suits most stores.</p>
        </div>

        <fieldset className="announce-form__motion">
          <legend className="admin-label">Text movement</legend>
          <div className="choice-stack" role="radiogroup" aria-label="Text movement">
            {SCROLL_STYLES.map((m) => (
              <label key={m.id} className={`choice${form.scroll_style === m.id ? ' is-on' : ''}`}>
                <input type="radio" name="announce-scroll" value={m.id} checked={form.scroll_style === m.id} onChange={() => change({ scroll_style: m.id })} />
                <strong>{m.name}</strong>
                <span>{m.description}</span>
              </label>
            ))}
          </div>
          {form.scroll_style !== 'static' && (
            <div className="admin-field">
              <label htmlFor="an-seconds" className="admin-label">Speed (seconds for one pass)</label>
              <div className="announce-form__height">
                <input type="range" min={MIN_SECONDS} max={60} step={1} value={Math.min(60, previewSeconds)} aria-label="Seconds for one pass"
                  onChange={(e) => { change({ scroll_seconds: Number(e.target.value) }); setSecondsText(e.target.value) }} />
                <input id="an-seconds" className="admin-input" inputMode="numeric" maxLength={3} value={secondsText}
                  onChange={(e) => {
                    const text = e.target.value.replace(/\D/g, '')
                    setSecondsText(text)
                    setProblem(null)
                    if (text) setForm((f) => ({ ...f, scroll_seconds: Number(text) }))
                  }} />
              </div>
              <p className="admin-hint admin-hint--tight">Fewer seconds is faster. From {MIN_SECONDS} to {MAX_SECONDS}; 12–20 reads comfortably.</p>
            </div>
          )}
        </fieldset>

        <div className="field-pair">
          <ColourField id="an-bg" label="Background colour" value={form.background_color} onChange={(background_color) => change({ background_color })} />
          <ColourField id="an-fg" label="Text colour" value={form.text_color} onChange={(text_color) => change({ text_color })} />
        </div>

        <div className="switch-row">
          <Switch checked={form.status} onChange={(status) => change({ status })} label="Show on the store" />
          <span>
            {form.status
              ? otherIsLive ? 'On: shown on the store, and the one on now is switched off' : 'On: shown above the store header'
              : 'Off: saved, but not shown'}
          </span>
        </div>
        {problem && <p className="field__error" role="alert">{problem}</p>}
      </form>
    </Modal>
  )
}

// A colour picker next to its hex code, which can also be typed.
function ColourField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (hex: string) => void }) {
  const [text, setText] = useState(value)
  const valid = HEX.test(text)
  return (
    <div className="admin-field">
      <label htmlFor={id} className="admin-label">{label}</label>
      <div className="announce-colour">
        <input type="color" value={sixDigit(HEX.test(value) ? value : '#000000')} aria-label={`${label} picker`}
          onChange={(e) => { setText(e.target.value); onChange(e.target.value) }} />
        <input id={id} className="admin-input" maxLength={7} value={text} aria-invalid={!valid || undefined}
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value.replace(/#/g, '')}`
            setText(next)
            // Invalid codes stay in the box (flagged) and are caught on save.
            onChange(next)
          }} />
      </div>
    </div>
  )
}
