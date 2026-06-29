// LinguaMigrationModal — one-time cue для существующих Hone-юзеров после
// Поведение:
//   - Mount на boot после auth-gate (App.tsx).
//   - shouldShowLinguaMigrationModal() — async heuristic; см
//     lib/linguaMigration.ts. Решает true/false на основе englishActive +
//     legacy onboarding stack + localStorage footprint.
//   - Primary CTA «Перейти в Lingua» открывает https://druz9.online/lingua
//     через window.hone.shell.openExternal (whitelisted в main).
//   - Secondary CTA «Понял, закрой» ставит флаг `lingua_migration_seen=1`
//     и закрывает; модалка больше не появится на этом устройстве.
//
// Стиль: B/W only. Никакого #FF3B30. Responsive — works в narrow Hone
// (min 960px), сам modal — max-width 420px.

import { useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  markLinguaMigrationSeen,
  shouldShowLinguaMigrationModal,
} from '../lib/linguaMigration';
import { zIndex } from '../lib/z-index';

const LINGUA_URL = 'https://druz9.online/lingua';

interface Props {
  /** Optional override for tests / Storybook. По умолчанию async-probe. */
  forceOpen?: boolean;
}

export function LinguaMigrationModal({ forceOpen }: Props) {
  const t = useT();
  const [open, setOpen] = useState<boolean>(Boolean(forceOpen));

  useEffect(() => {
    if (forceOpen) {
      setOpen(true);
      return;
    }
    let cancelled = false;
    void shouldShowLinguaMigrationModal().then((should) => {
      if (!cancelled && should) setOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, [forceOpen]);

  if (!open) return null;

  const close = (): void => {
    markLinguaMigrationSeen();
    setOpen(false);
  };

  const goLingua = (): void => {
    // openExternal — whitelisted (http/https only) в src/main/index.ts.
    const bridge = typeof window !== 'undefined' ? window.hone : undefined;
    if (bridge?.shell?.openExternal) {
      void bridge.shell.openExternal(LINGUA_URL);
    } else {
      // Renderer без preload (storybook / web-port) — fallback на window.open.
      try {
        window.open(LINGUA_URL, '_blank', 'noopener,noreferrer');
      } catch {
        /* ignore — модалка всё равно закроется */
      }
    }
    // Mark seen — юзер сделал явный choice; не нужно nudge'ить снова.
    close();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lingua-migration-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        zIndex: zIndex.modal,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={(e) => {
        // Click за пределами card — НЕ закрываем, чтобы юзер не пропустил
        // через accident. Только явные кнопки.
        e.stopPropagation();
      }}
    >
      <div
        className="bg-surface-1 border border-strong text-text-primary"
        style={{
          maxWidth: 420,
          width: '100%',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6)',
        }}
      >
        <h2
          id="lingua-migration-title"
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          {t('hone.lingua.title')}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            opacity: 0.85,
          }}
        >
          {t('hone.lingua.body')}
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            gap: 8,
            flexWrap: 'wrap',
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={goLingua}
            className="border border-strong text-text-primary"
            style={{
              flex: '1 1 180px',
              minWidth: 0,
              padding: '10px 16px',
              borderRadius: 8,
              background: 'transparent',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background var(--motion-dur-micro) var(--motion-ease-standard)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {t('hone.lingua.cta.open')}
          </button>
          <button
            type="button"
            onClick={close}
            className="text-text-primary"
            style={{
              flex: '1 1 120px',
              minWidth: 0,
              padding: '10px 16px',
              borderRadius: 8,
              background: 'transparent',
              border: '1px solid transparent',
              fontSize: 14,
              fontWeight: 400,
              opacity: 0.7,
              cursor: 'pointer',
              transition: 'opacity var(--motion-dur-micro) var(--motion-ease-standard)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '0.7';
            }}
          >
            {t('hone.lingua.cta.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
