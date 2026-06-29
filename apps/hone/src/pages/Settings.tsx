import { useState } from 'react';

import { FOCUS_MODE_NAME_KEY, readFocusModeName } from '../lib/focus-settings';
import { SETTINGS_KEY, readPomodoroSeconds } from '../stores/prefs';
import { useSessionStore } from '../stores/session';

interface SettingsPageProps {
  onSettingsChange?: () => void;
}

export function SettingsPage({ onSettingsChange }: SettingsPageProps) {
  const userId = useSessionStore((s) => s.userId);
  const clear = useSessionStore((s) => s.clear);

  const [pomodoroMin, setPomodoroMin] = useState(() => Math.round(readPomodoroSeconds() / 60));
  const [macFocusName, setMacFocusName] = useState(() => readFocusModeName());

  function saveSettings() {
    try {
      const raw = window.localStorage.getItem(SETTINGS_KEY);
      const prev = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify({ ...prev, pomodoroMinutes: pomodoroMin }),
      );
      window.localStorage.setItem(FOCUS_MODE_NAME_KEY, macFocusName.trim());
      onSettingsChange?.();
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="page settings-page">
      <h2>Settings</h2>
      {userId && <p className="settings-meta">Signed in as {userId}</p>}

      <div className="settings-block">
        <label className="settings-label" htmlFor="pomodoro-min">
          Pomodoro length (minutes)
        </label>
        <input
          id="pomodoro-min"
          type="number"
          min={5}
          max={90}
          value={pomodoroMin}
          onChange={(e) => setPomodoroMin(Number(e.target.value))}
          className="settings-input"
        />
      </div>

      <div className="settings-block">
        <label className="settings-label" htmlFor="mac-focus-name">
          macOS Focus shortcut name
        </label>
        <input
          id="mac-focus-name"
          type="text"
          value={macFocusName}
          onChange={(e) => setMacFocusName(e.target.value)}
          placeholder="e.g. Druz9 Focus"
          className="settings-input"
        />
        <p className="settings-hint">
          Shortcuts app name run on session start/stop. Leave empty to disable.
        </p>
      </div>

      <button type="button" className="btn-primary settings-save" onClick={saveSettings}>
        Save
      </button>

      <button type="button" className="btn-ghost settings-signout" onClick={() => void clear()}>
        Sign out
      </button>
    </section>
  );
}
