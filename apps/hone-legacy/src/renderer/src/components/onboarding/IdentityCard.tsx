// IdentityCard — single column в 3-pane ecosystem comparison. Используется
// в IdentityIntroModal (first-run) и Settings → Ecosystem section.
//
// Iconography — monochrome SVG inline, 1.5px stroke, currentColor.
// B/W only design rule из CLAUDE.md.
//
// Copy moved to i18n: taglineRu/En + features are translation keys looked
// up at render time so the card swaps language when locale changes.

import { memo, type CSSProperties } from 'react';

import { useT, type Dict } from '@d9-i18n';

export type ProductKey = 'hone' | 'web' | 'cue';

export interface ProductInfo {
  key: ProductKey;
  /** Short display name. Lowercase / casual — matches Hone copy voice. */
  name: string;
  /** i18n key for RU one-liner (primary positioning sentence). */
  taglineRuKey: keyof Dict;
  /** i18n key for EN one-liner (secondary descriptor). */
  taglineEnKey: keyof Dict;
  /** i18n keys for feature pills — 4-5 short keywords. */
  featureKeys: ReadonlyArray<keyof Dict>;
  /** Whether this is the current process — "you are here" indicator. */
  current?: boolean;
  /** CTA button i18n key. Omit для current product = no CTA. */
  ctaLabelKey?: keyof Dict;
  /** Click handler — обычно открывает cross-app link. */
  onCta?: () => void;
}

/**
 * Source-of-truth для positioning copy. Импортируется обоими: модалью и
 * Settings ecosystem section. Strings живут в i18n под `hone.identity.*`.
 */
export const PRODUCTS: Record<ProductKey, Omit<ProductInfo, 'current' | 'onCta'>> = {
  hone: {
    key: 'hone',
    name: 'Hone',
    taglineRuKey: 'hone.identity.hone.tagline_ru',
    taglineEnKey: 'hone.identity.hone.tagline_en',
    featureKeys: [
      'hone.identity.hone.feature.notes',
      'hone.identity.hone.feature.taskboard',
      'hone.identity.hone.feature.pomodoro',
      'hone.identity.hone.feature.schedule',
    ],
  },
  web: {
    key: 'web',
    name: 'druz9.online',
    taglineRuKey: 'hone.identity.web.tagline_ru',
    taglineEnKey: 'hone.identity.web.tagline_en',
    featureKeys: [
      'hone.identity.web.feature.live',
      'hone.identity.web.feature.billing',
      'hone.identity.web.feature.profile',
    ],
    ctaLabelKey: 'hone.identity.web.cta',
  },
  cue: {
    key: 'cue',
    name: 'Cue',
    taglineRuKey: 'hone.identity.cue.tagline_ru',
    taglineEnKey: 'hone.identity.cue.tagline_en',
    featureKeys: [
      'hone.identity.cue.feature.invisible',
      'hone.identity.cue.feature.transcript',
      'hone.identity.cue.feature.hints',
      'hone.identity.cue.feature.prep',
    ],
    ctaLabelKey: 'hone.identity.cue.cta',
  },
};

// ── icons ───────────────────────────────────────────────────────────────
// Monochrome 1.5px stroke SVGs, currentColor. 32×32 viewBox чтобы у glyph'а
// был воздух — visually rectangular icons выглядят кривовато при 24×24.

const HoneIcon = memo(function HoneIcon({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="16" cy="16" r="11" />
      <circle cx="16" cy="16" r="6" />
      <path d="M16 5v3" />
      <path d="M16 24v3" />
    </svg>
  );
});

const WebIcon = memo(function WebIcon({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="9" r="2.5" />
      <circle cx="24" cy="9" r="2.5" />
      <circle cx="16" cy="22" r="2.5" />
      <path d="M10 10.5l4.5 9.5" />
      <path d="M22 10.5l-4.5 9.5" />
      <path d="M10.5 9h11" />
    </svg>
  );
});

const CueIcon = memo(function CueIcon({ size = 32 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 16v0" />
      <path d="M10 13v6" />
      <path d="M14 10v12" />
      <path d="M18 13v6" />
      <path d="M22 11v10" />
      <path d="M26 14v4" />
    </svg>
  );
});

export const ProductIcon = memo(function ProductIcon({ k, size = 32 }: { k: ProductKey; size?: number }): JSX.Element {
  switch (k) {
    case 'hone':
      return <HoneIcon size={size} />;
    case 'web':
      return <WebIcon size={size} />;
    case 'cue':
      return <CueIcon size={size} />;
    default: {
      const _exhaustive: never = k;
      throw new Error(`Unhandled product key: ${String(_exhaustive)}`);
    }
  }
});

// ── card ────────────────────────────────────────────────────────────────

interface IdentityCardProps {
  info: ProductInfo;
}

const STRIPE_STYLE: CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 1.5,
  background: 'rgb(var(--ink-rgb) / 0.85)',
};

const HEADER_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  minWidth: 0,
  flexWrap: 'wrap',
};

const ICON_WRAP_STYLE: CSSProperties = {
  flexShrink: 0,
  width: 40,
  height: 40,
  display: 'grid',
  placeItems: 'center',
  borderRadius: 6,
  background: 'rgb(var(--ink-rgb) / 0.03)',
  border: '1px solid rgb(var(--ink-rgb) / 0.07)',
  color: 'rgb(var(--ink-rgb) / 0.92)',
};

const RIGHT_COL_STYLE: CSSProperties = { flex: '1 1 0', minWidth: 0 };

const TITLE_ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 8,
  flexWrap: 'wrap',
};

const NAME_STYLE: CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: '#fff',
  letterSpacing: '-0.005em',
};

const YOU_ARE_HERE_STYLE: CSSProperties = {
  fontSize: 9,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'rgb(var(--ink-rgb) / 0.65)',
  padding: '2px 6px',
  borderRadius: 3,
  background: 'var(--ink-tint-08)',
};

const TAGLINE_RU_STYLE: CSSProperties = {
  fontSize: 13,
  color: 'rgb(var(--ink-rgb) / 0.85)',
  marginTop: 4,
  lineHeight: 1.4,
};

const TAGLINE_EN_STYLE: CSSProperties = {
  fontSize: 10.5,
  color: 'rgb(var(--ink-rgb) / 0.4)',
  marginTop: 2,
  letterSpacing: '0.02em',
};

const FEATURE_LIST_STYLE: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 5,
};

const FEATURE_ITEM_STYLE: CSSProperties = {
  fontSize: 12,
  color: 'rgb(var(--ink-rgb) / 0.72)',
  lineHeight: 1.45,
  paddingLeft: 12,
  position: 'relative',
};

const FEATURE_DOT_STYLE: CSSProperties = {
  position: 'absolute',
  left: 0,
  top: '0.55em',
  width: 4,
  height: 4,
  borderRadius: 999,
  background: 'rgb(var(--ink-rgb) / 0.4)',
};

const CTA_BTN_STYLE: CSSProperties = {
  marginTop: 'auto',
  padding: '7px 12px',
  background: 'transparent',
  border: '1px solid rgb(var(--ink-rgb) / 0.18)',
  borderRadius: 5,
  color: 'rgb(var(--ink-rgb) / 0.92)',
  fontSize: 11.5,
  letterSpacing: '0.04em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
  transition: 'border-color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard)',
};

const onCtaEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'var(--ink-tint-06)';
  e.currentTarget.style.borderColor = 'rgb(var(--ink-rgb) / 0.32)';
};
const onCtaLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.borderColor = 'rgb(var(--ink-rgb) / 0.18)';
};

export const IdentityCard = memo(function IdentityCard({ info }: IdentityCardProps): JSX.Element {
  const t = useT();
  const isCurrent = info.current === true;
  const rootStyle: CSSProperties = {
    flex: '1 1 220px',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '20px 18px',
    background: isCurrent ? 'var(--ink-tint-04)' : 'rgb(var(--ink-rgb) / 0.015)',
    border: isCurrent ? '1px solid rgb(var(--ink-rgb) / 0.22)' : '1px solid var(--ink-tint-08)',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  };

  return (
    <div style={rootStyle}>
      {isCurrent && <div aria-hidden style={STRIPE_STYLE} />}

      <div style={HEADER_ROW_STYLE}>
        <div style={ICON_WRAP_STYLE}>
          <ProductIcon k={info.key} size={22} />
        </div>
        <div style={RIGHT_COL_STYLE}>
          <div style={TITLE_ROW_STYLE}>
            <span style={NAME_STYLE}>{info.name}</span>
            {isCurrent && (
              <span className="mono" style={YOU_ARE_HERE_STYLE}>
                {t('hone.identity.you_are_here')}
              </span>
            )}
          </div>
          <div style={TAGLINE_RU_STYLE}>
            {t(info.taglineRuKey)}
          </div>
          <div className="mono" style={TAGLINE_EN_STYLE}>
            {t(info.taglineEnKey)}
          </div>
        </div>
      </div>

      <ul style={FEATURE_LIST_STYLE}>
        {info.featureKeys.map((fk) => (
          <li key={fk} style={FEATURE_ITEM_STYLE}>
            <span aria-hidden style={FEATURE_DOT_STYLE} />
            {t(fk)}
          </li>
        ))}
      </ul>

      {info.ctaLabelKey && info.onCta && !isCurrent && (
        <button
          type="button"
          onClick={info.onCta}
          className="focus-ring"
          style={CTA_BTN_STYLE}
          onMouseEnter={onCtaEnter}
          onMouseLeave={onCtaLeave}
        >
          {t(info.ctaLabelKey)} →
        </button>
      )}
    </div>
  );
});
