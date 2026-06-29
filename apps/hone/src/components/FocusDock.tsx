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

function modeLabel(mode: FocusMode): string {
  return mode === 'pomodoro' ? 'Pomodoro' : 'Stopwatch';
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
        className="focus-dock-btn"
        onClick={onToggleMode}
        title={`Mode: ${modeLabel(mode)} — click to switch`}
      >
        {modeLabel(mode)}
      </button>
      <button
        type="button"
        className="focus-dock-timer"
        onClick={onReset}
        title="Reset timer"
      >
        {formatTime(remain)}
      </button>
      <button
        type="button"
        className="focus-dock-btn focus-dock-play"
        onClick={onToggle}
        aria-pressed={running}
        aria-label={running ? 'Pause' : 'Start focus'}
      >
        {running ? '⏸' : '▶'}
      </button>
    </div>
  );
}
