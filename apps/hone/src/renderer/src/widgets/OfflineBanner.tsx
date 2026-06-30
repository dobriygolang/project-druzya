// Network + sync status banner — informative, non-blocking.
import { memo, useEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import { LOCAL_ONLY } from '@app/config/features';
import { useOnlineStatus } from '@shared/hooks/useOnlineStatus';
import { zIndex } from '@shared/lib/z-index';
import { HEALTH_CHECK_URL } from '@shared/api/config';
import { apiFetch } from '@shared/api/http';
import { useSyncStore } from '@shared/model/sync';
import { flushSync } from '@shared/sync/SyncEngine';

type ServerState = 'unknown' | 'ok' | 'degraded' | 'unreachable';

const PROBE_OK_BUDGET_MS = 2500;
const PROBE_TIMEOUT_MS = 5000;
const PROBE_INTERVAL_MS = 15_000;
const RECOVERY_WINDOW_MS = 3000;

async function probeServer(signal: AbortSignal): Promise<{ state: ServerState; latency: number }> {
  const started = performance.now();
  const localCtl = new AbortController();
  const onParentAbort = () => localCtl.abort();
  signal.addEventListener('abort', onParentAbort);
  const timer = window.setTimeout(() => localCtl.abort(), PROBE_TIMEOUT_MS);
  try {
    const resp = await apiFetch(HEALTH_CHECK_URL, {
      method: 'HEAD',
      signal: localCtl.signal,
    });
    const latency = performance.now() - started;
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
  const syncEnabled = !LOCAL_ONLY;
  const syncStatus = useSyncStore((s) => s.status);
  const serverReachable = useSyncStore((s) => s.serverReachable);
  const [serverState, setServerState] = useState<ServerState>('unknown');
  const [recovered, setRecovered] = useState<number | null>(null);
  const prevServerStateRef = useRef<ServerState>('unknown');

  useEffect(() => {
    if (!online || syncEnabled) {
      setServerState('unknown');
      return;
    }
    const ctl = new AbortController();
    const tick = async () => {
      const r = await probeServer(ctl.signal);
      if (ctl.signal.aborted) return;
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
  }, [online, syncEnabled]);

  if (!online) {
    return (
      <BannerStrip tone="danger">
        {t('hone.sync.banner_offline')}
      </BannerStrip>
    );
  }

  if (syncEnabled) {
    if (syncStatus === 'error') {
      return (
        <BannerStrip tone="warn" onRetry={() => flushSync()}>
          {t('hone.sync.banner_error')}
        </BannerStrip>
      );
    }
    if (!serverReachable) {
      return (
        <BannerStrip tone="warn">
          {t('hone.sync.banner_unreachable')}
        </BannerStrip>
      );
    }
    if (recovered !== null && Date.now() - recovered < RECOVERY_WINDOW_MS) {
      return (
        <BannerStrip tone="ink" pulse>
          {t('hone.sync.banner_recovering')}
        </BannerStrip>
      );
    }
    return null;
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
  return null;
});

type BannerTone = 'muted' | 'ink' | 'ink-dim' | 'warn' | 'danger';

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
  pulse = false,
  onRetry,
}: {
  tone: BannerTone;
  children: React.ReactNode;
  pulse?: boolean;
  onRetry?: () => void;
}) {
  const t = useT();
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
        pointerEvents: onRetry ? 'auto' : 'none',
      }}
    >
      {children}
      {onRetry && (
        <>
          {' · '}
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              font: 'inherit',
              letterSpacing: 'inherit',
              textTransform: 'inherit',
              padding: 0,
              textDecoration: 'underline',
            }}
          >
            {t('hone.sync.retry')}
          </button>
        </>
      )}
    </div>
  );
});
