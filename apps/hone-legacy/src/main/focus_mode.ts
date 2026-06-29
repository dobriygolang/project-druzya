// focus_mode.ts — macOS Focus mode integration (Phase K Wave 15).
//
// Hone doesn't have native distraction-blocking — that requires
// kernel-level hooks, accessibility prompts, and a long list of
// system permissions we don't want to ask for. Instead, we hand
// off to macOS's built-in Focus modes via the `shortcuts` CLI.
//
// User flow:
//   1. User opens System Settings → Focus → creates a new Focus
//      named e.g. "Druz9 Focus" with their own blocking rules
//      (Twitter, Reddit, YouTube, …).
//   2. User opens Shortcuts.app → New Shortcut → "Set Focus" →
//      pick "Druz9 Focus" → Save as "Druz9 Focus On" / "Off".
//      (Alternatively, macOS itself surfaces "Set Druz9 Focus"
//      as a built-in shortcut when the Focus is created.)
//   3. User types the shortcut name into Hone Settings → Focus.
//   4. Hone calls `shortcuts run "<name>"` at pomodoro start / stop.
//
// Failure modes are intentionally non-fatal — distraction blocking
// is a nice-to-have, the pomodoro itself must continue regardless.
// We return `{ ok: false, error: '…' }` and the UI decides whether
// to surface a toast.

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

import type { FocusModeResult } from '@shared/ipc';

const execAsync = promisify(exec);

/**
 * Run a macOS Focus shortcut by name.
 *
 * - `name === ''` → returns `{ ok: false }` silently (user не настроил).
 * - non-darwin → returns `{ ok: false, error: 'unsupported' }` + logs.
 * - shortcuts CLI ругнулся → пробрасываем stderr в `error`.
 */
export async function runFocusShortcut(name: string): Promise<FocusModeResult> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false };
  }
  if (process.platform !== 'darwin') {
    // eslint-disable-next-line no-console
    console.log(`[focus_mode] skip "${trimmed}" — platform ${process.platform} not supported`);
    return { ok: false, error: 'Focus mode supported on macOS only' };
  }
  // Escape backslashes + double quotes для shell-safe вставки имени.
  // Двойные кавычки оборачивают аргумент полностью — пробелы в имени
  // («Druz9 Focus») остаются одним token'ом.
  const safe = trimmed.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  try {
    await execAsync(`shortcuts run "${safe}"`, { timeout: 5000 });
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.warn(`[focus_mode] failed to run "${trimmed}": ${msg}`);
    // Common stderr: "No shortcut named '…'". Передаём короткий
    // user-facing message без полной exec error chain.
    const short = msg.includes('No shortcut named')
      ? `Shortcut "${trimmed}" not found`
      : msg.split('\n')[0] ?? 'Shortcut failed';
    return { ok: false, error: short };
  }
}
