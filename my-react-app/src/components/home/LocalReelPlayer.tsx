import { Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export function LocalReelPlayer({ id, source, poster, number, audible, releaseAudio, toggleAudio, onUnavailable }: {
  id: string
  source: string
  poster?: string
  number: number
  audible: boolean
  releaseAudio: (id: string) => void
  toggleAudio: (id: string, video: HTMLVideoElement) => boolean
  onUnavailable: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pausedByViewer = useRef(false)
  const playAttempt = useRef(0)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)

  const play = useCallback((video: HTMLVideoElement) => {
    const attempt = ++playAttempt.current
    void video.play().catch(() => {
      if (attempt !== playAttempt.current) return
      video.muted = true
      releaseAudio(id)
      setPlaying(false)
    })
  }, [id, releaseAudio])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let visible = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

    const pauseAndMute = () => {
      playAttempt.current += 1
      if (!video.muted) {
        video.muted = true
        releaseAudio(id)
      }
      video.pause()
    }

    const syncVisibility = () => {
      if (!visible || document.hidden) pauseAndMute()
      else if (video.paused && !pausedByViewer.current && !reducedMotion.matches) play(video)
    }

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.55
      syncVisibility()
    }, { threshold: [0, 0.55] })
    observer?.observe(video)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      observer?.disconnect()
      document.removeEventListener('visibilitychange', syncVisibility)
      pauseAndMute()
    }
  }, [id, play, releaseAudio])

  function togglePlayback() {
    const video = videoRef.current
    if (!video) return
    pausedByViewer.current = !video.paused
    if (video.paused) play(video)
    else {
      playAttempt.current += 1
      video.pause()
    }
  }

  function onSoundClick() {
    const video = videoRef.current
    if (!video) return
    playAttempt.current += 1
    if (toggleAudio(id, video)) {
      pausedByViewer.current = false
      play(video)
    }
  }

  return (
    <div className="home-reel__poster home-reel__media">
      <video ref={videoRef} src={source} poster={poster} muted={!audible} loop playsInline preload="none" aria-label={`Swahasree Foods reel ${number}`}
        data-ready={ready || Boolean(poster)} onLoadedData={() => setReady(true)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { releaseAudio(id); onUnavailable() }} />
      <div className="home-reel__video-controls">
        <button type="button" onClick={togglePlayback} aria-label={`${playing ? 'Pause' : 'Play'} reel ${number}`}>
          {playing ? <Pause size={20} aria-hidden /> : <Play size={20} aria-hidden />}
        </button>
        <button type="button" onClick={onSoundClick} aria-label={`${audible ? 'Mute' : 'Unmute'} reel ${number}`}>
          {audible ? <Volume2 size={20} aria-hidden /> : <VolumeX size={20} aria-hidden />}
        </button>
      </div>
    </div>
  )
}
