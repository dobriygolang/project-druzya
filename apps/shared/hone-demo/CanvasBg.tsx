import { useEffect, useMemo, useRef, type CSSProperties } from 'react'

import { ImageBg } from './ImageBg'
import { makeStars, mulberry32, readInkRgb } from './helpers'
import type { CanvasThemeId } from './types'

const GRID_STEP_PX = 64

const BG_CONTAINER: CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
}

const WAVES = [
  {
    d: 'M-200,260 C 260,180 480,360 760,290 S 1240,220 1900,250',
    dur: '17s',
    delay: '0s',
    anim: 'hone-demo-wave-drift',
    op: 0.22,
    sw: 1,
  },
  {
    d: 'M-200,400 C 240,360 520,460 880,400 S 1320,320 1900,400',
    dur: '23s',
    delay: '-3s',
    anim: 'hone-demo-wave-tilt',
    op: 0.18,
    sw: 1,
  },
  {
    d: 'M-200,520 C 280,500 580,600 900,540 S 1380,440 1900,500',
    dur: '29s',
    delay: '-7s',
    anim: 'hone-demo-wave-drift',
    op: 0.2,
    sw: 1,
  },
  {
    d: 'M-200,640 C 320,610 660,720 980,660 S 1420,580 1900,620',
    dur: '31s',
    delay: '-11s',
    anim: 'hone-demo-wave-tilt',
    op: 0.16,
    sw: 1,
  },
  {
    d: 'M-200,760 C 360,740 700,800 1020,760 S 1460,720 1900,750',
    dur: '37s',
    delay: '-19s',
    anim: 'hone-demo-wave-drift',
    op: 0.14,
    sw: 1,
  },
]

const IMAGE_THEMES: CanvasThemeId[] = ['drift', 'visor', 'debris', 'launch']

interface CanvasBgProps {
  theme: CanvasThemeId
  assetBase: string
  reducedMotion?: boolean
}

export function CanvasBg({ theme, assetBase, reducedMotion = false }: CanvasBgProps) {
  if (reducedMotion) return <StaticBg />
  if (IMAGE_THEMES.includes(theme)) {
    return <ImageBg src={`${assetBase}/${theme}.png`} reducedMotion={reducedMotion} />
  }
  if (theme === 'particles') return <ParticlesBg />
  return <WinterBg />
}

function StaticBg() {
  return (
    <div style={BG_CONTAINER}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            `linear-gradient(rgb(var(--ink-rgb) / 0.035) 1px, transparent 1px),` +
            `linear-gradient(90deg, rgb(var(--ink-rgb) / 0.035) 1px, transparent 1px)`,
          backgroundSize: `${GRID_STEP_PX}px ${GRID_STEP_PX}px`,
        }}
      />
    </div>
  )
}

function WinterBg() {
  const stars = useMemo(() => makeStars(32, 1337), [])

  return (
    <div style={BG_CONTAINER}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            `linear-gradient(rgb(var(--ink-rgb) / 0.035) 1px, transparent 1px),` +
            `linear-gradient(90deg, rgb(var(--ink-rgb) / 0.035) 1px, transparent 1px)`,
          backgroundSize: `${GRID_STEP_PX}px ${GRID_STEP_PX}px`,
        }}
      />
      {stars.map((s: (typeof stars)[number], i: number) => (
        <span
          key={i}
          className="hone-demo-star"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              opacity: s.baseOp,
              animation:
                `hone-demo-star-float ${s.floatDur}s ease-in-out ${s.floatDelay}s infinite,` +
                ` hone-demo-star-twinkle ${s.twinkleDur}s ease-in-out ${s.twinkleDelay}s infinite`,
              '--star-dx': `${s.dx}px`,
              '--star-dy': `${s.dy}px`,
              '--star-base': `${s.baseOp}`,
            } as CSSProperties
          }
        />
      ))}
      {WAVES.map((w, i) => (
        <div
          key={i}
          className="hone-demo-wave-layer"
          style={{ animation: `${w.anim} ${w.dur} ease-in-out ${w.delay} infinite` }}
        >
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 1700 900"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0 }}
          >
            <path d={w.d} fill="none" stroke={`rgb(var(--ink-rgb) / ${w.op})`} strokeWidth={w.sw} />
          </svg>
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 280,
          height: 280,
          transform: 'translate(-50%,-50%)',
          opacity: 0.32,
        }}
      >
        <svg
          className="hone-demo-winter-square"
          width="280"
          height="280"
          viewBox="-140 -140 280 280"
        >
          <rect
            x={-90}
            y={-90}
            width={180}
            height={180}
            fill="none"
            stroke="rgb(var(--ink-rgb) / 0.85)"
            strokeWidth="1"
          />
        </svg>
        <svg
          className="hone-demo-winter-square hone-demo-winter-square--offset"
          width="280"
          height="280"
          viewBox="-140 -140 280 280"
          style={{ position: 'absolute', inset: 0 }}
        >
          <rect
            x={-90}
            y={-90}
            width={180}
            height={180}
            fill="none"
            stroke="rgb(var(--ink-rgb) / 0.85)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  )
}

function ParticlesBg() {
  const ref = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cv = ref.current
    const container = containerRef.current
    if (!cv || !container) return
    const ctx = cv.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let W = cv.clientWidth
    let H = cv.clientHeight
    const resize = () => {
      W = cv.clientWidth
      H = cv.clientHeight
      cv.width = W * dpr
      cv.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const N = 60
    const rng = mulberry32(4242)
    const pts = Array.from({ length: N }, () => ({
      x: rng() * W,
      y: rng() * H,
      vx: (rng() - 0.5) * 0.25,
      vy: (rng() - 0.5) * 0.25,
      r: 1 + rng() * 1.4,
    }))
    const mouse = { x: W / 2, y: H / 2 }
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    container.addEventListener('mousemove', onMove)

    let raf = 0
    const t0 = performance.now()
    const DIST = 110

    const loop = (now: number) => {
      const t = (now - t0) / 1000
      ctx.clearRect(0, 0, W, H)
      const px = (mouse.x / W - 0.5) * 18
      const py = (mouse.y / H - 0.5) * 18

      for (const p of pts) {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > W) p.vx *= -1
        if (p.y < 0 || p.y > H) p.vy *= -1
      }
      const [ir, ig, ib] = readInkRgb(container)
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.8)
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i]!
          const b = pts[j]!
          const dx = a.x - b.x
          const dy = a.y - b.y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < DIST) {
            const op = (1 - d / DIST) * 0.35 * (0.5 + 0.5 * pulse)
            ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, ${op})`
            ctx.lineWidth = 0.6
            ctx.beginPath()
            ctx.moveTo(a.x + px, a.y + py)
            ctx.lineTo(b.x + px, b.y + py)
            ctx.stroke()
          }
        }
      }
      ctx.fillStyle = `rgba(${ir}, ${ig}, ${ib}, 0.65)`
      for (const p of pts) {
        ctx.beginPath()
        ctx.arc(p.x + px, p.y + py, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf)
        raf = 0
        return
      }
      if (!raf) raf = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      container.removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div ref={containerRef} style={BG_CONTAINER}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 50%, var(--ink-tint-04), transparent 70%)',
          animation: 'hone-demo-particles-breathe 8s ease-in-out infinite',
        }}
      />
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  )
}
