// CanvasBg — медитативный фон Hone'а.
//
// Themes (5):
//   - winter (default): grid + stars float/twinkle + waves drift + 2 rotating squares
//   - aurora: diagonal gradient stripes drifting at different speeds, hue shift,
//     occasional shooting star crossing the screen
//   - grid-rain: matrix-style vertical streams of falling 0/1 chars, plus a faint
//     perspective grid receding to a vanishing point
//   - particles: dense floating particles with proximity lines (canvas2D),
//     line opacity pulses with sine wave, mouse parallax
//   - abyss: huge slowly-rotating polygon in centre with breathing scale,
//     surrounded by ambient swirling concentric arcs rotating at different rates
//
// Mode-axis (full / quiet / void) сохранён, но применяется только к winter,
// у других тем — full всегда (там нет "тихого" варианта). void пустой везде.
import { useEffect, useMemo, useRef, useState } from 'react';

const GRID_STEP_PX = 64;

const BG_CONTAINER: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  pointerEvents: 'none',
};

const WAVES = [
  { d: 'M-200,260 C 260,180 480,360 760,290 S 1240,220 1900,250', dur: '17s', delay: '0s', anim: 'wave-drift', op: 0.22, sw: 1 },
  { d: 'M-200,400 C 240,360 520,460 880,400 S 1320,320 1900,400', dur: '23s', delay: '-3s', anim: 'wave-tilt', op: 0.18, sw: 1 },
  { d: 'M-200,520 C 280,500 580,600 900,540 S 1380,440 1900,500', dur: '29s', delay: '-7s', anim: 'wave-drift', op: 0.20, sw: 1 },
  { d: 'M-200,640 C 320,610 660,720 980,660 S 1420,580 1900,620', dur: '31s', delay: '-11s', anim: 'wave-tilt', op: 0.16, sw: 1 },
  { d: 'M-200,760 C 360,740 700,800 1020,760 S 1460,720 1900,750', dur: '37s', delay: '-19s', anim: 'wave-drift', op: 0.14, sw: 1 },
];

export type CanvasMode = 'full' | 'quiet' | 'void';
export type ThemeId = 'winter' | 'aurora' | 'grid-rain' | 'particles' | 'abyss' | 'cosmic';

export const THEME_IDS: ThemeId[] = ['winter', 'aurora', 'grid-rain', 'particles', 'abyss', 'cosmic'];

interface CanvasBgProps {
  mode?: CanvasMode;
  theme?: ThemeId;
}

export function CanvasBg({ mode = 'full', theme = 'winter' }: CanvasBgProps) {
  if (mode === 'void') return null;
  // Decorative canvas (starfield / waves / aurora / grid-rain / particles /
  // abyss / cosmic) дизайнились под чёрный фон — белые точки/линии на
  // тёмном небе. В light-теме они либо невидимы (white-on-white), либо
  // visually noisy (если переключим на чёрные точки). Kill switch проще
  // и аккуратнее: light-тема просто получает плоский --bg, decoration
  // возвращается на dark. См styles/globals.css → html.light палитра.
  if (typeof document !== 'undefined' && document.documentElement.classList.contains('light')) {
    return null;
  }
  switch (theme) {
    case 'aurora':
      return <AuroraBg mode={mode} />;
    case 'grid-rain':
      return <GridRainBg mode={mode} />;
    case 'particles':
      return <ParticlesBg mode={mode} />;
    case 'abyss':
      return <AbyssBg mode={mode} />;
    case 'cosmic':
      return <CosmicBg mode={mode} />;
    case 'winter':
    default:
      return <WinterBg mode={mode} />;
  }
}

// ─── Cosmic — parallax space scene ──────────────────────────────────────
//
// Manga-styled space ambience: глубокий starfield в 3 layers (different
// drift speeds), огромная planet-disc в нижнем центре, asteroids
// вокруг неё в slow rotation. Mouse-tracking parallax: cursor движется
// → layers shift'ятся пропорционально (closer planets — больше offset).
// Ambient mood — не агрессивно, не distracting.
function CosmicBg({ mode }: { mode: CanvasMode }) {
  const stars1 = useMemo(() => makeStars(120, 7777), []); // far layer
  const stars2 = useMemo(() => makeStars(50, 8888), []); // mid layer
  const stars3 = useMemo(() => makeStars(20, 9999), []); // near layer (brighter)
  const [mx, setMx] = useState(0);
  const [my, setMy] = useState(0);
  // Mouse-tracking — normalized -0.5..0.5 от viewport center.
  useEffect(() => {
    if (mode !== 'full') return;
    const onMove = (e: MouseEvent) => {
      setMx(e.clientX / window.innerWidth - 0.5);
      setMy(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [mode]);

  // Slow drift (idle motion when mouse не двигается).
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (mode !== 'full') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setTick((t) => t + (now - last) * 0.0001);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  // Parallax depth multipliers: far layer drifts мало, near layer много.
  const px1 = mx * 8; // far stars
  const py1 = my * 8;
  const px2 = mx * 18;
  const py2 = my * 18;
  const px3 = mx * 32;
  const py3 = my * 32;
  const planetX = mx * 14;
  const planetY = my * 14;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        // Pure black backdrop — раньше был фиолетовый haze. Юзер просил
        // чисто чёрный космос, чтобы starfield сильнее контрастил и
        // соответствовал общему дарк-эстетике Hone'а.
        background: 'var(--bg)',
      }}
    >
      {/* Star layer 1 — far. Smaller dim stars + slow drift. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${px1}px, ${py1}px)`,
          transition: 'transform var(--motion-dur-xxlarge) var(--motion-ease-standard)',
        }}
      >
        {stars1.map((s, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size * 0.6,
              height: s.size * 0.6,
              borderRadius: '50%',
              background: 'rgb(var(--ink-rgb) / 0.55)',
              opacity: 0.3 + Math.sin(tick * 6 + i) * 0.15,
              boxShadow: '0 0 2px rgb(var(--ink-rgb) / 0.4)',
            }}
          />
        ))}
      </div>
      {/* Star layer 2 — mid. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${px2}px, ${py2}px)`,
          transition: 'transform var(--motion-dur-xlarge) var(--motion-ease-standard)',
        }}
      >
        {stars2.map((s, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              borderRadius: '50%',
              background: 'rgba(220,230,255,0.85)',
              opacity: 0.5 + Math.sin(tick * 8 + i * 0.7) * 0.25,
              boxShadow: '0 0 4px rgba(180,200,255,0.6)',
            }}
          />
        ))}
      </div>
      {/* Star layer 3 — near. Brightest, biggest, fastest parallax. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${px3}px, ${py3}px)`,
          transition: 'transform var(--motion-dur-xlarge) var(--motion-ease-standard)',
        }}
      >
        {stars3.map((s, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size * 1.6,
              height: s.size * 1.6,
              borderRadius: '50%',
              background: 'rgb(var(--ink-rgb) / 0.95)',
              opacity: 0.7 + Math.sin(tick * 12 + i * 1.3) * 0.25,
              boxShadow: '0 0 8px rgb(var(--ink-rgb) / 0.85)',
            }}
          />
        ))}
      </div>
      {/* Planet — большая полупрозрачная disc нижним-центром. Inset
          gradient симулирует sphere illumination. Atmosphere ring снаружи. */}
      {mode === 'full' && (
        <div
          style={{
            position: 'absolute',
            left: `calc(50% + ${planetX}px)`,
            bottom: `calc(-30% + ${planetY * 0.5}px)`,
            transform: 'translateX(-50%)',
            width: 'min(90vmin, 1200px)',
            height: 'min(90vmin, 1200px)',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 30%, rgba(120,90,180,0.32) 0%, rgba(60,40,110,0.22) 35%, rgba(20,10,40,0.10) 65%, transparent 100%)',
            boxShadow:
              'inset -50px -80px 120px rgba(0,0,0,0.55), 0 0 80px rgba(80,60,140,0.18)',
            transition: 'left var(--motion-dur-xxlarge) var(--motion-ease-standard), bottom var(--motion-dur-xxlarge) var(--motion-ease-standard)',
          }}
        />
      )}
    </div>
  );
}

// ─── Winter (default, original) ─────────────────────────────────────────
function WinterBg({ mode }: { mode: CanvasMode }) {
  const stars = useMemo(() => makeStars(32, 1337), []);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (mode !== 'full') return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      setTick((t) => t + (now - last) * 0.0042);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const starOpMul = mode === 'full' ? 1 : 0.35;
  const showWaves = mode === 'full';
  const showSquares = mode === 'full';

  return (
    <div style={BG_CONTAINER}>
      {showWaves && (
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
      )}
      {stars.map((s, i) => (
        <span
          key={i}
          className="star"
          style={
            {
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              opacity: s.baseOp * starOpMul,
              animation:
                `star-float ${s.floatDur}s ease-in-out ${s.floatDelay}s infinite,` +
                ` star-twinkle ${s.twinkleDur}s ease-in-out ${s.twinkleDelay}s infinite`,
              '--star-dx': `${s.dx}px`,
              '--star-dy': `${s.dy}px`,
              '--star-base': `${s.baseOp * starOpMul}`,
            } as React.CSSProperties
          }
        />
      ))}
      {showWaves &&
        WAVES.map((w, i) => (
          <div
            key={i}
            className="wave-layer"
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
      {showSquares && (
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
          <svg width="280" height="280" viewBox="-140 -140 280 280" style={{ transform: `rotate(${tick}deg)` }}>
            <rect x={-90} y={-90} width={180} height={180} fill="none" stroke="rgb(var(--ink-rgb) / 0.85)" strokeWidth="1" />
          </svg>
          <svg
            width="280"
            height="280"
            viewBox="-140 -140 280 280"
            style={{ position: 'absolute', inset: 0, transform: `rotate(${tick + 22}deg)` }}
          >
            <rect x={-90} y={-90} width={180} height={180} fill="none" stroke="rgb(var(--ink-rgb) / 0.85)" strokeWidth="1" />
          </svg>
        </div>
      )}
    </div>
  );
}

// ─── Aurora ─────────────────────────────────────────────────────────────
function AuroraBg({ mode }: { mode: CanvasMode }) {
  // 4 диагональных gradient-полосы, разные speed/delay.
  // Плюс одна "shooting star" каждые ~12 сек по диагонали.
  const dim = mode === 'full' ? 1 : 0.4;
  return (
    <div style={BG_CONTAINER}>
      {/* Backdrop hue rotation — медленный shift всей сцены */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          animation: 'aurora-hue 60s linear infinite',
          opacity: dim,
        }}
      >
        <div className="aurora-stripe" style={{ animationDuration: '22s', top: '-30%', opacity: 0.55 }} />
        <div
          className="aurora-stripe aurora-stripe-2"
          style={{ animationDuration: '34s', animationDelay: '-8s', top: '10%', opacity: 0.45 }}
        />
        <div
          className="aurora-stripe aurora-stripe-3"
          style={{ animationDuration: '46s', animationDelay: '-15s', top: '40%', opacity: 0.4 }}
        />
        <div
          className="aurora-stripe"
          style={{ animationDuration: '29s', animationDelay: '-19s', top: '70%', opacity: 0.35 }}
        />
      </div>
      {/* Shooting stars */}
      <span className="aurora-shoot" style={{ animationDelay: '-2s', top: '18%', opacity: dim }} />
      <span className="aurora-shoot" style={{ animationDelay: '-9s', top: '54%', opacity: dim }} />
    </div>
  );
}

// ─── Grid Rain ──────────────────────────────────────────────────────────
function GridRainBg({ mode }: { mode: CanvasMode }) {
  // 28 колонок цифрового дождя; каждая со своим delay/duration/x.
  const columns = useMemo(() => {
    const rng = mulberry32(7349);
    const out: { x: number; dur: number; delay: number; chars: string }[] = [];
    const COLS = 28;
    for (let i = 0; i < COLS; i++) {
      let s = '';
      const len = 14 + Math.floor(rng() * 12);
      for (let j = 0; j < len; j++) s += rng() < 0.5 ? '0' : '1';
      out.push({
        x: (i / COLS) * 100,
        dur: 6 + rng() * 8,
        delay: -rng() * 8,
        chars: s,
      });
    }
    return out;
  }, []);
  const dim = mode === 'full' ? 1 : 0.4;

  return (
    <div style={BG_CONTAINER}>
      {/* Perspective grid (faint) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(var(--ink-tint-04) 1px, transparent 1px),' +
            'linear-gradient(90deg, var(--ink-tint-04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          transform: 'perspective(700px) rotateX(58deg) translateY(28%) scale(1.6)',
          transformOrigin: 'center bottom',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 60%)',
          opacity: 0.85 * dim,
        }}
      />
      {/* Falling streams */}
      <div className="mono" style={{ position: 'absolute', inset: 0, opacity: dim }}>
        {columns.map((c, i) => (
          <div
            key={i}
            className="rain-col"
            style={{
              left: `${c.x}%`,
              animation: `rain-fall ${c.dur}s linear ${c.delay}s infinite`,
            }}
          >
            {c.chars.split('').map((ch, j) => (
              <span key={j} style={{ opacity: 1 - j / c.chars.length }}>
                {ch}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Particles (canvas2D) ───────────────────────────────────────────────
function ParticlesBg({ mode }: { mode: CanvasMode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dim = mode === 'full' ? 1 : 0.4;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    let W = cv.clientWidth;
    let H = cv.clientHeight;
    const resize = () => {
      W = cv.clientWidth;
      H = cv.clientHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const N = 60;
    const rng = mulberry32(4242);
    const pts = Array.from({ length: N }, () => ({
      x: rng() * W,
      y: rng() * H,
      vx: (rng() - 0.5) * 0.25,
      vy: (rng() - 0.5) * 0.25,
      r: 1 + rng() * 1.4,
    }));
    const mouse = { x: W / 2, y: H / 2 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    let raf = 0;
    let t0 = performance.now();
    const DIST = 110;

    const loop = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      // Parallax shift based on mouse.
      const px = (mouse.x / W - 0.5) * 18;
      const py = (mouse.y / H - 0.5) * 18;

      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
      }
      // Lines first (under), then dots.
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i];
          const b = pts[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            const op = (1 - d / DIST) * 0.35 * (0.5 + 0.5 * pulse) * dim;
            ctx.strokeStyle = `rgb(var(--ink-rgb) / ${op})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x + px, a.y + py);
            ctx.lineTo(b.x + px, b.y + py);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgb(var(--ink-rgb) / ${0.65 * dim})`;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x + px, p.y + py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, [dim]);

  return (
    <div style={BG_CONTAINER}>
      {/* Slow radial backdrop pulse */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(ellipse at 50% 50%, var(--ink-tint-04), transparent 70%)',
          animation: 'particles-breathe 8s ease-in-out infinite',
          opacity: dim,
        }}
      />
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
    </div>
  );
}

// ─── Abyss ──────────────────────────────────────────────────────────────
function AbyssBg({ mode }: { mode: CanvasMode }) {
  const dim = mode === 'full' ? 1 : 0.4;
  // 12-угольник (большой) + 3 окружающих arc-кольца.
  const polyPoints = useMemo(() => {
    const N = 12;
    const R = 220;
    const arr: string[] = [];
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 - Math.PI / 2;
      arr.push(`${(Math.cos(a) * R).toFixed(2)},${(Math.sin(a) * R).toFixed(2)}`);
    }
    return arr.join(' ');
  }, []);

  return (
    <div style={BG_CONTAINER}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 50%, rgba(20,20,30,0.65), rgba(0,0,0,0.95) 70%)',
          opacity: dim,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 560,
          height: 560,
          transform: 'translate(-50%,-50%)',
          opacity: 0.75 * dim,
        }}
      >
        {/* Breathing rotating polygon — wrap two divs so rotate + scale don't fight on one transform */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            animation: 'abyss-breathe 8s ease-in-out infinite',
          }}
        >
          <svg
            width="560"
            height="560"
            viewBox="-280 -280 560 560"
            style={{
              position: 'absolute',
              inset: 0,
              animation: 'abyss-rotate 90s linear infinite',
            }}
          >
            <polygon points={polyPoints} fill="none" stroke="rgb(var(--ink-rgb) / 0.55)" strokeWidth="1" />
            <polygon
              points={polyPoints}
              fill="none"
              stroke="rgb(var(--ink-rgb) / 0.18)"
              strokeWidth="1"
              transform="scale(0.7)"
            />
            <polygon
              points={polyPoints}
              fill="none"
              stroke="rgb(var(--ink-rgb) / 0.1)"
              strokeWidth="1"
              transform="scale(0.4)"
            />
          </svg>
        </div>
        {/* Counter-rotating arc ring */}
        <svg
          width="560"
          height="560"
          viewBox="-280 -280 560 560"
          style={{
            position: 'absolute',
            inset: 0,
            animation: 'abyss-rotate-rev 140s linear infinite',
          }}
        >
          <circle cx="0" cy="0" r="260" fill="none" stroke="rgb(var(--ink-rgb) / 0.05)" strokeWidth="1" />
          <path
            d="M -260 0 A 260 260 0 0 1 0 -260"
            fill="none"
            stroke="rgb(var(--ink-rgb) / 0.25)"
            strokeWidth="1"
          />
          <path
            d="M 200 0 A 200 200 0 0 1 0 200"
            fill="none"
            stroke="rgb(var(--ink-rgb) / 0.18)"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────
interface Star {
  x: number;
  y: number;
  size: number;
  baseOp: number;
  floatDur: number;
  floatDelay: number;
  twinkleDur: number;
  twinkleDelay: number;
  dx: number;
  dy: number;
}

function makeStars(count: number, seed: number): Star[] {
  const rng = mulberry32(seed);
  const out: Star[] = [];
  for (let i = 0; i < count; i++) {
    const big = rng() < 0.18;
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
    });
  }
  return out;
}

function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
