/**
 * druz9 Drawer — Hone (CSS phase-machine, no Framer Motion).
 *
 * Mirrors frontend/src/components/primitives/Drawer.tsx API.
 *
 * Phase machine:
 *   closed → open (mount → next-frame add 'is-open' class)
 *   open → closing (toggle prop) → unmount after motion.dur.medium
 *
 * Tokens: durations from _tokens.generated.css (--motion-dur-medium).
 */

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useFocusTrap } from '../../hooks/useFocusTrap';
import { motion as motionTokens } from '../../lib/design-tokens';
import { zIndex } from '../../lib/z-index';

export type DrawerSide = 'right' | 'left' | 'bottom';
export type DrawerSize = 'sm' | 'md' | 'lg' | 'full';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  side?: DrawerSide;
  size?: DrawerSize;
  title?: string;
  ariaLabel?: string;
  initialFocusRef?: RefObject<HTMLElement>;
  preventScrimClose?: boolean;
  children: ReactNode;
}

const SIZE_W: Record<DrawerSize, string> = {
  sm: '320px',
  md: '420px',
  lg: '560px',
  full: '100%',
};

const SIZE_H: Record<DrawerSize, string> = {
  sm: '50vh',
  md: '70vh',
  lg: '85vh',
  full: '100%',
};

type Phase = 'closed' | 'open' | 'closing';

export function Drawer({
  open,
  onClose,
  side = 'right',
  size = 'md',
  title,
  ariaLabel,
  initialFocusRef,
  preventScrimClose = false,
  children,
}: DrawerProps) {
  const [phase, setPhase] = useState<Phase>(open ? 'open' : 'closed');
  const closeTimerRef = useRef<number | null>(null);
  const trapRef = useFocusTrap(phase !== 'closed');
  const titleId = useId();

  // Phase transitions: closed↔open with closing intermediate to play exit anim.
  useEffect(() => {
    if (open && phase === 'closed') {
      setPhase('open');
    } else if (!open && phase === 'open') {
      setPhase('closing');
      closeTimerRef.current = window.setTimeout(() => {
        setPhase('closed');
      }, motionTokens.dur.medium);
    }
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [open, phase]);

  useEffect(() => {
    if (phase === 'closed') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  useEffect(() => {
    if (phase === 'closed') return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'open' || !initialFocusRef?.current) return;
    const id = requestAnimationFrame(() => initialFocusRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [phase, initialFocusRef]);

  if (typeof document === 'undefined' || phase === 'closed') return null;

  const isClosing = phase === 'closing';

  const scrimStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.62)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    opacity: isClosing ? 0 : 1,
    transition: `opacity ${motionTokens.dur.medium}ms var(--motion-ease-standard)`,
  };

  const offSign = side === 'left' ? '-100%' : side === 'bottom' ? '0' : '100%';
  const offAxis = side === 'bottom' ? 'translateY' : 'translateX';
  const offY = side === 'bottom' ? '100%' : '0';

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    background: 'var(--surface, #0a0a0a)',
    boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.85)',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    transform: isClosing
      ? `${offAxis}(${side === 'bottom' ? offY : offSign})`
      : `${offAxis}(0)`,
    transition: `transform ${motionTokens.dur.large}ms var(--motion-ease-emphasized)`,
  };
  if (side === 'right') {
    Object.assign(panelStyle, {
      top: 0,
      right: 0,
      bottom: 0,
      width: SIZE_W[size],
      maxWidth: '100%',
      borderLeft: '1px solid var(--hair-2)',
    });
  } else if (side === 'left') {
    Object.assign(panelStyle, {
      top: 0,
      left: 0,
      bottom: 0,
      width: SIZE_W[size],
      maxWidth: '100%',
      borderRight: '1px solid var(--hair-2)',
    });
  } else {
    Object.assign(panelStyle, {
      left: 0,
      right: 0,
      bottom: 0,
      maxHeight: SIZE_H[size],
      borderTop: '1px solid var(--hair-2)',
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    });
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: zIndex.dropdown }}>
      <div onClick={preventScrimClose ? undefined : onClose} aria-hidden="true" style={scrimStyle} />
      <div
        ref={trapRef as React.RefCallback<HTMLDivElement>}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? ariaLabel : undefined}
        style={panelStyle}
      >
        {title && (
          <h2
            id={titleId}
            style={{
              margin: 0,
              padding: '20px 24px 14px',
              fontSize: 20,
              lineHeight: 1.3,
              letterSpacing: '-0.012em',
              fontWeight: 600,
              color: 'var(--ink)',
              borderBottom: '1px solid var(--hair)',
            }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}
