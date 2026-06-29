// DayShutdownModal — end-of-day shutdown ritual (local-only until backend lands).

import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { useT, translate } from '@d9-i18n';

import { zIndex } from '../lib/z-index';

const STORAGE_KEY = 'hone:day-shutdown:v1';

export interface DayShutdown {
  done: string;
  pending: string;
  tomorrow: string;
  recordedAt: string;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readToday(): { recorded: boolean; shutdown: DayShutdown | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { recorded: false, shutdown: null };
    const parsed = JSON.parse(raw) as DayShutdown;
    if (parsed.recordedAt?.slice(0, 10) !== todayKey()) {
      return { recorded: false, shutdown: null };
    }
    return { recorded: true, shutdown: parsed };
  } catch {
    return { recorded: false, shutdown: null };
  }
}

function saveToday(entry: Omit<DayShutdown, 'recordedAt'>): void {
  const payload: DayShutdown = { ...entry, recordedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

interface DayShutdownModalProps {
  open: boolean;
  onClose: () => void;
}

export function DayShutdownModal({ open, onClose }: DayShutdownModalProps) {
  const t = useT();
  const PROMPT_DONE = t('hone.day_shutdown.prompt.done');
  const PROMPT_PENDING = t('hone.day_shutdown.prompt.pending');
  const PROMPT_TOMORROW = t('hone.day_shutdown.prompt.tomorrow');
  const [done, setDone] = useState('');
  const [pending, setPending] = useState('');
  const [tomorrow, setTomorrow] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const snap = readToday();
    if (snap.recorded && snap.shutdown) {
      setDone(snap.shutdown.done);
      setPending(snap.shutdown.pending);
      setTomorrow(snap.shutdown.tomorrow);
    }
  }, [open]);

  const handleSubmitRef = useRef<() => void>(() => {});
  const onCloseRef = useRef(onClose);
  const submittingRef = useRef(submitting);
  useEffect(() => {
    handleSubmitRef.current = () => void handleSubmit();
    onCloseRef.current = onClose;
    submittingRef.current = submitting;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!submittingRef.current) onCloseRef.current();
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !submittingRef.current) {
        e.preventDefault();
        handleSubmitRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSubmit = async () => {
    const d = done.trim();
    const p = pending.trim();
    const tw = tomorrow.trim();
    if (!d && !p && !tw) {
      setError(translate('hone.day_shutdown.modal.err.empty'));
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      saveToday({ done: d, pending: p, tomorrow: tw });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: zIndex.modal,
        background: 'rgba(0,0,0,0.55)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
      onClick={() => !submitting && onClose()}
    >
      <div
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(520px, 100%)',
          background: 'var(--surface)',
          border: '1px solid var(--hair-2)',
          borderRadius: 14,
          padding: 24,
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 16 }}>{t('hone.day_shutdown.modal.title')}</h2>
        {error && <p style={{ color: '#FF3B30', fontSize: 12 }}>{error}</p>}
        <label style={labelStyle}>{PROMPT_DONE}</label>
        <textarea value={done} onChange={(e) => setDone(e.target.value)} style={areaStyle} rows={3} />
        <label style={labelStyle}>{PROMPT_PENDING}</label>
        <textarea value={pending} onChange={(e) => setPending(e.target.value)} style={areaStyle} rows={3} />
        <label style={labelStyle}>{PROMPT_TOMORROW}</label>
        <textarea value={tomorrow} onChange={(e) => setTomorrow(e.target.value)} style={areaStyle} rows={3} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} disabled={submitting}>cancel</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={submitting}>save</button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--ink-60)',
  marginBottom: 6,
  marginTop: 12,
};

const areaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  borderRadius: 8,
  border: '1px solid var(--hair-2)',
  background: 'transparent',
  color: 'var(--ink)',
  padding: 10,
  fontSize: 13,
  resize: 'vertical',
};
