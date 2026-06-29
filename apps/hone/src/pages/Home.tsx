import { memo, useEffect, useRef, useState } from 'react';

import type { ReflectionPrompt } from '../hooks/useFocusSession';

const APP_VERSION = 'v0.1.0';

interface HomePageProps {
  running: boolean;
  remain: number;
  pinnedTitle: string | null;
  reflectionPrompt: ReflectionPrompt | null;
  onStop: () => void;
  onSubmitReflection: (text: string, grade: number) => void | Promise<void>;
  onDismissReflection: () => void;
}

const captionMono: React.CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--ink-40)',
};

function homeArePropsEqual(a: HomePageProps, b: HomePageProps): boolean {
  if (a.running !== b.running) return false;
  if (a.pinnedTitle !== b.pinnedTitle) return false;
  if (a.reflectionPrompt !== b.reflectionPrompt) return false;
  if (!a.running && !b.running) return true;
  return a.remain === b.remain;
}

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
  const mm = String(Math.floor(remain / 60)).padStart(2, '0');
  const ss = String(remain % 60).padStart(2, '0');
  const metaClock = running ? `${mm}${ss}` : '0000';

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-brand">
          <h1 className="home-brand-name">HONE</h1>
          <span className="home-brand-rule" aria-hidden />
          <p className="home-brand-sub">focus workspace</p>
        </div>
        <div className="home-meta" aria-hidden>
          <span className="home-meta-line">{metaClock}</span>
          <span className="home-meta-line">{APP_VERSION}</span>
        </div>
      </header>

      {!running && !reflectionPrompt && (
        <div className="home-idle">
          <p className="home-idle-hint">Press play to begin a focus session.</p>
        </div>
      )}

      {pinnedTitle && (running || remain < 25 * 60) && (
        <div className="home-pinned" style={captionMono}>
          <span aria-hidden="true" className="home-pinned-stripe" />
          <span>Working on · {pinnedTitle.toUpperCase()}</span>
        </div>
      )}

      {running && (
        <button type="button" className="home-stop-btn" onClick={onStop}>
          Stop
        </button>
      )}

      {reflectionPrompt && (
        <ReflectionInline
          prompt={reflectionPrompt}
          onSubmit={onSubmitReflection}
          onDismiss={onDismissReflection}
        />
      )}
    </div>
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
  const [value, setValue] = useState('');
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

  const mins = Math.round(prompt.secondsFocused / 60);

  return (
    <div className="home-reflection" role="dialog" aria-label="Reflection note">
      <div style={{ ...captionMono, display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" className="home-reflection-dot" />
        <span>{mins} min done · optional note</span>
      </div>
      <div role="radiogroup" aria-label="Session grade" className="home-grade-row">
        <span style={{ ...captionMono, fontSize: 10 }}>Grade</span>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={grade === n}
            disabled={submitting}
            onClick={() => setGrade(grade === n ? 0 : n)}
            className={grade === n ? 'home-grade active' : 'home-grade'}
          >
            {n}
          </button>
        ))}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !submitting) {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onDismiss();
          }
        }}
        placeholder="How did it go?"
        disabled={submitting}
        className="home-reflection-input"
      />
      <div className="home-reflection-actions">
        <button type="button" className="home-reflection-dismiss" disabled={submitting} onClick={onDismiss}>
          Dismiss
        </button>
        <button
          type="button"
          className="home-reflection-save"
          disabled={submitting || (!value.trim() && grade === 0)}
          onClick={() => void submit()}
        >
          {submitting ? '…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
