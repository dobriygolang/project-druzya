// Dock — persistent bottom timer pill on every page.
import { type CSSProperties, type ReactNode } from 'react';

import { useT } from '@d9-i18n';

import { usePomodoroStore } from '@shared/model/pomodoro';
import { Icon } from '@shared/ui/primitives/Icon';

// Локальный CSS — keyframes для mount-анимации + hover-варианты для
// DockBtn. Inline event handlers на transform конфликтуют с CSS-hover
// rotate/scale; CSS-driven подход даёт чистый combination.
const DOCK_CSS = `
@keyframes hone-dock-enter {
  from { opacity: 0; }
  to   { opacity: 1; }
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
    background-color var(--t-fast),
    color var(--t-fast),
    transform var(--t-fast),
    opacity var(--t-fast);
}
.hone-dock-btn:hover {
  background: rgb(var(--ink-rgb) / 0.1);
  color: var(--ink);
}
.hone-dock-btn[data-variant="menu"]:hover {
  opacity: 0.75;
}
.hone-dock-btn[data-variant="action"]:hover {
  transform: scale(1.02);
}
.hone-dock-btn[data-variant="action"]:active {
  transform: scale(0.98);
}

.hone-dock-timer {
  position: relative;
  height: 36px;
  min-width: 96px;
  padding: 0 10px;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
}

.hone-dock-timer-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    opacity var(--t-base),
    transform var(--t-base);
}

.hone-dock-timer-layer--time {
  gap: 4px;
}

.hone-dock-timer-layer--reset {
  gap: 4px;
  opacity: 0;
  transform: translateY(-6px);
  pointer-events: none;
}

.hone-dock-timer:hover .hone-dock-timer-layer--time {
  opacity: 0;
  transform: translateY(6px);
}

.hone-dock-timer:hover .hone-dock-timer-layer--reset {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
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
}

export function Dock({ onMenu }: DockProps) {
  return (
    <>
      <style>{DOCK_CSS}</style>
      <div
        style={{
          position: 'absolute',
          bottom: 36,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          WebkitAppRegion: 'no-drag',
        }}
      >
      <div
        className="no-select hone-dock"
        style={
          {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: 6,
            borderRadius: 14,
            background: 'transparent',
            border: '1px solid var(--ink-tint-06)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
          } as CSSProperties
        }
      >
        <DockBtn onClick={onMenu} title="Menu (⌘K)" ariaLabel="Open menu" variant="menu">
          <Icon name="menu" size={14} />
        </DockBtn>
        <Divider />
        <TimerControls />
      </div>
      </div>
    </>
  );
}

function ModeCycleBtn() {
  const t = useT();
  const mode = usePomodoroStore((s) => s.mode);
  const cycleMode = usePomodoroStore((s) => s.cycleMode);
  const nextMode = mode === 'pomodoro' ? 'stopwatch' : 'pomodoro';
  const title =
    nextMode === 'stopwatch' ? t('hone.dock.mode_stopwatch') : t('hone.dock.mode_pomodoro');

  return (
    <DockBtn onClick={() => cycleMode()} title={title} ariaLabel={title} small variant="action">
      <Icon name={mode === 'pomodoro' ? 'pomodoro' : 'infinity'} size={14} strokeWidth={2} />
    </DockBtn>
  );
}

function TimerControls() {
  const mode = usePomodoroStore((s) => s.mode);
  const remain = usePomodoroStore((s) => s.remain);
  const elapsed = usePomodoroStore((s) => s.elapsed);
  const running = usePomodoroStore((s) => s.running);
  const toggle = usePomodoroStore((s) => s.toggle);
  const reset = usePomodoroStore((s) => s.reset);
  const displaySec = mode === 'pomodoro' ? remain : elapsed;
  const mm = String(Math.floor(displaySec / 60)).padStart(2, '0');
  const ss = String(displaySec % 60).padStart(2, '0');
  return (
    <>
      <TimerArea running={running} mm={mm} ss={ss} onReset={reset} />
      <Divider />
      <DockBtn
        onClick={toggle}
        title={running ? 'Pause' : 'Play'}
        ariaLabel={running ? 'Pause timer' : 'Play timer'}
        ariaPressed={running}
        variant="action"
      >
        <Icon name={running ? 'pause' : 'play'} size={13} />
      </DockBtn>
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
  const t = useT();
  return (
    <div className="hone-dock-timer">
      <div className="hone-dock-timer-layer hone-dock-timer-layer--time">
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
      <div className="hone-dock-timer-layer hone-dock-timer-layer--reset">
        <ModeCycleBtn />
        <DockBtn
          onClick={onReset}
          title={t('hone.dock.reset_timer')}
          ariaLabel={t('hone.dock.reset_timer')}
          small
          variant="action"
        >
          <Icon name="reset" size={14} strokeWidth={1.6} />
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
      data-hone-demo-target={
        ariaLabel === 'Open menu'
          ? 'dock-menu'
          : ariaLabel === 'Play timer'
            ? 'dock-play'
            : undefined
      }
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

