export interface Star {
  x: number
  y: number
  size: number
  baseOp: number
  floatDur: number
  floatDelay: number
  twinkleDur: number
  twinkleDelay: number
  dx: number
  dy: number
}

export function makeStars(count: number, seed: number): Star[] {
  const rng = mulberry32(seed)
  const out: Star[] = []
  for (let i = 0; i < count; i++) {
    const big = rng() < 0.18
    out.push({
      x: rng() * 100,
      y: rng() * 100,
      size: big ? 1.7 + rng() * 0.7 : 1.0 + rng() * 0.5,
      baseOp: big ? 0.45 + rng() * 0.3 : 0.18 + rng() * 0.2,
      floatDur: 14 + rng() * 18,
      floatDelay: -rng() * 18,
      twinkleDur: 3 + rng() * 4,
      twinkleDelay: -rng() * 5,
      dx: rng() * 12 - 6,
      dy: rng() * 10 - 5,
    })
  }
  return out
}

export function readInkRgb(el: Element): [number, number, number] {
  const raw = getComputedStyle(el).getPropertyValue('--ink-rgb').trim()
  const parts = raw.split(/[\s,]+/).map((p) => parseInt(p, 10))
  const r = Number.isFinite(parts[0]) ? parts[0]! : 255
  const g = Number.isFinite(parts[1]) ? parts[1]! : 255
  const b = Number.isFinite(parts[2]) ? parts[2]! : 255
  return [r, g, b]
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0
  return function () {
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function defaultCanvasTheme(siteTheme: 'dark' | 'light'): import('./types').CanvasThemeId {
  return siteTheme === 'dark' ? 'particles' : 'winter'
}
