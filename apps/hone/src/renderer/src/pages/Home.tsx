// Home — landing page with optional pinned task + large timer while running.
import { memo } from 'react';

import { useT } from '@d9-i18n';

interface HomePageProps {
  running: boolean;
  remain: number;
  pinnedTitle: string | null;
  onStop: () => void;
}

function homeArePropsEqual(a: HomePageProps, b: HomePageProps): boolean {
  if (a.running !== b.running) return false;
  if (a.pinnedTitle !== b.pinnedTitle) return false;
  if (a.onStop !== b.onStop) return false;
  if (!a.running && !b.running) return true;
  return a.remain === b.remain;
}

const captionMono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

export const HomePage = memo(HomePageImpl, homeArePropsEqual);

function HomePageImpl({ running, remain, pinnedTitle, onStop }: HomePageProps) {
  const t = useT();
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');

  return (
    <>
      {pinnedTitle && (running || remain < 25 * 60) && (
        <div
          className="motion-page-in"
          style={{
            ...captionMono,
            position: 'absolute',
            top: 100,
            left: 0,
            right: 0,
            textAlign: 'center',
            display: 'inline-flex',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <span>{t('hone.home.working_on')}</span>
          <span style={{ color: 'var(--ink-60)' }}>{pinnedTitle}</span>
        </div>
      )}

      {running && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 72,
              fontWeight: 300,
              letterSpacing: '-0.04em',
              color: 'var(--ink-80)',
              lineHeight: 1,
            }}
          >
            {mm}:{ss}
          </div>
        </div>
      )}

      {running && (
        <button
          type="button"
          onClick={onStop}
          className="focus-ring fadein"
          style={{
            position: 'absolute',
            bottom: 120,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--ink-tint-12)',
            background: 'rgb(var(--ink-rgb) / 0.04)',
            color: 'var(--ink-60)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          {t('hone.home.stop_focus')}
        </button>
      )}
    </>
  );
}
