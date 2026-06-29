import { memo } from 'react';

import { useT } from '@d9-i18n';

import { CanvasBg, type ThemeId } from '../../../components/CanvasBg';
import { labelFor } from '../lib/settings-store';

const previewLayerStyle: React.CSSProperties = { position: 'absolute', inset: 0 };

const fadeStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  padding: '20px 12px 10px',
  background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
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
  const label = labelFor(id);
  const btnStyle: React.CSSProperties = {
    position: 'relative',
    padding: 0,
    height: 120,
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    background: 'var(--bg)',
    border: active ? '1px solid rgb(var(--ink-rgb) / 0.55)' : '1px solid var(--ink-tint-08)',
    boxShadow: active
      ? '0 0 0 3px var(--ink-tint-08), 0 8px 28px -10px rgb(var(--ink-rgb) / 0.18)'
      : '0 4px 14px -8px rgba(0,0,0,0.6)',
    textAlign: 'left',
  };
  const labelTextStyle: React.CSSProperties = {
    fontSize: 10,
    letterSpacing: '0.08em',
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
        <div style={fadeStyle}>
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
