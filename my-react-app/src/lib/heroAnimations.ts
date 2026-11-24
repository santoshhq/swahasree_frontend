// How the home page hero moves from one banner to the next. The admin picks one in
// Admin > Home page banners; the server only stores its id (the same list as HeroAnimation in the
// backend's models/banner_section_model.py). Each id is a .hero--<id> class in App.css.
export type HeroAnimation = 'slow-zoom' | 'fade' | 'slide' | 'zoom' | 'wipe'

export const DEFAULT_ANIMATION: HeroAnimation = 'slow-zoom'

export const HERO_ANIMATIONS: { id: HeroAnimation; name: string; description: string }[] = [
  { id: 'slow-zoom', name: 'Slow zoom', description: 'Each banner fades in and drifts slowly closer.' },
  { id: 'fade', name: 'Fade', description: 'A calm cross-fade, with no movement.' },
  { id: 'slide', name: 'Slide', description: 'The next banner pushes the current one off to the left.' },
  { id: 'zoom', name: 'Zoom out', description: 'The next banner settles in from slightly enlarged.' },
  { id: 'wipe', name: 'Wipe', description: 'The next banner is revealed from left to right.' },
]

export const animationName = (id: HeroAnimation) => HERO_ANIMATIONS.find((a) => a.id === id)?.name ?? id
