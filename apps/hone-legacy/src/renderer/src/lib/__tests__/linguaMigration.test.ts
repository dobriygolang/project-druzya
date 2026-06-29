import { describe, it, expect, beforeEach, vi } from 'vitest';

import { STORAGE_KEYS } from '../storage-keys';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(k: string): string | null {
    return this.data.has(k) ? this.data.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }
  removeItem(k: string): void {
    this.data.delete(k);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(i: number): string | null {
    return Array.from(this.data.keys())[i] ?? null;
  }
}

const mem = new MemoryStorage();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  get: () => mem,
});

beforeEach(() => {
  mem.clear();
});

async function load(): Promise<typeof import('../linguaMigration')> {
  vi.resetModules();
  return await import('../linguaMigration');
}

describe('markLinguaMigrationSeen', () => {
  it('writes "1" to lingua_migration_seen key', async () => {
    const { markLinguaMigrationSeen } = await load();
    markLinguaMigrationSeen();
    expect(mem.getItem('lingua_migration_seen')).toBe('1');
  });
});

describe('shouldShowLinguaMigrationModal', () => {
  it('returns false when already dismissed', async () => {
    mem.setItem('lingua_migration_seen', '1');
    mem.setItem(STORAGE_KEYS.profileV2, JSON.stringify({ stack: 'english' }));
    const { shouldShowLinguaMigrationModal } = await load();
    expect(await shouldShowLinguaMigrationModal()).toBe(false);
  });

  it('profileV2 stack=english → true', async () => {
    mem.setItem(STORAGE_KEYS.profileV2, JSON.stringify({ stack: 'english' }));
    const { shouldShowLinguaMigrationModal } = await load();
    expect(await shouldShowLinguaMigrationModal()).toBe(true);
  });

  it('english_ prefixed key → true', async () => {
    mem.setItem('english_vocab_v1', '[]');
    const { shouldShowLinguaMigrationModal } = await load();
    expect(await shouldShowLinguaMigrationModal()).toBe(true);
  });

  it('no signals → false', async () => {
    const { shouldShowLinguaMigrationModal } = await load();
    expect(await shouldShowLinguaMigrationModal()).toBe(false);
  });

  it('after markLinguaMigrationSeen modal is suppressed', async () => {
    mem.setItem('english_vocab_v1', '[]');
    const { shouldShowLinguaMigrationModal, markLinguaMigrationSeen } = await load();
    expect(await shouldShowLinguaMigrationModal()).toBe(true);
    markLinguaMigrationSeen();
    expect(await shouldShowLinguaMigrationModal()).toBe(false);
  });
});
