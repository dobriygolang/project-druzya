import { memo, useCallback, useEffect, useState } from 'react';

import { useT } from '@d9-i18n';

import {
  getStorageQuota,
  tierLabel,
  archiveOldestNotes,
  type StorageQuota,
} from '../../../api/storage';

// StorageSection — cloud notes quota from billing + notes service.
const erroredStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-60)' };
const loadingStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-40)' };

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  marginBottom: 8,
};

const usedTextStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-90)' };
const quotaTextStyle: React.CSSProperties = { color: 'var(--ink-40)' };

const tierBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.08em',
  padding: '3px 8px',
  borderRadius: 999,
  border: '1px solid var(--ink-20)',
  color: 'var(--ink-60)',
};

const barWrapStyle: React.CSSProperties = {
  height: 6,
  borderRadius: 3,
  background: 'var(--ink-10)',
  overflow: 'hidden',
};

const upgradeBtnStyle: React.CSSProperties = {
  marginTop: 14,
  width: '100%',
  padding: '12px 14px',
  borderRadius: 10,
  border: '1px solid var(--ink-10)',
  background: 'var(--surface)',
  textAlign: 'left',
  color: 'inherit',
  cursor: 'pointer',
  font: 'inherit',
  transition:
    'border-color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
};

const upgradeHeadStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: 8,
  marginBottom: 4,
  flexWrap: 'wrap',
};

const upgradeTitleStyle: React.CSSProperties = { fontSize: 13, color: 'var(--ink-90)' };
const upgradeLinkStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-40)' };
const upgradeBodyStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ink-60)',
  lineHeight: 1.45,
};

function handleUpgradeEnter(e: React.MouseEvent<HTMLButtonElement>): void {
  e.currentTarget.style.borderColor = 'var(--ink-20)';
}

function handleUpgradeLeave(e: React.MouseEvent<HTMLButtonElement>): void {
  e.currentTarget.style.borderColor = 'var(--ink-10)';
}

function openUpgradeModal(): void {
  void import('../../../components/UpgradeModal').then(({ requestUpgrade }) => {
    requestUpgrade({
      feature: 'cross_device_sync',
      label: 'cross-device sync',
      benefit: 'Pro syncs notes across devices with a higher cloud note limit.',
    });
  });
}

export function StorageSection() {
  const t = useT();
  const [data, setData] = useState<StorageQuota | null>(null);
  const [errored, setErrored] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    setData(null);
    setErrored(false);
    void getStorageQuota()
      .then((q) => {
        if (live) setData(q);
      })
      .catch(() => {
        if (live) setErrored(true);
      });
    return () => {
      live = false;
    };
  }, [tick]);

  const onArchiveDone = useCallback(() => setTick((t) => t + 1), []);

  if (errored) {
    return <div style={erroredStyle}>{t('hone.settings.storage.unavailable')}</div>;
  }
  if (!data) {
    return <div style={loadingStyle}>{t('common.loading')}</div>;
  }

  const pct =
    data.limitNotes != null && data.limitNotes > 0
      ? Math.min(100, (data.usedNotes / data.limitNotes) * 100)
      : data.usedNotes > 0
        ? 8
        : 0;
  const overSoft = data.limitNotes != null && pct >= 80;
  const limitLabel = data.limitNotes == null ? '∞' : String(data.limitNotes);

  const barFillStyle: React.CSSProperties = {
    width: `${pct}%`,
    height: '100%',
    background: overSoft ? 'rgba(255,140,90,0.85)' : 'var(--ink-90)',
    transition:
      'width var(--motion-dur-medium) var(--motion-ease-standard), background-color var(--motion-dur-medium) var(--motion-ease-standard)',
  };

  return (
    <div>
      <div style={headerStyle}>
        <span style={usedTextStyle}>
          {data.usedNotes}{' '}
          <span style={quotaTextStyle}>/ {limitLabel} cloud notes</span>
        </span>
        <span className="mono" style={tierBadgeStyle}>
          {tierLabel(data.tier).toUpperCase()}
        </span>
      </div>
      <div style={barWrapStyle}>
        <div style={barFillStyle} />
      </div>
      {/* Archive control — особенно полезно при overSoft. Не блокируем
          при ниже-cap'е: юзер может профилактически чистить старое. */}
      <ArchiveControl onDone={onArchiveDone} />
      {data.tier === 'free' && (
        <button
          type="button"
          onClick={openUpgradeModal}
          className="focus-ring"
          style={upgradeBtnStyle}
          onMouseEnter={handleUpgradeEnter}
          onMouseLeave={handleUpgradeLeave}
        >
          <div style={upgradeHeadStyle}>
            <span style={upgradeTitleStyle}>Sync across devices · Pro</span>
            <span style={upgradeLinkStyle}>See plans →</span>
          </div>
          <div style={upgradeBodyStyle}>
            Free tier keeps a limited number of cloud-synced notes. Upgrade to Pro for more.
          </div>
        </button>
      )}
    </div>
  );
}

const archiveWrapStyle: React.CSSProperties = {
  marginTop: 14,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const archiveMsgStyle: React.CSSProperties = { fontSize: 12, color: 'var(--ink-60)' };

// Archive ≠ delete (recoverable). Без подтверждения сразу — UX-friendly;
// если юзер кликнул случайно, восстановит через Notes.
const ArchiveControl = memo(function ArchiveControl({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setBusy(true);
    setMsg(null);
    try {
      const n = await archiveOldestNotes(10);
      setMsg(n === 0 ? 'No active notes to archive.' : `Archived ${n} note${n === 1 ? '' : 's'}.`);
      onDone();
    } catch {
      setMsg('Archive failed — try again.');
    } finally {
      setBusy(false);
    }
  }, [onDone]);

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 12.5,
    background: 'transparent',
    border: '1px solid var(--ink-20)',
    borderRadius: 8,
    color: 'var(--ink-90)',
    cursor: busy ? 'default' : 'pointer',
    opacity: busy ? 0.5 : 1,
    transition:
      'opacity var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
  };

  return (
    <div style={archiveWrapStyle}>
      <button type="button" onClick={onClick} disabled={busy} className="focus-ring" style={btnStyle}>
        {busy ? 'Archiving…' : 'Archive 10 oldest notes'}
      </button>
      {msg ? <span style={archiveMsgStyle}>{msg}</span> : null}
    </div>
  );
});
