// Dock — the persistent bottom timer pill. Visible on every page; HomePage
// рисует свой большой mm:ss поверх когда running.
//
// 6 focus modes (mirrors backend hone_focus_mode_valid CHECK миграция 00067):
//   pomodoro  — 25-min cycles + reflection prompt после finish'а
//   stopwatch — ∞ от 00:00 вверх; auto-end не срабатывает
//   free      — no timer, session tracked без mm:ss (для свободного флоу)
//   plan      — multi-block sequence (50 focus + 10 break × 3 для MVP)
//   pinned    — focus tied к pinned task; ends когда task → done
//   countdown — fixed minutes (configured pomodoroMinutes)
//
// Visual — rounded-2xl панель (winter-style), кнопки 40×40 rounded-xl.
// Анимации:
//   • Mount  — fade + slide-up на 720ms (motion-dur-xxlarge).
//   • Menu   — hover rotates icon 180°.
//   • Action — hover scale 1.05 / active scale 0.95.
//   • Timer  — hover swap: time-layer уезжает вниз с blur+fade,
//              controls-layer въезжает сверху (520ms motion-dur-xlarge).
//
// Mode pill (после dock'а) — отдельный mini-pill с 6 кружочками; click
// switches mode + resets timer. Сама секция collapse'ится в иконку
// текущего режима после 1.2s idle.
import { memo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { Icon } from '@shared/ui/primitives/Icon';

// Локальный CSS — keyframes для mount-анимации + hover-варианты для
// DockBtn. Inline event handlers на transform конфликтуют с CSS-hover
// rotate/scale; CSS-driven подход даёт чистый combination.
const DOCK_CSS = `
@keyframes hone-dock-enter {
  from { opacity: 0; transform: translate(-50%, 16px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}

.hone-dock {
  animation: hone-dock-enter var(--motion-dur-xxlarge) var(--motion-ease-standard) both;
}

.hone-dock-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--ink);
  cursor: pointer;
  padding: 0;
  transition:
    background-color var(--motion-dur-large) var(--motion-ease-standard),
    color var(--motion-dur-large) var(--motion-ease-standard),
    transform var(--motion-dur-large) var(--motion-ease-standard);
}
.hone-dock-btn:hover {
  background: rgb(var(--ink-rgb) / 0.1);
  color: var(--ink);
}
.hone-dock-btn[data-variant="menu"]:hover {
  transform: rotate(180deg);
}
.hone-dock-btn[data-variant="action"]:hover {
  transform: scale(1.05);
}
.hone-dock-btn[data-variant="action"]:active {
  transform: scale(0.95);
}

.hone-dock-timer {
  position: relative;
  height: 36px;
  min-width: 92px;
  padding: 0 12px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .hone-dock,
  .hone-dock-btn,
  .hone-dock-timer {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  .hone-dock-btn[data-variant="menu"]:hover,
  .hone-dock-btn[data-variant="action"]:hover,
  .hone-dock-btn[data-variant="action"]:active {
    transform: none;
  }
}
`;

interface DockProps {
  onMenu: () => void;
  running: boolean;
  onToggle: () => void;
  remain: number;
  onReset: () => void;
  vol: number;
  onVol: (v: number) => void;
}

// Dock displays mm:ss so it must re-render every second; memoising the
// outer Dock itself wouldn't help (remain changes). Instead we wrap
// VolumeBtn (below) in React.memo so the volume slider's internal
// useState (open/closeTimer) doesn't tear down on every parent tick.
// The Dock body is exported normally.
export function Dock({
  onMenu,
  running,
  onToggle,
  remain,
  onReset,
  vol,
  onVol,
}: DockProps) {
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  return (
    <>
      <style>{DOCK_CSS}</style>
      <div
        className="no-select hone-dock"
        style={
          {
            position: 'absolute',
            bottom: 36,
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 6,
            borderRadius: 14,
            background: 'transparent',
            border: '1px solid var(--ink-tint-06)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            zIndex: 10,
            // Electron CSS extension (no-drag для DOM-региона)
            WebkitAppRegion: 'no-drag',
          } as CSSProperties
        }
      >
        <DockBtn onClick={onMenu} title="Menu (⌘K)" ariaLabel="Open menu" variant="menu">
          <Icon name="menu" size={14} />
        </DockBtn>
        <Divider />
        <TimerArea running={running} mm={mm} ss={ss} onReset={onReset} />
        <Divider />
        <DockBtn
          onClick={onToggle}
          title={running ? 'Pause' : 'Play'}
          ariaLabel={running ? 'Pause timer' : 'Play timer'}
          ariaPressed={running}
          variant="action"
        >
          <Icon name={running ? 'pause' : 'play'} size={13} />
        </DockBtn>
        <Divider />
        <VolumeBtn vol={vol} onVol={onVol} />
      </div>
    </>
  );
}


interface TimerAreaProps {
  running: boolean;
  mm: string;
  ss: string;
  onReset: () => void;
}

function TimerArea({ running, mm, ss, onReset }: TimerAreaProps) {
  const [hover, setHover] = useState(false);
  const swapTransition =
    'opacity var(--motion-dur-medium) var(--motion-ease-standard),' +
    'transform var(--motion-dur-medium) var(--motion-ease-standard),' +
    'filter var(--motion-dur-medium) var(--motion-ease-standard)';

  return (
    <div
      className="hone-dock-timer"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          opacity: hover ? 0 : 1,
          transform: `translateY(${hover ? 32 : 0}px)`,
          filter: hover ? 'blur(4px)' : 'blur(0)',
          transition: swapTransition,
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: 99,
            background: running ? 'var(--ink)' : 'transparent',
            border: `1px solid ${running ? 'var(--ink)' : 'var(--ink-60)'}`,
          }}
        />
        <span className="mono" style={{ fontSize: 14, letterSpacing: '0.04em', color: 'var(--ink)' }}>
          {mm}:{ss}
        </span>
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hover ? 1 : 0,
          transform: `translateY(${hover ? 0 : -32}px)`,
          transition:
            'opacity var(--motion-dur-medium) var(--motion-ease-standard),' +
            'transform var(--motion-dur-medium) var(--motion-ease-standard)',
        }}
      >
        <DockBtn onClick={onReset} title="Reset timer" ariaLabel="Reset timer" small variant="action">
          <Icon name="rewind" size={15} />
        </DockBtn>
      </div>
    </div>
  );
}

interface DockBtnProps {
  children: ReactNode;
  onClick?: () => void;
  title?: string;
  small?: boolean;
  ariaLabel?: string;
  ariaPressed?: boolean;
  variant?: 'menu' | 'action';
}

function DockBtn({
  children,
  onClick,
  title,
  small = false,
  ariaLabel,
  ariaPressed,
  variant = 'action',
}: DockBtnProps) {
  const size = small ? 28 : 36;
  const radius = small ? 8 : 10;
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={ariaPressed}
      data-variant={variant}
      className="focus-ring hone-dock-btn"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
      }}
    >
      {children}
    </button>
  );
}

function Divider() {
  return (
    <span
      style={{
        width: 1,
        height: 16,
        background: 'rgb(var(--ink-rgb) / 0.18)',
        margin: '0 4px',
      }}
    />
  );
}

interface VolumeBtnProps {
  vol: number;
  onVol: (v: number) => void;
}

// VolumeBtn — кнопка + slider, выезжающий справа за пределы dock-pill'а
// без layout-shift'а. Slider в своём отдельном pill'е (та же эстетика
// что у dock'а) absolute-positioned: левый край прижат к правому краю
// volume-кнопки, разворачивается вправо за границу dock'а. Таймер и
// остальные кнопки не дёргаются.
const VolumeBtn = memo(VolumeBtnImpl);

function VolumeBtnImpl({ vol, onVol }: VolumeBtnProps) {
  const [open, setOpen] = useState(false);
  // preMuteVolRef хранит уровень громкости ПЕРЕД mute'ом — чтобы
  // un-mute click восстанавливал именно его, а не дефолтный 40%. Если
  // юзер был на 65%, кликнул mute → 0; кликнул unmute → обратно 65%.
  const preMuteVolRef = useRef<number>(vol > 0 ? vol : 40);
  const closeTimer = useRef<number | null>(null);

  // hover-bridge: при mouseleave даём 180 ms на «транзит» через 14-px
  // gap к slider'у. mouseenter на slider или btn'е cancel'ит таймер.
  // Без этого slider схлопывается мгновенно когда курсор покидает btn.
  const armClose = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };
  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(true);
  };

  // Click handler: toggle mute ↔ unmute. Раньше click открывал слайдер,
  // юзер ожидал mute-toggle (как в YouTube/Spotify/macOS). Теперь:
  //   - vol > 0 → save current, set to 0 (mute), икон меняется на strike.
  //   - vol === 0 → restore preMuteVolRef.current, иконка возвращается.
  // Slider открывается hover'ом (как раньше), не click'ом.
  const handleClick = () => {
    if (vol > 0) {
      preMuteVolRef.current = vol;
      onVol(0);
    } else {
      onVol(preMuteVolRef.current > 0 ? preMuteVolRef.current : 40);
    }
  };

  return (
    <div
      onMouseLeave={armClose}
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
    >
      {/* Custom track + thumb для volume slider'а. Дефолтный accentColor
          даёт ярко-белую полосу с толстым thumb'ом — юзер хотел тонкую
          едва-видную полоску (rgba 12%) и компактный белый thumb. */}
      <style>{`
        input.hone-vol-slider {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          height: 8px;
          margin: 0;
          padding: 0;
        }
        input.hone-vol-slider:focus { outline: none; }
        input.hone-vol-slider::-webkit-slider-runnable-track {
          height: 2px;
          background: rgb(var(--ink-rgb) / 0.14);
          border-radius: 999px;
        }
        input.hone-vol-slider::-moz-range-track {
          height: 2px;
          background: rgb(var(--ink-rgb) / 0.14);
          border-radius: 999px;
          border: none;
        }
        input.hone-vol-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          border: none;
          margin-top: -3px;
          cursor: pointer;
        }
        input.hone-vol-slider::-moz-range-thumb {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff;
          border: none;
          cursor: pointer;
        }
      `}</style>
      <div onMouseEnter={cancelClose}>
        <DockBtn
          onClick={handleClick}
          title={vol === 0 ? 'Click to unmute' : `Volume ${vol}% · click to mute`}
          ariaLabel={vol === 0 ? 'Unmute volume' : `Mute volume (currently ${vol} percent)`}
          ariaPressed={vol === 0}
          variant="action"
        >
          {/* Mute indicator: когда vol=0, иконка меняет цвет на dimmed +
              рисуется diagonal strike-through через absolute-positioned
              span. Раньше юзер не видел разницы между «50%» и «mute»,
              путался почему звука нет. */}
          <span
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: vol === 0 ? 0.5 : 1,
              transition: 'opacity var(--motion-dur-medium) var(--motion-ease-standard)',
            }}
          >
            <Icon name="volume" size={13} />
            {vol === 0 && (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'block',
                  pointerEvents: 'none',
                  // Diagonal strike — линия из top-right в bottom-left,
                  // 1.5px белая через linear-gradient на 14px box'е.
                  background:
                    'linear-gradient(45deg, transparent 45%, var(--red) 45%, var(--red) 55%, transparent 55%)',
                  borderRadius: 2,
                }}
              />
            )}
          </span>
        </DockBtn>
      </div>
      <div
        onMouseEnter={cancelClose}
        style={{
          position: 'absolute',
          // 14 px gap от правого края volume-кнопки — slider гарантированно
          // не наезжает на остальной dock даже при transform-overshoot.
          left: 'calc(100% + 14px)',
          top: '50%',
          transform: `translateY(-50%) translateX(${open ? '0' : '-8px'})`,
          height: 20,
          width: open ? 64 : 0,
          opacity: open ? 1 : 0,
          padding: open ? '0 6px' : '0',
          display: 'flex',
          alignItems: 'center',
          background: 'transparent',
          border: 'none',
          overflow: 'visible',
          zIndex: 11,
          transition:
            'width var(--motion-dur-medium) var(--motion-ease-standard),' +
            'opacity var(--motion-dur-medium) var(--motion-ease-standard),' +
            'transform var(--motion-dur-medium) var(--motion-ease-standard),' +
            'border-color var(--motion-dur-medium) var(--motion-ease-standard)',
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <input
          type="range"
          min="0"
          max="100"
          value={vol}
          onChange={(e) => onVol(parseInt(e.target.value))}
          tabIndex={open ? 0 : -1}
          aria-label="Volume"
          className="hone-vol-slider"
          style={{
            width: '100%',
            cursor: 'pointer',
          }}
        />
      </div>
    </div>
  );
}
