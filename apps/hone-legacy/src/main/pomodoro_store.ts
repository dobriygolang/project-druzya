// pomodoro_store.ts — JSON-файл с remainSec/running/savedAt.
//
// Не шифруется: pomodoro-таймер не secret. Атомарный write-then-rename
// чтобы partial crash не оставил половинный файл.
//
// Restore-семантика на стороне renderer'а: если running=true и (now -
// savedAt) > remainSec * 1000 — таймер дотикал «во сне», флипаем running
// в false и remainSec в 0 (вызовется reflection-modal на mount).

import { app } from 'electron';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

import type { PomodoroSnapshot } from '@shared/ipc';

const filename = 'pomodoro.json';

function pomodoroPath(): string {
  return join(app.getPath('userData'), filename);
}

export async function loadPomodoro(): Promise<PomodoroSnapshot | null> {
  try {
    const raw = await fs.readFile(pomodoroPath(), 'utf8');
    const parsed = JSON.parse(raw) as PomodoroSnapshot;
    if (typeof parsed.remainSec !== 'number' || typeof parsed.running !== 'boolean') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function savePomodoro(snap: PomodoroSnapshot): Promise<void> {
  const dst = pomodoroPath();
  const tmp = `${dst}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(snap), { mode: 0o600 });
  await fs.rename(tmp, dst);
}
