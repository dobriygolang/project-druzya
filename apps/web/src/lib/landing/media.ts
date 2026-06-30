const HERO_VIDEO = import.meta.env.VITE_HONE_HERO_VIDEO ?? ''
const HERO_POSTER = import.meta.env.VITE_HONE_HERO_POSTER ?? ''

export function heroVideoUrl(): string | null {
  const url = HERO_VIDEO.trim()
  return url || null
}

export function heroPosterUrl(): string | null {
  const url = HERO_POSTER.trim()
  return url || null
}
