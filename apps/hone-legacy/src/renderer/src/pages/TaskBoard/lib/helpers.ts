// Local-only title overrides — backend пока не имеет updateTaskTitle RPC,
// поэтому inline-edit персистится в localStorage и накладывается поверх
// серверного title'а на следующем render'е. Когда appears RPC — этот
// override-слой убирается + replace'ится server-side patch'ем.
//
// Sergey 2026-05-12: соблюдает offline-first rule — write локальная,
// никуда не отправляется, синхронизация будет позже когда добавим RPC.
const TITLE_OVERRIDE_KEY = 'hone:taskTitleOverride:v1';

export function readTitleOverrides(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(TITLE_OVERRIDE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function writeTitleOverride(taskId: string, title: string): void {
  try {
    const map = readTitleOverrides();
    if (title.trim() && title.trim() !== '') {
      map[taskId] = title.trim();
    } else {
      delete map[taskId];
    }
    window.localStorage.setItem(TITLE_OVERRIDE_KEY, JSON.stringify(map));
  } catch {
    /* localStorage quota / private mode — silently drop */
  }
}

export function relativeAge(iso: string): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const m = Math.floor((Date.now() - t) / 60_000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

import { translate } from '@d9-i18n';

export function pluralArchive(n: number): string {
  if (n === 1) return translate('hone.taskboard.plural.task.one');
  if (n >= 2 && n <= 4) return translate('hone.taskboard.plural.task.few');
  return translate('hone.taskboard.plural.task.many');
}
