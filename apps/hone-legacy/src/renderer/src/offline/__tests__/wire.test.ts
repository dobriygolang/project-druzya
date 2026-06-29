import { describe, it, expect, vi } from 'vitest';

vi.mock('../../api/focusClient', () => ({
  endFocusSession: vi.fn().mockResolvedValue({ sessionId: 's1' }),
}));

describe('wireOutboxExecutors', () => {
  it('registers without throwing', async () => {
    const { wireOutboxExecutors } = await import('../wire');
    expect(() => wireOutboxExecutors()).not.toThrow();
  });
});
