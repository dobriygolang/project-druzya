/**
 * Hone Modal — CSS-class motion (no Framer Motion in Electron renderer).
 *
 * Replaces ad-hoc modals: AddResourceModal, AskNotesModal, ExternalActivityModal,
 * OnboardingModal, plus inline modals in Listening/Reading.
 *
 * Contract:
 *  - Focus trap while open (useFocusTrap)
 *  - Escape closes; scrim click closes (unless preventScrimClose)
 *  - Body scroll locked while open
 *  - Focus restored on close
 *  - Two-phase mount: phase = 'opening' → 'open' → 'closing' → unmount
 *    so .motion-modal-out + .motion-scrim-out exit animations play before unmount
 *  - aria-modal, role=dialog, aria-labelledby/describedby
 *  - Portal to document.body
 */

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useFocusTrap } from '@shared/hooks/useFocusTrap';
import { motion } from '@shared/lib/design-tokens';
import { zIndex } from '@shared/lib/z-index';

export type ModalSize = 'sm' | 'md' | 'lg' | 'full';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  size?: ModalSize;
  initialFocusRef?: RefObject<HTMLElement>;
  preventScrimClose?: boolean;
  children: ReactNode;
}

const SIZE_MAX_W: Record<ModalSize, number> = {
  sm: 480,
  md: 560,
  lg: 720,
  full: 960,
};

type Phase = 'closed' | 'open' | 'closing';

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  initialFocusRef,
  preventScrimClose = false,
  children,
}: ModalProps) {
  const [phase, setPhase] = useState<Phase>('closed');
  const titleId = useId();
  const descId = useId();
  const closeTimerRef = useRef<number | null>(null);

  // Open / close phase machine
  useEffect(() => {
    if (open) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setPhase('open');
      return;
    }
    if (phase === 'open') {
      setPhase('closing');
      closeTimerRef.current = window.setTimeout(() => {
        setPhase('closed');
        closeTimerRef.current = null;
      }, motion.dur.medium);
    }
  }, [open, phase]);

  const visible = phase !== 'closed';
  const trapRef = useFocusTrap(visible && phase === 'open');

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [visible]);

  useEffect(() => {
    if (phase !== 'open' || !initialFocusRef?.current) return;
    const id = requestAnimationFrame(() => {
      initialFocusRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [phase, initialFocusRef]);

  if (!visible || typeof document === 'undefined') return null;

  const exiting = phase === 'closing';

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: zIndex.overlay }}>
      <div
        className={exiting ? 'motion-scrim-out' : 'motion-scrim-in'}
        onClick={preventScrimClose ? undefined : onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.62)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: '64px 16px',
          pointerEvents: 'none',
          overflowY: 'auto',
        }}
      >
        <div
          ref={trapRef as React.RefCallback<HTMLDivElement>}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descId : undefined}
          className={exiting ? 'motion-modal-out' : 'motion-modal-in'}
          style={{
            position: 'relative',
            maxWidth: SIZE_MAX_W[size],
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--hair-2)',
            borderRadius: 'var(--radius-outer, 14px)',
            padding: 'var(--pad-container, 32px)',
            pointerEvents: 'auto',
            boxShadow: '0 24px 64px -16px rgba(0, 0, 0, 0.85)',
            color: 'var(--ink)',
          }}
        >
          {title && (
            <h2
              id={titleId}
              style={{
                margin: 0,
                marginBottom: description ? 8 : 16,
                fontSize: 'var(--type-h2-size)',
                lineHeight: 'var(--type-h2-lh)',
                letterSpacing: 'var(--type-h2-ls)',
                fontWeight: 'var(--type-h2-weight)',
                color: 'var(--ink)',
              }}
            >
              {title}
            </h2>
          )}
          {description && (
            <p
              id={descId}
              style={{
                margin: 0,
                marginBottom: 24,
                fontSize: 'var(--type-body-size)',
                lineHeight: 'var(--type-body-lh)',
                color: 'var(--ink-60)',
              }}
            >
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
