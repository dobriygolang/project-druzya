import { memo } from 'react';

import { useT } from '@d9-i18n';

import { CanvasBg, type ThemeId } from '@widgets/CanvasBg';
import { themeLabelKey } from '@pages/Settings/lib/settings-store';

const previewLayerStyle: React.CSSProperties = { position: 'absolute', inset: 0 };

const fadeStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const activeBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.08em',
  color: 'var(--ink)',
  padding: '2px 6px',
  borderRadius: 4,
  background: 'var(--ink-tint-12)',
};

export const ThemeCard = memo(function ThemeCard({
  id,
  active,
  onPick,
}: {
  id: ThemeId;
  active: boolean;
  onPick: () => void;
}) {
  const t = useT();
  const label = t(themeLabelKey(id));
  const btnStyle: React.CSSProperties = {
    position: 'relative',
    padding: 0,
    height: 96,
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'var(--theme-card-bg)',
    border: active
      ? '1px solid var(--theme-card-border-active)'
      : '1px solid var(--theme-card-border)',
    boxShadow: active ? 'var(--theme-card-shadow-active)' : 'var(--theme-card-shadow)',
    textAlign: 'left',
  };
  const labelTextStyle: React.CSSProperties = {
    fontSize: 9,
    letterSpacing: '0.06em',
    color: active ? 'var(--ink)' : 'var(--ink-60)',
    textTransform: 'uppercase',
  };
  return (
    <button
      onClick={onPick}
      role="radio"
      aria-checked={active}
      aria-pressed={active}
      aria-label={t('hone.theme.aria_label', { name: label })}
      className="surface lift"
      style={btnStyle}
    >
      <div style={previewLayerStyle}>
        {/* Live mini-preview — one pass through CanvasBg, scaled down via container */}
        <div style={previewLayerStyle}>
          <CanvasBg theme={id} mode="full" />
        </div>
        {/* Bottom-fade label */}
        <div className="hone-theme-card__fade" style={fadeStyle}>
          <span className="mono" style={labelTextStyle}>
            {label}
          </span>
          {active && (
            <span className="mono" style={activeBadgeStyle}>
              {t('hone.theme.active_badge')}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});
