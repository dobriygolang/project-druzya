// wire.ts — outbox executors for focus session flush (offline replay).

import { registerExecutor } from './outbox';
import { endFocusSession } from '../api/focusClient';

export function wireOutboxExecutors(): void {
  registerExecutor('focus.end', async (payload) => {
    const p = payload as {
      sessionId: string;
      pomodorosCompleted: number;
      secondsFocused: number;
      reflection?: string;
    };
    await endFocusSession(p);
  });

  // focus.reflection — local-only for now; focus service stores end payload.
  registerExecutor('focus.reflection', async () => {
    /* no-op until reflection RPC lands on focus service */
  });
}
