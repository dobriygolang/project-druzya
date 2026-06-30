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
import { useEffect, useMemo, useRef } from 'react';

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
export type ThemeId =
  | 'light'
  | 'birthday'
  | 'winter'
  | 'aurora'
  | 'grid-rain'
  | 'particles'
  | 'abyss'
  | 'cosmic';

export const THEME_IDS: ThemeId[] = [
  'light',
  'birthday',
  'winter',
  'aurora',
  'grid-rain',
  'particles',
  'abyss',
  'cosmic',
];

interface CanvasBgProps {
  mode?: CanvasMode;
  theme?: ThemeId;
}

export function CanvasBg({ mode = 'full', theme = 'winter' }: CanvasBgProps) {
  if (mode === 'void') return null;
  switch (theme) {
    case 'light':
      return <LightBg mode={mode} />;
    case 'birthday':
      return <BirthdayBg mode={mode} />;
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

// ─── Light — warm daytime scene (matches apps/web sdvg.io aesthetic) ───
function LightBg({ mode }: { mode: CanvasMode }) {
  const dim = mode === 'full' ? 1 : 0.6;
  return (
    <div style={{ ...BG_CONTAINER, background: 'var(--bg)', opacity: dim }}>
      {/* Soft warm sky gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, #fff7ec 0%, #fafaf8 38%, #f3efe6 100%)',
        }}
      />
      {/* Sun with gentle rays */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMin slice"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        aria-hidden
      >
        <defs>
          <radialGradient id="hone-light-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="60%" stopColor="#ffe0a8" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffe0a8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="78" cy="20" r="22" fill="url(#hone-light-sun)" opacity="0.85" />
        <circle cx="78" cy="20" r="6" fill="#ffd98a" opacity="0.9" />
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2;
          const x1 = 78 + Math.cos(a) * 9;
          const y1 = 20 + Math.sin(a) * 9;
          const x2 = 78 + Math.cos(a) * 13;
          const y2 = 20 + Math.sin(a) * 13;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#ffd98a"
              strokeWidth="0.7"
              strokeLinecap="round"
              opacity="0.7"
            />
          );
        })}
        {/* Soft drifting clouds */}
        <g fill="#ffffff" opacity="0.92">
          <ellipse cx="22" cy="26" rx="9" ry="4.4" />
          <ellipse cx="28" cy="24" rx="7" ry="4" />
          <ellipse cx="17" cy="25" rx="5" ry="3.2" />
        </g>
        <g fill="#ffffff" opacity="0.78">
          <ellipse cx="48" cy="40" rx="7" ry="3.4" />
          <ellipse cx="53" cy="39" rx="5" ry="3" />
        </g>
        {/* Rolling hills at the horizon */}
        <path
          d="M0 78 Q 18 70, 36 78 T 72 78 T 108 78 L 108 100 L 0 100 Z"
          fill="#eee7d8"
          opacity="0.9"
        />
        <path
          d="M0 86 Q 22 78, 44 86 T 88 86 T 116 86 L 116 100 L 0 100 Z"
          fill="#e3dcc9"
          opacity="0.95"
        />
        {/* Faint grid for app structure */}
        <g stroke="rgb(15 15 15 / 0.045)" strokeWidth="0.25">
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`v${i}`} x1={i * 8} y1="0" x2={i * 8} y2="100" />
          ))}
          {Array.from({ length: 14 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 8} x2="100" y2={i * 8} />
          ))}
        </g>
      </svg>
    </div>
  );
}

// ─── Birthday — festive illustrated scene for a special day ─────────────
function BirthdayBg({ mode }: { mode: CanvasMode }) {
  const dim = mode === 'full' ? 1 : 0.55;
  const confetti = useMemo(() => {
    const rng = mulberry32(20260630);
    const colors = ['#ffd166', '#ff85a8', '#fff5f7', '#c4a1ff', '#ffb3c6'];
    return Array.from({ length: 40 }, (_, i) => ({
      left: rng() * 100,
      delay: -rng() * 14,
      dur: 8 + rng() * 10,
      rot: rng() * 360,
      color: colors[Math.floor(rng() * colors.length)]!,
      w: 5 + rng() * 4,
      h: 8 + rng() * 6,
      i,
    }));
  }, []);
  const balloons = useMemo(
    () => [
      { left: '8%', color: '#ff85a8', delay: '0s', dur: '11s' },
      { left: '22%', color: '#ffd166', delay: '-2s', dur: '13s' },
      { left: '78%', color: '#c4a1ff', delay: '-4s', dur: '12s' },
      { left: '90%', color: '#ffb3c6', delay: '-1s', dur: '14s' },
    ],
    [],
  );
  const sparkles = useMemo(() => {
    const rng = mulberry32(31415);
    return Array.from({ length: 22 }, (_, i) => ({
      left: rng() * 100,
      top: rng() * 100,
      dur: 2 + rng() * 3,
      delay: -rng() * 4,
      size: 2 + rng() * 3,
      i,
    }));
  }, []);

  return (
    <div className="hone-birthday-bg" style={{ ...BG_CONTAINER, opacity: dim }}>
      <div className="hone-birthday-bg__glow" aria-hidden />

      {/* Main illustrated SVG scene — bunting, cake, gifts, text */}
      <svg
        className="hone-birthday-scene"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden
      >
        {/* Bunting banner across the top */}
        <path
          d="M0 12 Q 25 22, 50 12 T 100 12"
          fill="none"
          stroke="rgb(var(--ink-rgb) / 0.22)"
          strokeWidth="0.3"
        />
        {Array.from({ length: 11 }, (_, i) => {
          const x = 5 + i * 9;
          const y = 13 + Math.sin((i / 11) * Math.PI) * 4;
          const colors = ['#ffd166', '#ff85a8', '#c4a1ff', '#ffb3c6'];
          const c = colors[i % colors.length]!;
          return <polygon key={i} points={`${x},${y} ${x + 4},${y} ${x + 2},${y + 4}`} fill={c} opacity="0.9" />;
        })}

        {/* Birthday cake */}
        <g transform="translate(50 78)">
          {/* plate */}
          <rect x="-16" y="0" width="32" height="2" rx="1" fill="rgb(var(--ink-rgb) / 0.18)" />
          {/* bottom layer */}
          <rect x="-14" y="-12" width="28" height="12" rx="2" fill="#3a1a26" />
          {/* top layer */}
          <rect x="-11" y="-22" width="22" height="10" rx="2" fill="#4a2230" />
          {/* frosting drips */}
          <path
            d="M-11 -22 Q -9 -18, -7 -20 Q -5 -17, -3 -20 Q -1 -17, 1 -20 Q 3 -17, 5 -20 Q 7 -17, 9 -20 Q 11 -18, 11 -22 Z"
            fill="#fff5f7"
            opacity="0.95"
          />
          {/* candle */}
          <rect x="-0.8" y="-28" width="1.6" height="6" rx="0.6" fill="#ffd166" />
          {/* flame */}
          <ellipse className="hone-birthday-cake__flame-svg" cx="0" cy="-30" rx="1.2" ry="2" fill="#ffd166" />
        </g>

        {/* Two little gift boxes beside the cake */}
        <g transform="translate(26 80)" opacity="0.95">
          <rect x="-5" y="-7" width="10" height="7" rx="1" fill="#ff85a8" />
          <rect x="-5" y="-4" width="10" height="1.4" fill="#ffd166" />
          <rect x="-0.7" y="-7" width="1.4" height="7" fill="#ffd166" />
        </g>
        <g transform="translate(74 82)" opacity="0.95">
          <rect x="-5" y="-7" width="10" height="7" rx="1" fill="#c4a1ff" />
          <rect x="-5" y="-4" width="10" height="1.4" fill="#fff5f7" />
          <rect x="-0.7" y="-7" width="1.4" height="7" fill="#fff5f7" />
        </g>
      </svg>

      {/* "С днём рождения!" headline, gently shimmering */}
      <div className="hone-birthday-title" aria-hidden>
        <span className="hone-birthday-title__text">С днём рождения!</span>
      </div>

      {/* Twinkling sparkles scattered across the scene */}
      {sparkles.map((s) => (
        <span
          key={s.i}
          className="hone-birthday-sparkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDuration: `${s.dur}s`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {confetti.map((c) => (
        <span
          key={c.i}
          className="hone-birthday-confetti"
          style={{
            left: `${c.left}%`,
            width: c.w,
            height: c.h,
            background: c.color,
            animationDuration: `${c.dur}s`,
            animationDelay: `${c.delay}s`,
            transform: `rotate(${c.rot}deg)`,
          }}
        />
      ))}
      {balloons.map((b, i) => (
        <div
          key={i}
          className="hone-birthday-balloon"
          style={{
            left: b.left,
            animationDuration: b.dur,
            animationDelay: b.delay,
          }}
        >
          <span className="hone-birthday-balloon__orb" style={{ background: b.color }} />
          <span className="hone-birthday-balloon__string" />
        </div>
      ))}
    </div>
  );
}

// ─── Cosmic — parallax space scene ──────────────────────────────────────
function CosmicBg({ mode }: { mode: CanvasMode }) {
  const stars1 = useMemo(() => makeStars(120, 7777), []);
  const stars2 = useMemo(() => makeStars(50, 8888), []);
  const stars3 = useMemo(() => makeStars(20, 9999), []);
  const layer1Ref = useRef<HTMLDivElement>(null);
  const layer2Ref = useRef<HTMLDivElement>(null);
  const layer3Ref = useRef<HTMLDivElement>(null);
  const planetRef = useRef<HTMLDivElement>(null);
  const mxRef = useRef(0);
  const myRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (mode !== 'full') return;
    const applyParallax = () => {
      rafRef.current = 0;
      const mx = mxRef.current;
      const my = myRef.current;
      if (layer1Ref.current) {
        layer1Ref.current.style.transform = `translate3d(${mx * 8}px,${my * 8}px,0)`;
      }
      if (layer2Ref.current) {
        layer2Ref.current.style.transform = `translate3d(${mx * 18}px,${my * 18}px,0)`;
      }
      if (layer3Ref.current) {
        layer3Ref.current.style.transform = `translate3d(${mx * 32}px,${my * 32}px,0)`;
      }
      if (planetRef.current) {
        planetRef.current.style.left = `calc(50% + ${mx * 14}px)`;
        planetRef.current.style.bottom = `calc(-30% + ${my * 7}px)`;
      }
    };
    const onMove = (e: MouseEvent) => {
      mxRef.current = e.clientX / window.innerWidth - 0.5;
      myRef.current = e.clientY / window.innerHeight - 0.5;
      if (!rafRef.current) rafRef.current = requestAnimationFrame(applyParallax);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mode]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        background: 'var(--bg)',
      }}
    >
      <div ref={layer1Ref} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
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
              opacity: s.baseOp * 0.65,
              boxShadow: '0 0 2px rgb(var(--ink-rgb) / 0.4)',
            }}
          />
        ))}
      </div>
      <div ref={layer2Ref} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
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
              opacity: s.baseOp,
              boxShadow: '0 0 4px rgba(180,200,255,0.6)',
            }}
          />
        ))}
      </div>
      <div ref={layer3Ref} style={{ position: 'absolute', inset: 0, willChange: 'transform' }}>
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
              opacity: s.baseOp + 0.2,
              boxShadow: '0 0 8px rgb(var(--ink-rgb) / 0.85)',
            }}
          />
        ))}
      </div>
      {mode === 'full' && (
        <div
          ref={planetRef}
          style={{
            position: 'absolute',
            left: '50%',
            bottom: '-30%',
            transform: 'translateX(-50%)',
            width: 'min(90vmin, 1200px)',
            height: 'min(90vmin, 1200px)',
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 30%, rgba(120,90,180,0.32) 0%, rgba(60,40,110,0.22) 35%, rgba(20,10,40,0.10) 65%, transparent 100%)',
            boxShadow:
              'inset -50px -80px 120px rgba(0,0,0,0.55), 0 0 80px rgba(80,60,140,0.18)',
            willChange: 'left, bottom',
          }}
        />
      )}
    </div>
  );
}

// ─── Winter (default, original) ─────────────────────────────────────────
function WinterBg({ mode }: { mode: CanvasMode }) {
  const stars = useMemo(() => makeStars(32, 1337), []);

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
          <svg
            className="winter-square"
            width="280"
            height="280"
            viewBox="-140 -140 280 280"
          >
            <rect x={-90} y={-90} width={180} height={180} fill="none" stroke="rgb(var(--ink-rgb) / 0.85)" strokeWidth="1" />
          </svg>
          <svg
            className="winter-square winter-square--offset"
            width="280"
            height="280"
            viewBox="-140 -140 280 280"
            style={{ position: 'absolute', inset: 0 }}
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
