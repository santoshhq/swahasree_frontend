import { ArrowUpRight, Play } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronIcon } from '../Icons'
import { SectionHead } from '../ProductSection'
import { LocalReelPlayer } from './LocalReelPlayer'

const profileUrl = 'https://www.instagram.com/swahasree_foods/'
const reels = [
  { id: 'Df94pJ8u9Wj', asset: 'Video-65047' },
  { id: 'DeZWYq3IS1O', asset: 'Video-71250' },
  { id: 'DeHhc3Vu_pC', asset: 'Video-51258' },
  { id: 'DditVprOLOr', asset: 'Video-73669' },
]
const media = import.meta.glob<string>('../../assets/reels/*.{mp4,webp}', { eager: true, import: 'default', query: '?url' })

function ReelLinkLabel() {
  return (
    <span className="home-reel__action">
      <span className="home-instagram-icon" aria-hidden /> <span>Watch on Instagram</span> <ArrowUpRight size={16} aria-hidden />
    </span>
  )
}

function ReelCard({ reel, index, audible, releaseAudio, toggleAudio }: {
  reel: (typeof reels)[number]
  index: number
  audible: boolean
  releaseAudio: (id: string) => void
  toggleAudio: (id: string, video: HTMLVideoElement) => boolean
}) {
  const [failed, setFailed] = useState(false)
  const { id, asset } = reel
  const number = index + 1
  const url = `https://www.instagram.com/reel/${id}/`
  const source = media[`../../assets/reels/${id}.mp4`] ?? media[`../../assets/reels/${asset}.mp4`]
  const poster = media[`../../assets/reels/${id}.webp`] ?? media[`../../assets/reels/${asset}.webp`]
  const linkLabel = `Watch reel ${number} on Instagram (opens in a new tab)`

  if (source && !failed) {
    return (
      <div className="home-reel">
        <LocalReelPlayer id={id} source={source} poster={poster} number={number} audible={audible}
          releaseAudio={releaseAudio} toggleAudio={toggleAudio} onUnavailable={() => setFailed(true)} />
        <a className="home-reel__link" href={url} target="_blank" rel="noopener noreferrer" aria-label={linkLabel}><ReelLinkLabel /></a>
      </div>
    )
  }

  return (
    <a className="home-reel" href={url} target="_blank" rel="noopener noreferrer" aria-label={linkLabel}>
      <span className="home-reel__poster" aria-hidden>
        {poster && <img className="home-reel__preview" src={poster} alt="" loading="lazy" />}
        <span className="home-reel__play"><Play size={24} fill="currentColor" /></span>
      </span>
      <ReelLinkLabel />
    </a>
  )
}

export function ReelsSection() {
  const trackId = useId()
  const trackRef = useRef<HTMLUListElement>(null)
  const [canScroll, setCanScroll] = useState({ back: false, next: false })
  const [activeAudioReelId, setActiveAudioReelId] = useState<string | null>(null)

  const releaseAudio = useCallback((id: string) => {
    setActiveAudioReelId((active) => active === id ? null : active)
  }, [])

  function toggleAudio(id: string, video: HTMLVideoElement) {
    const unmute = video.muted && !document.hidden
    // Silence the previous element immediately, before updating React or enabling another clip.
    trackRef.current?.querySelectorAll('video').forEach((element) => { element.muted = true })
    if (unmute) video.muted = false
    setActiveAudioReelId(unmute ? id : null)
    return unmute
  }

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const update = () => {
      const back = track.scrollLeft > 2
      const next = track.scrollWidth - track.clientWidth - track.scrollLeft > 2
      setCanScroll((previous) => previous.back === back && previous.next === next ? previous : { back, next })
    }
    update()
    track.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(track)
    return () => {
      track.removeEventListener('scroll', update)
      observer.disconnect()
    }
  }, [])

  function move(direction: -1 | 1) {
    const track = trackRef.current
    const card = track?.firstElementChild
    if (!track || !card) return
    const gap = Number.parseFloat(getComputedStyle(track).columnGap)
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap) })
  }

  function onTrackKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }

  return (
    <section className="container home-section home-reels" aria-labelledby="from-our-kitchen">
      <div className="home-reels__head">
        <SectionHead id="from-our-kitchen" title="From Our Kitchen"
          intro="A glimpse into our traditional recipes, delicious flavours, and food stories." />
        <div className="home-reels__toolbar">
          <a className="home-reels__profile" href={profileUrl} target="_blank" rel="noopener noreferrer" aria-label="Swahasree Foods on Instagram (opens in a new tab)">
            <span className="home-instagram-icon" aria-hidden /> @swahasree_foods <ArrowUpRight size={15} aria-hidden />
          </a>
          {(canScroll.back || canScroll.next) && (
            <div className="home-reels__arrows" role="group" aria-label="Reel navigation">
              <button type="button" className="product-rail__arrow product-rail__arrow--back" aria-label="Previous reel" aria-controls={trackId} disabled={!canScroll.back} onClick={() => move(-1)}><ChevronIcon size={20} /></button>
              <button type="button" className="product-rail__arrow" aria-label="Next reel" aria-controls={trackId} disabled={!canScroll.next} onClick={() => move(1)}><ChevronIcon size={20} /></button>
            </div>
          )}
        </div>
      </div>
      <ul id={trackId} className="home-reels__track" ref={trackRef} tabIndex={0} aria-label="Instagram reels" onKeyDown={onTrackKeyDown}>
        {reels.map((reel, index) => (
          <li key={reel.id}>
            <ReelCard reel={reel} index={index} audible={reel.id === activeAudioReelId} releaseAudio={releaseAudio} toggleAudio={toggleAudio} />
          </li>
        ))}
      </ul>
    </section>
  )
}
