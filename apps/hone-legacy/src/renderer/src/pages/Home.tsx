// Home — landing page. Минималистичная: CanvasBg + Dock несут UI.
//
// После Focus refactor (apr 2026) Home получает три тонких overlay'а:
//   1. Pinned-task — подсказка «Working on …» если есть привязка из Today
//   2. Soft-timer — большой mm:ss в центре когда running, без агрессии
//      (не red, не pulsate); если не running — пусто как раньше
//   3. Reflection-prompt — после auto-end таймера, inline в нижнем правом
//      углу, не модалка-блокер

import { memo, useEffect, useRef, useState } from 'react';

import { useT } from '@d9-i18n';

interface ReflectionPrompt {
  sessionId: string;
  secondsFocused: number;
  pomodorosCompleted: number;
}

interface HomePageProps {
  running: boolean;
  remain: number;
  pinnedTitle: string | null;
  reflectionPrompt: ReflectionPrompt | null;
  onStop: () => void;
  onSubmitReflection: (text: string, grade: number) => void | Promise<void>;
  onDismissReflection: () => void;
}

function homeArePropsEqual(a: HomePageProps, b: HomePageProps): boolean {
  if (a.running !== b.running) return false;
  if (a.pinnedTitle !== b.pinnedTitle) return false;
  if (a.reflectionPrompt !== b.reflectionPrompt) return false;
  if (a.onStop !== b.onStop) return false;
  if (a.onSubmitReflection !== b.onSubmitReflection) return false;
  if (a.onDismissReflection !== b.onDismissReflection) return false;
  // Idle — remain не visible, не triggerим re-render.
  if (!a.running && !b.running) return true;
  // Running — full equality on remain (1Hz tick → 60 re-renders/min on Home,
  // acceptable trade-off для visible persistent timer).
  return a.remain === b.remain;
}

const captionMono: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

export const HomePage = memo(HomePageImpl, homeArePropsEqual);

function HomePageImpl({
  running,
  remain,
  pinnedTitle,
  reflectionPrompt,
  onStop,
  onSubmitReflection,
  onDismissReflection,
}: HomePageProps) {
  const t = useT();
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');

  return (
    <>
      {pinnedTitle && (running || remain < 25 * 60) && (
        <div
          className="motion-page-in"
          style={{
            ...captionMono,
            position: 'absolute',
            top: 100,
            left: 0,
            right: 0,
            textAlign: 'center',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 10,
          }}
        >
          {/* v2 signature — red signal stripe before "WORKING ON" denotes live focus. */}
          <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: 1.5, background: 'var(--red)' }} />
          <span>WORKING ON · {pinnedTitle.toUpperCase()}</span>
        </div>
      )}

      {/* R10 (Phase A 2026-05-12) — subtle persistent timer на верхнем-правом
          углу. Не агрессивный (был big-center variant который Sergey удалил
          раньше): теперь это quiet mono-font hint для periferal vision.
          Только когда running; в idle — invisible. */}
      {running && (
        <div
          aria-live="off"
          style={{
            position: 'absolute',
            top: 36,
            right: 36,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 11,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.08em',
            color: 'var(--ink-40)',
            pointerEvents: 'none',
            userSelect: 'none',
            opacity: 0.7,
          }}
          title={t('hone.home.timer_title', { mm, ss })}
        >
          {mm}:{ss}
        </div>
      )}

      {running && (
        <button
          onClick={onStop}
          className="focus-ring motion-press"
          style={{
            position: 'absolute',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '7px 16px',
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ink-60)',
            border: '1px solid var(--hair-2)',
            borderRadius: 999,
            background: 'transparent',
            cursor: 'pointer',
            transition:
              'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgb(var(--ink-rgb) / 0.05)';
            e.currentTarget.style.color = 'var(--ink)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--ink-60)';
          }}
        >
          STOP
        </button>
      )}

      {reflectionPrompt && (
        <ReflectionInline
          prompt={reflectionPrompt}
          onSubmit={onSubmitReflection}
          onDismiss={onDismissReflection}
        />
      )}
    </>
  );
}

function ReflectionInline({
  prompt,
  onSubmit,
  onDismiss,
}: {
  prompt: ReflectionPrompt;
  onSubmit: (text: string, grade: number) => void | Promise<void>;
  onDismiss: () => void;
}) {
  const t = useT();
  const [value, setValue] = useState('');
  // Юзер может submit'ить только notes без grade — тогда grade=0 уезжает,
  // backend сохраняет NULL в grade column.
  const [grade, setGrade] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(value, grade);
    } finally {
      setSubmitting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !submitting) {
      e.preventDefault();
      void submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onDismiss();
    }
    // Quick-select grade via number keys 1-5 while focused on input.
    if (!submitting && /^[1-5]$/.test(e.key)) {
      const candidate = parseInt(e.key, 10);
      if (Number.isFinite(candidate)) {
        e.preventDefault();
        setGrade((g) => (g === candidate ? 0 : candidate));
      }
    }
  };

  const mins = Math.round(prompt.secondsFocused / 60);

  return (
    <div
      className="motion-modal-in"
      role="dialog"
      aria-label="Reflection note"
      style={{
        position: 'absolute',
        bottom: 100,
        right: 32,
        maxWidth: 380,
        minWidth: 320,
        padding: '16px 18px',
        background: 'rgba(8, 8, 8, 0.92)',
        border: '1px solid var(--hair-2)',
        borderRadius: 'var(--radius-outer)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <div style={{ ...captionMono, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        {/* Red signal dot — "live reflection moment", not decorative. */}
        <span aria-hidden="true" style={{ display: 'inline-block', width: 5, height: 5, borderRadius: 999, background: 'var(--red)' }} />
        <span>{mins} MIN DONE · OPTIONAL NOTE</span>
      </div>
      {/* H2 (Phase J 2026-05-12) — grade picker. Hairline-bordered 1-5 dots,
          mono captions. B/W only, никакого colour-coding по value (хотя
          градиент по shade удобен для сканирования). */}
      <div
        role="radiogroup"
        aria-label="Session grade"
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={{ ...captionMono, fontSize: 10, color: 'var(--ink-40)', marginRight: 4 }}>
          GRADE
        </span>
        {[1, 2, 3, 4, 5].map((n) => {
          const active = grade === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`Grade ${n} of 5`}
              disabled={submitting}
              onClick={() => setGrade(active ? 0 : n)}
              className="focus-ring motion-press"
              style={{
                width: 22,
                height: 22,
                padding: 0,
                fontSize: 11,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontWeight: 600,
                color: active ? 'var(--ink)' : 'var(--ink-60)',
                background: active ? 'rgb(var(--ink-rgb) / 0.10)' : 'transparent',
                border: `1px solid ${active ? 'var(--ink)' : 'var(--hair-2)'}`,
                borderRadius: 999,
                cursor: submitting ? 'not-allowed' : 'pointer',
                transition:
                  'background-color var(--motion-dur-small) var(--motion-ease-standard), color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard)',
              }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKey}
        placeholder={t('hone.home.reflection.placeholder')}
        disabled={submitting}
        aria-label="Reflection note"
        style={{
          marginTop: 12,
          width: '100%',
          fontSize: 14,
          color: 'var(--ink)',
          padding: '6px 0',
          border: 0,
          borderBottom: '1px solid var(--hair-2)',
          background: 'transparent',
          outline: 'none',
          transition: 'border-color var(--motion-dur-small) var(--motion-ease-decelerate)',
        }}
        onFocus={(e) => (e.currentTarget.style.borderBottomColor = 'var(--ink)')}
        onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'var(--hair-2)')}
      />
      <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onDismiss}
          disabled={submitting}
          className="focus-ring motion-press"
          style={{
            ...captionMono,
            padding: '6px 12px',
            background: 'transparent',
            border: 0,
            cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'color var(--motion-dur-small) var(--motion-ease-standard)',
          }}
          onMouseEnter={(e) => {
            if (!submitting) e.currentTarget.style.color = 'var(--ink-60)';
          }}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ink-40)')}
        >
          DISMISS
        </button>
        <button
          onClick={() => void submit()}
          // Plain dismiss = explicit decline; SAVE on either lever closes loop.
          disabled={submitting || (!value.trim() && grade === 0)}
          className="focus-ring motion-press"
          style={{
            ...captionMono,
            padding: '6px 14px',
            color: value.trim() || grade > 0 ? 'var(--ink)' : 'var(--ink-40)',
            border: '1px solid var(--hair-2)',
            borderRadius: 999,
            background: 'transparent',
            cursor: submitting || (!value.trim() && grade === 0) ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.6 : 1,
            transition:
              'color var(--motion-dur-small) var(--motion-ease-standard), background-color var(--motion-dur-small) var(--motion-ease-standard), border-color var(--motion-dur-small) var(--motion-ease-standard), transform var(--motion-dur-small) var(--motion-ease-standard)',
          }}
        >
          {submitting ? '…' : 'SAVE ↵'}
        </button>
      </div>
    </div>
  );
}
