// Lifecycle:
//   - On app start (App.tsx mount): ensureDevice() — checks localStorage for
//     hone:device-id; if missing, calls registerDevice(); persists returned id.
//   - All authenticated calls (Connect-RPC + bare-fetch) include
//     X-Device-ID header — see transport.ts (interceptor) and storage.ts
//     (authHeaders()).
//   - When backend returns 401 device_revoked → clearDevice() + auth wipe →
//     route to LoginScreen.
//
// device id хранится в localStorage `hone:device-id`. Это не секрет — его
// stealing без bearer-token'а ничего не даёт. Ключ от чужого юзера: чужой
// уже подписан другим bearer'ом, наш device id для него не знакомый, и
// возвращается 401 device_revoked.

import { STORAGE_KEYS } from '../lib/storage-keys';
import { registerDevice, type Device, type DevicePlatform, DeviceLimitError } from './storage';

const DEVICE_ID_KEY: string = STORAGE_KEYS.deviceId;

let cached: string | null = null;

/** Read the persisted device id, или null если ещё не зарегистрирован. */
export function getDeviceId(): string | null {
  if (cached) return cached;
  try {
    cached = window.localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    cached = null;
  }
  return cached;
}

export function setDeviceId(id: string): void {
  cached = id;
  try {
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {
    /* private browsing / quota — heartbeat не сработает, но app работает */
  }
}

export function clearDeviceId(): void {
  cached = null;
  try {
    window.localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * ensureDevice — idempotent: если device-id уже есть, ничего не делает.
 * Иначе вызывает registerDevice с auto-derived именем и платформой.
 *
 * Errors:
 *   - DeviceLimitError (Free user, 1 device cap reached) — bubble up to
 *     App.tsx чтобы показать «Replace device» dialog.
 *   - Other errors (network, 5xx) — silently ignore: device-bootstrap
 *     не должен ломать запуск приложения. Sync feature просто не
 *     активируется до следующего запуска.
 */
export async function ensureDevice(opts: {
  appVersion: string;
  /** Опциональное имя — иначе берётся navigator.userAgent-derived. */
  name?: string;
}): Promise<Device | null> {
  if (getDeviceId()) return null; // already bootstrapped

  const platform = detectPlatform();
  const name = opts.name ?? defaultDeviceName(platform);
  try {
    const device = await registerDevice({
      name,
      platform,
      appVersion: opts.appVersion,
    });
    setDeviceId(device.id);
    return device;
  } catch (err) {
    if (err instanceof DeviceLimitError) throw err; // caller handles
    // eslint-disable-next-line no-console
    console.warn('device.ensureDevice failed', err);
    return null;
  }
}

function detectPlatform(): DevicePlatform {
  if (typeof navigator === 'undefined') return 'mac';
  const p = (navigator.platform ?? '').toLowerCase();
  const ua = (navigator.userAgent ?? '').toLowerCase();
  if (p.includes('mac') || ua.includes('mac os')) return 'mac';
  if (p.includes('win') || ua.includes('windows')) return 'windows';
  if (p.includes('linux') || ua.includes('linux')) return 'linux';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('android')) return 'android';
  return 'web';
}

function defaultDeviceName(platform: DevicePlatform): string {
  switch (platform) {
    case 'mac':
      return 'Mac · Hone';
    case 'windows':
      return 'Windows · Hone';
    case 'linux':
      return 'Linux · Hone';
    case 'ios':
      return 'iPhone · Hone';
    case 'android':
      return 'Android · Hone';
    default:
      return 'Browser · Hone';
  }
}
