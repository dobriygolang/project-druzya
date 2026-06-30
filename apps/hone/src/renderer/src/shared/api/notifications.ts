// notifications.ts — система-нативные уведомления для Hone.
//
// Используется через `notify(title, body)`. Внутри:
//   1. Проверяем `settings.notifications` (юзер мог отключить в Settings).
//   2. Если permission ещё не запрашивался — `requestPermission()`.
//   3. Если granted — `new Notification(...)` (нативный OS-popup на macOS
//      / Windows / Linux). Electron renderer наследует Chromium API,
//      работает out of the box.
//
// До этой утилиты `settings.notifications` toggle был чисто декоративным —
// нигде не читался. Теперь focus auto-end (см. App.tsx finishSession)
// вызывает `notify('Focus session complete', ...)`.

import { STORAGE_KEYS } from '@shared/lib/storage-keys';

const SETTINGS_KEY: string = STORAGE_KEYS.settings;

interface StoredSettings {
  notifications?: boolean;
}

function isNotificationsEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return true; // default ON
    const parsed = JSON.parse(raw) as StoredSettings;
    return typeof parsed.notifications === 'boolean' ? parsed.notifications : true;
  } catch {
    return true;
  }
}

let permissionPromise: Promise<NotificationPermission> | null = null;

async function ensurePermission(): Promise<NotificationPermission> {
  if (typeof Notification === 'undefined') return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  // Single-flight: не дёргаем requestPermission несколько раз параллельно.
  if (!permissionPromise) {
    permissionPromise = Notification.requestPermission();
  }
  return permissionPromise;
}

/**
 * notify — native OS notification. Best-effort: silently no-op'ит если
 * настройка отключена / permission denied / API недоступно. Не throws.
 */
export async function notify(title: string, body?: string): Promise<void> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (!isNotificationsEnabled()) return;
  try {
    const perm = await ensurePermission();
    if (perm !== 'granted') return;
    new Notification(title, { body, silent: false });
  } catch {
    /* native notification fail — degraded UX, не валим caller */
  }
}
