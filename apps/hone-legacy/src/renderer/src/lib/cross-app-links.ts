// cross-app-links — open druz9 web surfaces from Hone (Electron shell).
//
// Every URL carries `?source=hone` for attribution analytics.

import { WEB_BASE_URL } from '../api/config';

const druz9WebURL = WEB_BASE_URL;
const SOURCE_TAG = 'hone';

function buildURL(path: string, params?: Record<string, string | undefined>): string {
  const url = new URL(path, druz9WebURL);
  url.searchParams.set('source', SOURCE_TAG);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'string' && v.length > 0) url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

function openExternal(url: string): void {
  const bridge = window.hone;
  if (bridge?.shell) {
    void bridge.shell.openExternal(url).catch(() => {
      /* swallow */
    });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Open druz9 web home / welcome. */
export function openDruz9Web(): void {
  openExternal(buildURL('/welcome'));
}

/** Pricing + checkout (Stripe / Tribute). */
export function openWebBilling(): void {
  openExternal(buildURL('/pricing'));
}

/** Live code room — pair programming in browser. */
export function openWebLiveRoom(opts?: { roomId?: string }): void {
  const path = opts?.roomId ? `/live/${opts.roomId}` : '/live/new';
  openExternal(buildURL(path));
}

/** Cue desktop app download page (legacy ecosystem card). */
export function openCueInstall(): void {
  openExternal(buildURL('/cue/download'));
}
