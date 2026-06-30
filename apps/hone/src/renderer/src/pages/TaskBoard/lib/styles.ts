import type { CSSProperties } from 'react';

export const hdrStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  marginBottom: 24, flexWrap: 'wrap', gap: 12,
};

export const emptyStyle: CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 16,
  color: 'var(--ink-40)', padding: '80px 0',
};

export const emptyIconStyle: CSSProperties = {
  width: 56, height: 56, borderRadius: 14, background: 'var(--surface-2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
};

// kindChipStyle — single source for filter chip styling so active /
// inactive states stay symmetric. B/W rule: active chip uses hairline
// outline + faint background, no fill.
export function kindChipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: '0.04em',
    borderRadius: 6,
    border: `1px solid ${active ? 'var(--ink-40)' : 'var(--ink-tint-08)'}`,
    background: active ? 'rgb(var(--ink-rgb) / 0.045)' : 'transparent',
    color: active ? 'var(--ink)' : 'var(--ink-60)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
  };
}

export const ctxBtnStyle: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
  fontSize: 12, color: 'var(--ink-60)', cursor: 'pointer', borderRadius: 5,
  border: 'none', background: 'none', width: '100%', fontFamily: 'inherit',
  textAlign: 'left',
};
