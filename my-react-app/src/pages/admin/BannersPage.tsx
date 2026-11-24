import { useState, type DragEvent } from 'react'
import { HeroCarousel } from '../../components/HeroBanner'
import { ErrorState, Loading } from '../../components/ui'
import {
  deleteBanner, getAdminBanners, reorderBanners, replaceBannerImage, setBannerAnimation, updateBanner, uploadBanners,
  type AdminBanner, type BannerChanges,
} from '../../lib/adminApi'
import { plural } from '../../lib/format'
import { HERO_ANIMATIONS, animationName, type HeroAnimation } from '../../lib/heroAnimations'
import { BANNER_ASPECT_LABEL, BANNER_HEIGHT, BANNER_WIDTH, type HeroSlide } from '../../lib/heroSlides'
import { useCan } from '../../lib/adminAccess'
import { useFetch } from '../../lib/useFetch'
import { ArrowDownIcon, ArrowUpIcon, DeleteIcon, ImageIcon, SpinnerIcon, UploadIcon } from './AdminIcons'
import { AdminPageHead, ConfirmButton, Modal, Panel, Switch, Toast } from './AdminUi'

// Same limits as the backend (models/banner_section_model.py and services/image_service.py),
// checked here first so a mistake shows at once instead of after an upload. The admin can keep
// up to MAX_BANNERS; the home page shows the first MAX_SHOWN switched-on ones.
const MAX_BANNERS = 10
const MAX_SHOWN = 5
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Match the backend's minimum dimensions and 1% aspect-ratio tolerance.
const BANNER_RATIO = BANNER_WIDTH / BANNER_HEIGHT
const BANNER_RATIO_TOLERANCE = 0.01

/** Why this file can't be a banner, or null if it can. */
async function bannerProblem(file: File): Promise<string | null> {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: use a JPEG, PNG or WebP image`
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: larger than 5 MB`
  let width: number, height: number
  try {
    const bitmap = await createImageBitmap(file)
    ;({ width, height } = bitmap)
    bitmap.close()
  } catch {
    return `${file.name}: this image can't be opened`
  }
  if (Math.abs(width / height - BANNER_RATIO) > BANNER_RATIO * BANNER_RATIO_TOLERANCE || width < BANNER_WIDTH || height < BANNER_HEIGHT) {
    return `${file.name} is ${width} × ${height} px. Use ${BANNER_WIDTH} × ${BANNER_HEIGHT} px (${BANNER_ASPECT_LABEL}) or larger at the same ratio.`
  }
  return null
}

type ToastState = { message: string; kind: 'success' | 'error' } | null

export function BannersPage() {
  const loaded = useFetch((signal) => getAdminBanners(signal), 'admin-banners')
  if (loaded.loading && !loaded.data) return <Loading />
  if (loaded.error || !loaded.data) {
    return <ErrorState message={loaded.error?.message ?? 'Could not load the banners'} onRetry={loaded.reload} />
  }
  return <BannerManager initial={loaded.data.banners} initialAnimation={loaded.data.animation} />
}

function BannerManager({ initial, initialAnimation }: { initial: AdminBanner[]; initialAnimation: HeroAnimation }) {
  // What this person may do here (managers: the owner's tick boxes). The backend checks it too.
  const can = useCan('banners')
  const [banners, setBanners] = useState(initial)
  const [animation, setAnimation] = useState(initialAnimation)
  const [picking, setPicking] = useState(false)
  const [uploading, setUploading] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [moving, setMoving] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const room = MAX_BANNERS - banners.length
  // Exactly what the home page shows: the first MAX_SHOWN switched-on banners, in this order.
  const showing = new Set(banners.filter((b) => b.status).slice(0, MAX_SHOWN).map((b) => b.banner_id))

  const addFiles = async (list: FileList | File[]) => {
    const problems: string[] = []
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      const problem = await bannerProblem(file)
      if (problem) problems.push(problem)
      else if (accepted.length >= room) problems.push(`${file.name}: the home page can show at most ${MAX_BANNERS} banners`)
      else accepted.push(file)
    }
    if (problems.length) setToast({ message: problems.join('. '), kind: 'error' })
    if (!accepted.length) return

    const form = new FormData()
    accepted.forEach((file) => form.append('images', file))
    setUploading(accepted.length)
    try {
      const res = await uploadBanners(form)
      setBanners(res.banners)
      if (!problems.length) setToast({ message: `${plural(accepted.length, 'banner')} added to the home page.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setUploading(0)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (!uploading && e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const move = async (index: number, step: -1 | 1) => {
    const previous = banners
    const next = [...banners]
    const [moved] = next.splice(index, 1)
    next.splice(index + step, 0, moved)
    // Moves at once; goes back if the server refuses (say, banners changed in another tab).
    setBanners(next)
    setMoving(true)
    try {
      setBanners((await reorderBanners(next.map((b) => b.banner_id))).banners)
    } catch (err) {
      setBanners(previous)
      setToast({ message: (err as Error).message, kind: 'error' })
    } finally {
      setMoving(false)
    }
  }

  const replace = async (bannerId: string, number: number, file: File) => {
    const problem = await bannerProblem(file)
    if (problem) return setToast({ message: problem, kind: 'error' })
    try {
      const { banner } = await replaceBannerImage(bannerId, file)
      setBanners((list) => list.map((b) => (b.banner_id === bannerId ? banner : b)))
      setToast({ message: `Banner ${number} has its new image.`, kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  // Errors go back to the row, which shows them.
  const save = async (bannerId: string, changes: BannerChanges) => {
    const { banner } = await updateBanner(bannerId, changes)
    setBanners((list) => list.map((b) => (b.banner_id === bannerId ? banner : b)))
    return banner
  }

  const saveAnimation = async (choice: HeroAnimation) => {
    try {
      const res = await setBannerAnimation(choice)
      setAnimation(res.animation)
      setPicking(false)
      setToast({
        message: showing.size >= 2
          ? `The home page now uses the ${animationName(res.animation)} animation.`
          : 'Animation saved. It will play when two or more banners are active.',
        kind: 'success',
      })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  const remove = async (bannerId: string) => {
    try {
      await deleteBanner(bannerId)
      setBanners((list) => list.filter((b) => b.banner_id !== bannerId))
      setToast({ message: 'Banner deleted.', kind: 'success' })
    } catch (err) {
      setToast({ message: (err as Error).message, kind: 'error' })
    }
  }

  return (
    <>
      <AdminPageHead
        title="Home page banners"
        subtitle={`The slides at the top of your store's home page. It shows the first ${MAX_SHOWN} switched-on banners, in this order; you can keep up to ${MAX_BANNERS} here.`}
      />

      {banners.length > 0 && showing.size === 0 && (
        <p className="admin-callout banner-callout">Every banner is switched off, so the hero is hidden.</p>
      )}

      <Panel title="Your banners" actions={<span className="muted">{banners.length} of {MAX_BANNERS}</span>}>
        {banners.length === 0 ? (
          <p className="panel__empty">Upload a banner to display the homepage hero.</p>
        ) : (
          <ol className="banner-list">
            {banners.map((banner, i) => (
              <BannerRow
                key={banner.banner_id}
                banner={banner}
                position={i}
                count={banners.length}
                showing={showing.has(banner.banner_id)}
                moving={moving}
                onMove={(step) => move(i, step)}
                onReplace={(file) => replace(banner.banner_id, i + 1, file)}
                onSave={(changes) => save(banner.banner_id, changes)}
                onDelete={() => remove(banner.banner_id)}
                onToast={setToast}
              />
            ))}
          </ol>
        )}
      </Panel>

      <Panel
        title="Slide animation"
        actions={can.edit ? <button type="button" className="admin-button admin-button--ghost" onClick={() => setPicking(true)}>Choose animation</button> : undefined}
      >
        <p className="banner-animation">
          <strong>{showing.size >= 2 ? animationName(animation) : 'Standard'}</strong>
          <span>{showing.size >= 2
            ? HERO_ANIMATIONS.find((a) => a.id === animation)?.description
            : 'Animation starts when two or more banners are active.'}</span>
        </p>
      </Panel>

      {picking && (
        <AnimationPicker
          banners={banners}
          showing={showing}
          current={animation}
          onSet={saveAnimation}
          onClose={() => setPicking(false)}
        />
      )}

      {can.create && room > 0 && (
        <Panel title="Add banners">
          <BannerSizeGuide />
          <label
            className={`dropzone banner-dropzone${dragging ? ' is-dragging' : ''}${uploading ? ' is-uploading' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            aria-busy={uploading > 0 || undefined}
          >
            {uploading ? <SpinnerIcon size={28} className="admin-spin banner-upload-spinner" /> : <UploadIcon />}
            <span>{uploading ? `Please wait, your ${plural(uploading, 'banner image')} ${uploading === 1 ? 'is' : 'are'} uploading…` : <>Drop banner images here or <u>browse</u></>}</span>
            <span className="muted">{uploading ? 'This may take a few moments.' : `${plural(room, 'more banner')} can be added`}</span>
            <input
              type="file"
              accept={IMAGE_TYPES.join(',')}
              multiple
              className="visually-hidden"
              disabled={uploading > 0}
              onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
            />
          </label>
        </Panel>
      )}

      <Toast message={toast?.message ?? null} kind={toast?.kind} onDone={() => setToast(null)} />
    </>
  )
}

function BannerRow({ banner, position, count, showing, moving, onMove, onReplace, onSave, onDelete, onToast }: {
  banner: AdminBanner
  position: number
  count: number
  // On the home page right now (switched on and among the first MAX_SHOWN switched-on banners).
  showing: boolean
  moving: boolean
  onMove: (step: -1 | 1) => void
  onReplace: (file: File) => Promise<void>
  onSave: (changes: BannerChanges) => Promise<AdminBanner>
  onDelete: () => Promise<void>
  onToast: (toast: ToastState) => void
}) {
  const can = useCan('banners')
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  // The image file is gone or unreachable: say so instead of showing an empty box.
  const [missing, setMissing] = useState<string | null>(null)
  const imageMissing = missing === banner.image_url
  const number = position + 1

  const run = async (changes: BannerChanges, success: string) => {
    setSaving(true)
    try {
      const saved = await onSave(changes)
      onToast({ message: success, kind: 'success' })
      return saved
    } catch (err) {
      onToast({ message: (err as Error).message, kind: 'error' })
      return null
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`banner-row${showing ? '' : ' is-off'}`}>
      <figure className="banner-row__preview" aria-busy={replacing || undefined}>
        {imageMissing ? (
          <div className="banner-row__missing" role="img" aria-label={`Banner ${number}: image missing`}>
            <strong>Image missing</strong>
            <span>Replace the image or delete this banner. Until then it's left out of the home page.</span>
          </div>
        ) : (
          <img src={banner.image_url} alt={banner.alt_text ?? `Banner ${number}`} loading="lazy" onError={() => setMissing(banner.image_url)} />
        )}
        {replacing && (
          <div className="banner-upload-overlay" role="status">
            <SpinnerIcon size={28} className="admin-spin" />
            <span>Please wait, your banner image is uploading…</span>
          </div>
        )}
        <figcaption className="banner-row__number" aria-label={`Slide ${number} of ${count}`}>{number}</figcaption>
      </figure>

      <div className="banner-row__body">
        <div className="banner-row__top">
          <div className="switch-row">
            <Switch
              checked={banner.status}
              onChange={(on) => run({ status: on }, on ? `Banner ${number} is on the home page.` : `Banner ${number} is hidden from the home page.`)}
              label={`Show banner ${number} on the home page`}
              disabled={saving || !can.edit}
            />
            <span className="banner-row__state">
              {!banner.status ? 'Hidden'
                : imageMissing ? 'Left out of the home page: image missing'
                : showing ? 'Shown on the home page'
                : `On, but not shown: the home page shows the first ${MAX_SHOWN}`}
            </span>
          </div>
          <div className="banner-row__tools">
            {can.edit && <>
            <label className={`admin-icon-button banner-row__replace${replacing ? ' is-busy' : ''}`} title="Replace image" aria-busy={replacing || undefined}>
              <ImageIcon size={18} />
              <span className="visually-hidden">Replace the image of banner {number}</span>
              <input
                type="file"
                accept={IMAGE_TYPES.join(',')}
                className="visually-hidden"
                disabled={replacing}
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  setReplacing(true)
                  await onReplace(file)
                  setReplacing(false)
                }}
              />
            </label>
            <button type="button" className="admin-icon-button" onClick={() => onMove(-1)} disabled={moving || position === 0}
              aria-label={`Move banner ${number} earlier`} title="Move earlier"><ArrowUpIcon /></button>
            <button type="button" className="admin-icon-button" onClick={() => onMove(1)} disabled={moving || position === count - 1}
              aria-label={`Move banner ${number} later`} title="Move later"><ArrowDownIcon /></button>
            </>}
            {can.delete && <ConfirmButton label={`Delete banner ${number}`} icon={<DeleteIcon />} onConfirm={onDelete} confirm={{
              title: `Delete banner ${number}?`,
              message: <p>It's taken off the home page and its image is deleted. This can't be undone.</p>,
              confirmLabel: 'Delete banner',
            }} />}
          </div>
        </div>

      </div>
    </li>
  )
}

// Live preview plus the five animations; one can be chosen, and Set animation saves it for every shopper.
function AnimationPicker({ banners, showing, current, onSet, onClose }: {
  banners: AdminBanner[]
  showing: Set<string>
  current: HeroAnimation
  onSet: (animation: HeroAnimation) => Promise<void>
  onClose: () => void
}) {
  const [choice, setChoice] = useState(current)
  const [saving, setSaving] = useState(false)

  const toSlide = (b: AdminBanner): HeroSlide => ({ key: b.banner_id, src: b.image_url, link: null, label: b.alt_text ?? '' })
  const onHome = banners.filter((b) => showing.has(b.banner_id)).map(toSlide)
  // An animation needs two uploads. Include hidden uploads in the preview if needed.
  const slides = onHome.length >= 2
    ? onHome
    : [...onHome, ...banners.filter((b) => !showing.has(b.banner_id)).map(toSlide)].slice(0, 2)

  const set = async () => {
    setSaving(true)
    await onSet(choice)
    setSaving(false)
  }

  return (
    <Modal
      open
      title="Choose a slide animation"
      subtitle="How the home page moves from one banner to the next. Shoppers see it once you set it."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="admin-button admin-button--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="admin-button" onClick={set} disabled={saving || choice === current}>
            {saving ? 'Setting…' : 'Set animation'}
          </button>
        </>
      }
    >
      {/* Stays at the top while the list of animations scrolls, so the preview is always in view. */}
      <div className="banner-preview-sticky">
        {!!slides.length && <HeroCarousel slides={slides} animation={choice} preview />}
        {onHome.length < 2 && (
          <p className="admin-hint banner-preview-note">
            {slides.length ? 'Switch on at least two uploaded banners to show the animation on the home page.' : 'Upload banners to preview the animation.'}
          </p>
        )}
      </div>
      <div className="choice-stack banner-animations" role="radiogroup" aria-label="Slide animation">
        {HERO_ANIMATIONS.map((a) => (
          <label key={a.id} className={`choice${choice === a.id ? ' is-on' : ''}`}>
            <input type="radio" name="hero-animation" value={a.id} checked={choice === a.id} onChange={() => setChoice(a.id)} />
            <strong>{a.name}{a.id === current ? ' (in use)' : ''}</strong>
            <span>{a.description}</span>
          </label>
        ))}
      </div>
    </Modal>
  )
}

// The banner size rules, shown above the upload area: what to export, and what gets refused.
function BannerSizeGuide() {
  return (
    <div className="banner-guide">
      <div className="banner-guide__shape" aria-hidden>
        <span>{BANNER_WIDTH} × {BANNER_HEIGHT}</span>
      </div>
      <dl className="banner-guide__specs">
        <div><dt>Width</dt><dd>{BANNER_WIDTH} px</dd></div>
        <div><dt>Height</dt><dd>{BANNER_HEIGHT} px</dd></div>
        <div><dt>Aspect ratio</dt><dd>{BANNER_ASPECT_LABEL}</dd></div>
        <div><dt>Resolution</dt><dd>{BANNER_WIDTH} × {BANNER_HEIGHT} pixels</dd></div>
        <div><dt>File</dt><dd>JPEG, PNG or WebP, up to 5 MB</dd></div>
      </dl>
      <p className="banner-guide__note">
        Larger images work at the same ratio, for example {BANNER_WIDTH * 2} × {BANNER_HEIGHT * 2} px.
      </p>
    </div>
  )
}
