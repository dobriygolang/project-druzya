// CanvasBg — медитативный фон Hone'а.
//
// Themes (7):
//   - drift (light): line-art astronaut drifting near a capsule on white
//   - visor (light): line-art astronaut portrait with Earth reflected in visor
//   - winter (default): grid + stars float/twinkle + waves drift + 2 rotating squares
//   - birthday: festive illustrated scene (cake, gifts, balloons, confetti)
//   - particles: dense floating particles with proximity lines (canvas2D),
//     line opacity pulses with sine wave, mouse parallax
//   - debris (dark): manga ink scene — astronaut drifting through a debris field
//   - launch (dark): manga ink portrait — visor reflecting a rocket launch
//
// Mode-axis (full / quiet / void) сохранён. full — полная сцена, quiet — приглушённая,
// void — пусто. У image-тем quiet просто снижает opacity.
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
export type ThemeId =
  | 'drift'
  | 'visor'
  | 'winter'
  | 'birthday'
  | 'particles'
  | 'debris'
  | 'launch';

export const THEME_IDS: ThemeId[] = [
  'drift',
  'visor',
  'winter',
  'birthday',
  'particles',
  'debris',
  'launch',
];

interface CanvasBgProps {
  mode?: CanvasMode;
  theme?: ThemeId;
}

export function CanvasBg({ mode = 'full', theme = 'winter' }: CanvasBgProps) {
  if (mode === 'void') return null;
  switch (theme) {
    case 'drift':
      return <ImageBg mode={mode} src="/backgrounds/drift.png" />;
    case 'visor':
      return <ImageBg mode={mode} src="/backgrounds/visor.png" />;
    case 'debris':
      return <ImageBg mode={mode} src="/backgrounds/debris.png" />;
    case 'launch':
      return <ImageBg mode={mode} src="/backgrounds/launch.png" />;
    case 'birthday':
      return <BirthdayBg mode={mode} />;
    case 'particles':
      return <ParticlesBg mode={mode} />;
    case 'winter':
    default:
      return <WinterBg mode={mode} />;
  }
}

// ─── Image — manga-ink scene as a wide rippling background ───────────────
// Фон живёт в полосе между шапкой и доком (см. .hone-bg-poster-host в CSS),
// заполняя её по cover. Анимация — WebGL fragment-shader с плавным UV-displacement
// (паттерн: Codrops "wavy shader" / JS Monkey ripple). Смещение попиксельное
// в UV-пространстве => нет столбцов и "плющения", картинка колышется как ткань.
// Тень складки = |cos(phase)| * uShadow, движется вместе с волной.
const CURTAIN_AMP = 0.0035; // UV-единицы (~0.35% размера)
const CURTAIN_WAVES = 1.0;
const CURTAIN_SPEED = 0.22; // рад в секунду
const CURTAIN_SHADOW = 0.045; // макс. альфа тени складки

const POSTER_VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const POSTER_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
uniform float uAmp;
uniform float uSpeed;
uniform float uWaves;
uniform float uShadow;
uniform float uAmpMul;

void main() {
  vec2 uv = vUv;
  float t = uTime * uSpeed;
  float phase = uv.x * 6.2831853 * uWaves;
  float wave = sin(phase + t) + 0.3 * sin(phase * 0.5 + t * 0.7);
  // Вертикальное смещение (флаг) + лёгкий горизонтальный повод (ткань).
  vec2 d = vec2(
    sin(uv.y * 6.2831853 * uWaves * 0.5 + t * 0.8) * uAmp * 0.4,
    wave * uAmp
  ) * uAmpMul;
  vec3 col = texture2D(uTex, uv + d).rgb;
  // Тень на краю складки (крутизна волны), движется с волной.
  float slope = abs(cos(phase + t));
  col *= 1.0 - slope * uShadow * uAmpMul;
  gl_FragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function ImageBg({ mode, src }: { mode: CanvasMode; src: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fallback, setFallback] = useState(false);
  const dim = mode === 'full' ? 1 : 0.55;
  const ampMul = mode === 'full' ? 1 : 0.5;

  useEffect(() => {
    if (fallback) return;
    const host = hostRef.current;
    const cv = canvasRef.current;
    if (!host || !cv) return;

    const gl = cv.getContext('webgl', {
      antialias: false,
      premultipliedAlpha: false,
      alpha: true,
    }) as WebGLRenderingContext | null;
    if (!gl) {
      setFallback(true);
      return;
    }

    const vert = compileShader(gl, gl.VERTEX_SHADER, POSTER_VERT);
    const frag = compileShader(gl, gl.FRAGMENT_SHADER, POSTER_FRAG);
    if (!vert || !frag) {
      setFallback(true);
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vert);
    gl.attachShader(prog, frag);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFallback(true);
      return;
    }
    gl.useProgram(prog);

    const quad = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uAmp = gl.getUniformLocation(prog, 'uAmp');
    const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
    const uWaves = gl.getUniformLocation(prog, 'uWaves');
    const uShadow = gl.getUniformLocation(prog, 'uShadow');
    const uAmpMul = gl.getUniformLocation(prog, 'uAmpMul');
    gl.uniform1f(uAmp, CURTAIN_AMP);
    gl.uniform1f(uSpeed, CURTAIN_SPEED);
    gl.uniform1f(uWaves, CURTAIN_WAVES);
    gl.uniform1f(uShadow, CURTAIN_SHADOW);
    gl.uniform1f(uAmpMul, ampMul);

    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const off = document.createElement('canvas');
    const offCtx = off.getContext('2d');
    if (!offCtx) {
      setFallback(true);
      return;
    }

    const img = new Image();
    img.decoding = 'async';
    let imgAspect = 16 / 9;
    let ready = false;
    let lastCssW = 0;
    let lastCssH = 0;
    let lastBw = 0;
    let lastBh = 0;
    let textureUploaded = false;

    const syncLayout = () => {
      const hostW = host.clientWidth;
      const hostH = host.clientHeight;
      if (hostW === 0 || hostH === 0) return;
      const w = Math.max(1, Math.round(hostW));
      const h = Math.max(1, Math.round(hostH));
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const bw = Math.max(1, Math.round(w * dpr));
      const bh = Math.max(1, Math.round(h * dpr));

      if (w === lastCssW && h === lastCssH && bw === lastBw && bh === lastBh) {
        if (!textureUploaded) uploadTexture();
        return;
      }
      lastCssW = w;
      lastCssH = h;
      lastBw = bw;
      lastBh = bh;
      textureUploaded = false;

      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      cv.width = bw;
      cv.height = bh;
      off.width = bw;
      off.height = bh;
      gl.viewport(0, 0, bw, bh);
      uploadTexture();
    };

    const uploadTexture = () => {
      if (!ready || !img.complete || img.naturalWidth === 0) return;
      const canvasAspect = off.width / off.height;
      let sx = 0;
      let sy = 0;
      let sw = img.naturalWidth;
      let sh = img.naturalHeight;
      if (canvasAspect > imgAspect) {
        sh = Math.round(sw / canvasAspect);
        sy = Math.round((img.naturalHeight - sh) / 2);
      } else {
        sw = Math.round(sh * canvasAspect);
        sx = Math.round((img.naturalWidth - sw) / 2);
      }
      offCtx.clearRect(0, 0, off.width, off.height);
      offCtx.drawImage(img, sx, sy, sw, sh, 0, 0, off.width, off.height);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
      textureUploaded = true;
    };

    const ro = new ResizeObserver(() => syncLayout());
    ro.observe(host);
    window.addEventListener('resize', syncLayout);

    img.onload = () => {
      if (img.naturalWidth > 0) imgAspect = img.naturalWidth / img.naturalHeight;
      ready = true;
      syncLayout();
    };
    img.src = src;

    let raf = 0;
    const t0 = performance.now();
    const render = () => {
      raf = requestAnimationFrame(render);
      if (!ready) return;
      syncLayout();
      gl.uniform1f(uTime, (performance.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(render);

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('resize', syncLayout);
      document.removeEventListener('visibilitychange', onVisibility);
      gl.deleteProgram(prog);
      gl.deleteShader(vert);
      gl.deleteShader(frag);
      gl.deleteBuffer(buf);
      gl.deleteTexture(tex);
      const loseExt = gl.getExtension('WEBGL_lose_context');
      loseExt?.loseContext();
    };
  }, [src, ampMul, fallback]);

  if (fallback) {
    return (
      <div style={{ ...BG_CONTAINER, background: 'var(--bg)', opacity: dim }}>
        <div className="hone-bg-poster-host" ref={hostRef}>
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="hone-bg-poster-canvas"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...BG_CONTAINER, background: 'var(--bg)', opacity: dim }}>
      <div className="hone-bg-poster-host" ref={hostRef}>
        <canvas ref={canvasRef} aria-hidden="true" className="hone-bg-poster-canvas" />
      </div>
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

// ─── Particles (canvas2D) ───────────────────────────────────────────────
// NOTE: canvas2D stroke/fill styles cannot resolve CSS custom properties, so
// `rgb(var(--ink-rgb) / X)` silently falls back to black and renders invisible
// on a dark background. We resolve --ink-rgb to a concrete rgb triplet via
// getComputedStyle on every frame (cheap, and reacts to theme switches).
function ParticlesBg({ mode }: { mode: CanvasMode }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dim = mode === 'full' ? 1 : 0.4;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
    const t0 = performance.now();
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
      const [ir, ig, ib] = readInkRgb();
      // Lines first (under), then dots.
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.8);
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i]!;
          const b = pts[j]!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < DIST) {
            const op = (1 - d / DIST) * 0.35 * (0.5 + 0.5 * pulse) * dim;
            ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, ${op})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x + px, a.y + py);
            ctx.lineTo(b.x + px, b.y + py);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = `rgba(${ir}, ${ig}, ${ib}, ${0.65 * dim})`;
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x + px, p.y + py, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!document.hidden) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onVisibility = () => {
      if (document.hidden) {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
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

/** Resolve the current `--ink-rgb` token (e.g. "255 255 255") to a concrete triplet. */
function readInkRgb(): [number, number, number] {
  if (typeof window === 'undefined') return [255, 255, 255];
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--ink-rgb').trim();
  const parts = raw.split(/[\s,]+/).map((p) => parseInt(p, 10));
  const r = Number.isFinite(parts[0]) ? parts[0]! : 255;
  const g = Number.isFinite(parts[1]) ? parts[1]! : 255;
  const b = Number.isFinite(parts[2]) ? parts[2]! : 255;
  return [r, g, b];
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
