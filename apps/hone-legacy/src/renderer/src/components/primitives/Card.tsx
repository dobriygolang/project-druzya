/**
 * Hone Card — desktop foundation primitive (visual-language v2).
 *
 * NEW building block. Does NOT replace existing card/panel chrome — they migrate
 * later. Mirrors web Card API; Hone palette tokens (--ink / --surface / --hair).
 *
 * Contract (visual-language v2):
 *  - 4 elevations:
 *      e0 — transparent (no bg, no border)
 *      e1 — bg var(--ink-tint-02) + 1px var(--hair) border (DEFAULT)
 *      e2 — bg #0a0a0a + 1px var(--hair-2) + soft drop shadow
 *      e3 — bg #0a0a0a + 1px var(--hair-2) + deep window-shadow (Modal/Drawer use)
 *  - `lift`: hover translateY(-1px) + border opacity 8% → 14%
 *  - `signal`:
 *      'active' / 'live' → 1.5×24px var(--red) left stripe vertically centered;
 *         'live' adds `.red-pulse` breathing animation
 *      'error' → 1.5px var(--red) border decays back to hair-2 over 1200ms
 *  - `padding`: sm 12 / md 16 / lg 24 (default md)
 *  - `as`: 'div' (default) | 'article' | 'section' | 'button'
 *  - A11y: `as='button'` OR onClick → role="button" + tabIndex=0 + Enter/Space activate
 */

import {
  forwardRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';

export type CardElevation = 'e0' | 'e1' | 'e2' | 'e3';
export type CardLift = boolean;
export type CardSignal = 'none' | 'active' | 'live' | 'error';

export interface CardProps {
  elevation?: CardElevation;
  lift?: CardLift;
  signal?: CardSignal;
  padding?: 'sm' | 'md' | 'lg';
  as?: 'div' | 'article' | 'section' | 'button';
  onClick?: () => void;
  className?: string;
  children: ReactNode;
}

const PAD_MAP: Record<NonNullable<CardProps['padding']>, number> = {
  sm: 12,
  md: 16,
  lg: 24,
};

interface ElevationStyle {
  background: string;
  border: string;
  boxShadow: string | undefined;
}

function elevationStyle(
  elevation: CardElevation,
  hovered: boolean,
  lift: boolean,
): ElevationStyle {
  switch (elevation) {
    case 'e0':
      return { background: 'transparent', border: '1px solid transparent', boxShadow: undefined };
    case 'e1':
      return {
        background: 'rgb(var(--ink-rgb) / 0.02)',
        border: `1px solid ${hovered && lift ? 'var(--hair-2)' : 'var(--hair)'}`,
        boxShadow: undefined,
      };
    case 'e2':
      return {
        background: 'var(--surface)',
        border: '1px solid var(--hair-2)',
        boxShadow: '0 8px 24px -8px rgba(0, 0, 0, 0.4)',
      };
    case 'e3':
      return {
        background: 'var(--surface)',
        border: '1px solid var(--hair-2)',
        boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.85)',
      };
  }
}

export const Card = forwardRef<HTMLElement, CardProps>(function Card(
  {
    elevation = 'e1',
    lift = false,
    signal = 'none',
    padding = 'md',
    as = 'div',
    onClick,
    className,
    children,
  },
  ref,
) {
  const [hovered, setHovered] = useState(false);
  const elev = elevationStyle(elevation, hovered, lift);

  const isInteractive = as === 'button' || typeof onClick === 'function';
  const showStripe = signal === 'active' || signal === 'live';
  const isError = signal === 'error';

  const baseStyle: CSSProperties = {
    position: 'relative',
    background: elev.background,
    border: isError ? `1.5px solid var(--red)` : elev.border,
    borderRadius: 'var(--radius-outer, 14px)',
    padding: PAD_MAP[padding],
    boxShadow: elev.boxShadow,
    color: 'var(--ink)',
    transform: lift && hovered ? 'translateY(-1px)' : undefined,
    transition:
      'transform var(--motion-dur-small) var(--motion-ease-standard), ' +
      'border-color var(--motion-dur-cinematic) var(--motion-ease-decelerate), ' +
      'box-shadow var(--motion-dur-small) var(--motion-ease-standard)',
    cursor: isInteractive ? 'pointer' : undefined,
    appearance: as === 'button' ? 'none' : undefined,
    font: as === 'button' ? 'inherit' : undefined,
    textAlign: as === 'button' ? 'inherit' : undefined,
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!isInteractive || !onClick) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  const interactiveProps = isInteractive
    ? {
        role: as === 'button' ? undefined : 'button',
        tabIndex: 0,
        onClick,
        onKeyDown: handleKeyDown,
      }
    : {};

  const hoverProps = lift
    ? {
        onMouseEnter: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
        onFocus: () => setHovered(true),
        onBlur: () => setHovered(false),
      }
    : {};

  const stripe = showStripe ? (
    <span
      aria-hidden
      className={signal === 'live' ? 'red-pulse' : undefined}
      style={{
        position: 'absolute',
        left: 0,
        top: '50%',
        transform: 'translateY(-50%)',
        width: 1.5,
        height: 24,
        background: 'var(--red)',
        pointerEvents: 'none',
      }}
    />
  ) : null;

  const commonProps = {
    ref: ref as Ref<HTMLDivElement & HTMLButtonElement & HTMLElement>,
    className,
    style: baseStyle,
    ...interactiveProps,
    ...hoverProps,
  };

  if (as === 'button') {
    return (
      <button type="button" {...commonProps}>
        {stripe}
        {children}
      </button>
    );
  }
  if (as === 'article') {
    return (
      <article {...commonProps}>
        {stripe}
        {children}
      </article>
    );
  }
  if (as === 'section') {
    return (
      <section {...commonProps}>
        {stripe}
        {children}
      </section>
    );
  }
  return (
    <div {...commonProps}>
      {stripe}
      {children}
    </div>
  );
});
