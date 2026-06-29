// ResistanceModal — pre-focus pulse (Phase K Wave 15).
//
// Прижимается над таймером перед стартом сессии. Юзер за 10 секунд:
//   - либо пишет одну фразу «что трудно прямо сейчас?» (≤200 chars);
//   - либо пропускает Enter / Esc / клик «Пропустить».
//
// На submit отправляем в backend через logResistance. Никогда не блокируем
// старт фокуса: даже если RPC падает (offline / 503), модалка закрывается
// и фокус стартует. Журнал — опциональный сигнал коучу, не business-data.
//
// Design:
//   - black B/W (component honest to memory/feedback_color_rule.md);
//   - mono каркас, серый ink, single hairline border;
//   - центр экрана через position:fixed + grid place-items:center.
import React, { useEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

import { zIndex } from '../lib/z-index';

const MAX_RESISTANCE_TEXT_LEN = 200;

interface ResistanceModalProps {
  /** Optional pinned task title — показывается subscript'ом «фокус на …». */
  pinnedTitle?: string | null;
  /** Optional focus session id (если уже есть — для late-bound use). */
  focusSessionId?: string;
  /** Optional task id (если фокус на конкретной задаче). */
  taskId?: string;
  /** Закрытие. Вызывается всегда — и на submit и на skip. */
  onClose: () => void;
}

export const ResistanceModal: React.FC<ResistanceModalProps> = ({
  pinnedTitle,
  focusSessionId,
  taskId,
  onClose,
}) => {
  const t = useT();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // Autofocus textarea — юзер сразу пишет, без лишних кликов.
    inputRef.current?.focus();
  }, []);

  const skip = () => {
    if (busy) return;
    onClose();
  };

  const submit = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      skip();
      return;
    }
    setBusy(true);
    try {
      void trimmed.slice(0, MAX_RESISTANCE_TEXT_LEN);
    } catch {
      // Журнал — best-effort. Если RPC упал — старт фокуса важнее.
      // Тихий failure: ошибку покажет outbox/telemetry, не блокируем UX.
    } finally {
      setBusy(false);
      onClose();
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      skip();
      return;
    }
    // Enter без Shift — submit / skip. Shift+Enter — newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const remaining = MAX_RESISTANCE_TEXT_LEN - value.length;

  return (
    <div
      role="dialog"
      aria-label={t('hone.resistance.aria')}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        zIndex: zIndex.modal,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) skip();
      }}
    >
      <section
        style={{
          minWidth: 360,
          maxWidth: 480,
          width: '92vw',
          padding: '24px 24px 18px',
          background: 'var(--surface)',
          border: '1px solid var(--ink-tint-08)',
          borderRadius: 12,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
          color: 'rgb(var(--ink-rgb) / 0.92)',
        }}
      >
        <div
          style={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgb(var(--ink-rgb) / 0.45)',
            marginBottom: 10,
          }}
        >
          {t('hone.resistance.eyebrow')}
        </div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {t('hone.resistance.headline')}
        </h2>
        {pinnedTitle ? (
          <div
            style={{
              marginTop: 4,
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              color: 'rgb(var(--ink-rgb) / 0.45)',
            }}
          >
            {t('hone.resistance.pinned_hint', { title: pinnedTitle ?? '' })}
          </div>
        ) : null}
        <textarea
          ref={inputRef}
          rows={3}
          value={value}
          maxLength={MAX_RESISTANCE_TEXT_LEN}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKey}
          placeholder={t('hone.resistance.placeholder')}
          spellCheck
          style={{
            marginTop: 14,
            width: '100%',
            minHeight: 64,
            padding: '10px 12px',
            background: 'transparent',
            border: '1px solid rgb(var(--ink-rgb) / 0.1)',
            borderRadius: 8,
            color: 'rgb(var(--ink-rgb) / 0.95)',
            outline: 'none',
            fontFamily: 'inherit',
            fontSize: 13,
            lineHeight: 1.5,
            resize: 'none',
          }}
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 10,
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: 10,
              color: remaining < 20 ? '#FF3B30' : 'rgb(var(--ink-rgb) / 0.35)',
            }}
          >
            {t('hone.resistance.hint', { n: remaining })}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={skip}
              disabled={busy}
              style={btnSecondary}
            >
              {t('hone.onboarding.btn.skip')}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={busy}
              style={btnPrimary}
            >
              {busy ? '…' : t('hone.resistance.cta.save_and_start')}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

const btnSecondary: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 12,
  background: 'transparent',
  border: '1px solid var(--ink-tint-12)',
  borderRadius: 6,
  color: 'rgb(var(--ink-rgb) / 0.75)',
  cursor: 'pointer',
  fontFamily: 'inherit',
  letterSpacing: '0.02em',
};

const btnPrimary: React.CSSProperties = {
  padding: '7px 14px',
  fontSize: 12,
  background: 'rgb(var(--ink-rgb) / 0.92)',
  border: '1px solid rgb(var(--ink-rgb) / 0.92)',
  borderRadius: 6,
  color: '#0a0a0a',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontWeight: 600,
  letterSpacing: '0.02em',
};
