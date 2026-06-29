// linguaMigration.ts — one-time migration cue for existing English users.
//
// «Hone = doing, web = learning, Cue = performing». English vertical was a
// non-trivial 5-page surface inside Hone (EnglishOverview / Reading / Writing
// English flow to web `druz9.online/lingua`. Existing Hone users who toggled
// englishActive=true expect their reading/writing workflow to still work;
// without an in-app cue they would see a missing tab and assume regression.
//
// This module decides whether to surface LinguaMigrationModal on a given
// renderer boot. Predicate is intentionally permissive — false positives
// (showing the modal to users who never touched English) are cheaper than
// false negatives (English user lost without a redirect). The localStorage
// dismissal flag ensures it fires at most once per device.

import { STORAGE_KEYS } from './storage-keys';

const SEEN_KEY = 'lingua_migration_seen';

/** Marks the modal as dismissed. Surfaced from the modal's secondary CTA. */
export function markLinguaMigrationSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode / quota — silent; worst case modal re-shows next boot */
  }
}

function isAlreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Heuristic: did this Hone install ever use English content?
 *
 * We look at three signals (any positive → modal is relevant):
 *   1. Backend `englishActive` (the authoritative settings flag).
 *   2. Legacy `hone:profile:v2.stack === 'english'` (onboarding stack the
 *      user picked — survives even if backend settings haven't been
 *      hydrated yet on first boot after Wave 8 strip).
 *   3. Any English-* localStorage key Hone wrote in past versions
 *      (vocabulary cache, reading state, writing drafts).
 *
 * Network error → fall back to localStorage signals only. We never throw.
 */
async function hadEnglishFootprint(): Promise<boolean> {
  // Cheap synchronous signals first — avoid a network call on plain users.
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.profileV2);
    if (raw) {
      const parsed = JSON.parse(raw) as { stack?: string };
      if (parsed?.stack === 'english') return true;
    }
  } catch {
    /* parse error — fall through */
  }
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('english_') || k.startsWith('hone:english:'))) {
        return true;
      }
    }
  } catch {
    /* ignore */
  }
  // Backend probe removed — english vertical retired from Hone.
  return false;
}

/**
 * Top-level gate. Returns true iff:
 *   - modal hasn't been dismissed on this device, AND
 *   - there's evidence this user cared about Hone English.
 *
 * Never throws — callers can `void` this and trust a boolean.
 */
export async function shouldShowLinguaMigrationModal(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isAlreadySeen()) return false;
  return await hadEnglishFootprint();
}
