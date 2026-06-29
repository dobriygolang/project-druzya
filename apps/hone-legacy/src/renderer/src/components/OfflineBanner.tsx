// OfflineBanner — top-of-screen полоска. 5-state taxonomy:
//
//   1. online                — banner null (hidden)
//   2. network_offline       — navigator.onLine === false. Red stripe
//                              «Нет сети, изменения в outbox».
//   3. server_unreachable    — network on, но /healthz probe failed.
//                              Yellow stripe «Сервер недоступен, retry в 30s».
//   4. degraded              — health probe slow (>2.5s) или 5xx-ratio
//                              elevated. Info stripe «Бэкенд медленный».
//   5. reconnecting          — recovering из offline/unreachable: первый
//                              successful probe после failed → 3s window
//                              «Восстанавливаем» с pulse dot.
//
// Plus two derived states ortogonal состоянию connection: pending outbox
// (drain ongoing) и dead ops (manual retry).
//
// Server probe — HEAD on billing gateway (401 = reachable).
import { memo, useCallback, useEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { zIndex } from '../lib/z-index';
import { drainAll, listAll, listPending, subscribe } from '../offline/outbox';
import { API_BASE_URL } from '../api/config';

type ServerState = 'unknown' | 'ok' | 'degraded' | 'unreachable';

const PROBE_OK_BUDGET_MS = 2500;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 15_000;
const OUTBOX_POLL_INTERVAL_MS = 5000;
const RECOVERY_WINDOW_MS = 3000;

async function probeServer(signal: AbortSignal): Promise<{ state: ServerState; latency: number }> {
  const started = performance.now();
  // Local abort linked to caller's signal — caller cancels = fetch aborts.
  const localCtl = new AbortController();
  const onParentAbort = () => localCtl.abort();
  signal.addEventListener('abort', onParentAbort);
  const timer = window.setTimeout(() => localCtl.abort(), PROBE_TIMEOUT_MS);
  try {
    // Любой 2xx/3xx/4xx — server отвечает. 401 OK для нашей цели.
    const resp = await fetch(`${API_BASE_URL}/v1/billing/me`, {
      method: 'HEAD',
      signal: localCtl.signal,
    });
    const latency = performance.now() - started;
    // 5xx → degraded; иначе ok / slow → degraded.
    if (resp.status >= 500) return { state: 'degraded', latency };
    return { state: latency > PROBE_OK_BUDGET_MS ? 'degraded' : 'ok', latency };
  } catch {
    return { state: 'unreachable', latency: performance.now() - started };
  } finally {
    window.clearTimeout(timer);
    signal.removeEventListener('abort', onParentAbort);
  }
}

export const OfflineBanner = memo(function OfflineBanner() {
  const t = useT();
  const online = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [deadCount, setDeadCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [serverState, setServerState] = useState<ServerState>('unknown');
  const [recovered, setRecovered] = useState<number | null>(null);
  const pendingCountRef = useRef(0);
  const deadCountRef = useRef(0);
  pendingCountRef.current = pendingCount;
  deadCountRef.current = deadCount;
  const prevServerStateRef = useRef<ServerState>('unknown');

  // Outbox poll loop.
  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void Promise.all([listPending(), listAll()])
        .then(([pending, all]) => {
          if (cancelled) return;
          setPendingCount(pending.length);
          setDeadCount(all.filter((op) => op.dead).length);
        })
        .catch(() => {
          // Outbox IDB unavailable (private mode / first-mount race) —
          // badge просто остаётся stale, не блокируем UI.
        });
    };
    refresh();
    const unsub = subscribe(() => {
      setLastSyncAt(Date.now());
      refresh();
    });
    const pollId = window.setInterval(() => {
      const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (isOnline && pendingCountRef.current === 0 && deadCountRef.current === 0) return;
      refresh();
    }, OUTBOX_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      unsub();
      window.clearInterval(pollId);
    };
  }, []);

  // Server-probe loop. Only runs when navigator says we're online — when
  // offline, network is the diagnosed root cause, no need to probe.
  useEffect(() => {
    if (!online) {
      setServerState('unknown');
      return;
    }
    const ctl = new AbortController();
    const tick = async () => {
      const r = await probeServer(ctl.signal);
      if (ctl.signal.aborted) return;
      // Detect recovery: was unreachable/degraded, now ok.
      const prev = prevServerStateRef.current;
      if (r.state === 'ok' && (prev === 'unreachable' || prev === 'degraded')) {
        setRecovered(Date.now());
      }
      prevServerStateRef.current = r.state;
      setServerState(r.state);
    };
    void tick();
    const id = window.setInterval(() => void tick(), PROBE_INTERVAL_MS);
    return () => {
      ctl.abort();
      window.clearInterval(id);
    };
  }, [online]);

  const manualRetry = useCallback(() => {
    void drainAll();
  }, []);

  // ── State machine ────────────────────────────────────────────────────
  // Priority: dead-ops > network_offline > server_unreachable > degraded
  // > reconnecting > syncing > just-synced > null.

  if (deadCount > 0) {
    return (
      <BannerStrip tone="danger" interactive>
        <span>⚠ {deadCount} change{deadCount === 1 ? '' : 's'} stuck</span>
        <button type="button" onClick={manualRetry} style={retryBtn}>retry</button>
      </BannerStrip>
    );
  }
  if (!online) {
    return (
      <BannerStrip tone="danger">
        {t('hone.offline.banner_no_network')} ·{' '}
        {pendingCount > 0
          ? t('hone.offline.banner_changes_count', { n: pendingCount })
          : t('hone.offline.banner_changes_pending')}
      </BannerStrip>
    );
  }
  if (serverState === 'unreachable') {
    return (
      <BannerStrip tone="warn">
        {t('hone.offline.banner_server_unreachable')}
      </BannerStrip>
    );
  }
  if (serverState === 'degraded') {
    return (
      <BannerStrip tone="ink-dim">
        {t('hone.offline.banner_backend_slow')}
      </BannerStrip>
    );
  }
  if (recovered !== null && Date.now() - recovered < RECOVERY_WINDOW_MS) {
    return (
      <BannerStrip tone="ink" pulse>
        {t('hone.offline.banner_recovering')}
      </BannerStrip>
    );
  }
  if (pendingCount > 0) {
    return (
      <BannerStrip tone="ink">
        ⟳ Syncing {pendingCount} change{pendingCount === 1 ? '' : 's'}…
      </BannerStrip>
    );
  }
  if (lastSyncAt !== null && Date.now() - lastSyncAt < RECOVERY_WINDOW_MS) {
    return (
      <BannerStrip tone="ink-dim">
        ✓ Synced
      </BannerStrip>
    );
  }
  return null;
});

const retryBtn: React.CSSProperties = {
  marginLeft: 10,
  padding: '2px 10px',
  background: 'rgb(var(--ink-rgb) / 0.18)',
  border: '1px solid rgb(var(--ink-rgb) / 0.30)',
  color: '#FFFFFF',
  borderRadius: 3,
  fontSize: 10,
  fontFamily: 'inherit',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  pointerEvents: 'auto',
};

type BannerTone = 'muted' | 'ink' | 'ink-dim' | 'warn' | 'danger';

// Tones: B/W ink ramp по умолчанию; danger использует #FF3B30 как stripe-
// карту (top edge), warn — yellow accent но через ink-ramp с border.
const TONE_BG: Record<BannerTone, string> = {
  muted: 'rgb(var(--ink-rgb) / 0.10)',
  ink: 'var(--ink-tint-16)',
  'ink-dim': 'var(--ink-tint-08)',
  warn: 'var(--ink-tint-12)',
  danger: '#FF3B30',
};

const BANNER_BASE_STYLE: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  padding: '6px 12px',
  textAlign: 'center',
  fontSize: 10.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink)',
  borderBottom: '1px solid rgb(var(--ink-rgb) / 0.10)',
  zIndex: zIndex.toast,
  animationDuration: 'var(--motion-dur-medium)',
};

const BannerStrip = memo(function BannerStrip({
  tone,
  children,
  interactive = false,
  pulse = false,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  interactive?: boolean;
  pulse?: boolean;
}) {
  // Warn = ink-toned stripe + 1.5px red top border (red as stripe, not bg —
  // см feedback_color_rule.md).
  const isWarn = tone === 'warn';
  return (
    <div
      className={`fadein mono${pulse ? ' red-pulse' : ''}`}
      role={tone === 'danger' ? 'alert' : 'status'}
      aria-live={tone === 'danger' ? 'assertive' : 'polite'}
      aria-atomic="true"
      style={{
        ...BANNER_BASE_STYLE,
        background: TONE_BG[tone],
        backdropFilter: tone === 'danger' ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: tone === 'danger' ? 'none' : 'blur(8px)',
        borderTop: isWarn ? '1.5px solid #FF3B30' : 'none',
        pointerEvents: interactive ? 'auto' : 'none',
      }}
    >
      {children}
    </div>
  );
});
