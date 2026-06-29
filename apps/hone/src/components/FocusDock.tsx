import type { FocusMode } from '../stores/prefs';

interface FocusDockProps {
  running: boolean;
  remain: number;
  mode: FocusMode;
  onToggle: () => void;
  onReset: () => void;
  onToggleMode: () => void;
}

function formatTime(remain: number): string {
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function modeGlyph(mode: FocusMode): string {
  return mode === 'pomodoro' ? 'P' : 'S';
}

export function FocusDock({
  running,
  remain,
  mode,
  onToggle,
  onReset,
  onToggleMode,
}: FocusDockProps) {
  return (
    <div className="focus-dock" aria-label="Focus timer">
      <button
        type="button"
        className="focus-dock-seg focus-dock-mode"
        onClick={onToggleMode}
        title={`Mode: ${mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch'} — click to switch`}
        aria-label={`Switch mode, current ${mode}`}
      >
        {modeGlyph(mode)}
      </button>

      <span className="focus-dock-divider" aria-hidden />

      <span className="focus-dock-seg focus-dock-time" title="Reset timer">
        <span className="focus-dock-dot" aria-hidden data-running={running} />
        <button type="button" className="focus-dock-timer" onClick={onReset}>
          {formatTime(remain)}
        </button>
      </span>

      <span className="focus-dock-divider" aria-hidden />

      <button
        type="button"
        className="focus-dock-seg focus-dock-play"
        onClick={onToggle}
        aria-pressed={running}
        aria-label={running ? 'Pause' : 'Start focus'}
      >
        {running ? '⏸' : '▶'}
      </button>
    </div>
  );
}
