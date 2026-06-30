import { useEffect, useMemo, useRef, useState } from 'react';

import { useLocale, useT, localeToBcp47 } from '@d9-i18n';

import { zIndex } from '@shared/lib/z-index';
import { formatTimeShort } from './lib/dates';

const DEFAULT_STEP_MIN = 30;
const DEFAULT_START_H = 7;
const DEFAULT_END_H = 21;

function buildTimeOptions(
  locale: 'en' | 'ru',
  stepMin: number,
  startHour: number,
  endHour: number,
): Array<{ h: number; m: number; label: string }> {
  const tag = localeToBcp47(locale);
  const out: Array<{ h: number; m: number; label: string }> = [];
  for (let h = startHour; h <= endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      const totalMin = h * 60 + m;
      const maxMin = endHour * 60 + (stepMin < 60 ? 60 - stepMin : 0);
      if (totalMin > maxMin) break;
      const d = new Date(2000, 0, 1, h, m);
      out.push({
        h,
        m,
        label: d.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' }),
      });
    }
  }
  return out;
}

function withSelectedTime(
  options: Array<{ h: number; m: number; label: string }>,
  value: Date | null,
  locale: 'en' | 'ru',
): Array<{ h: number; m: number; label: string }> {
  if (!value) return options;
  const key = `${value.getHours()}:${value.getMinutes()}`;
  if (options.some((o) => `${o.h}:${o.m}` === key)) return options;
  const tag = localeToBcp47(locale);
  const d = new Date(2000, 0, 1, value.getHours(), value.getMinutes());
  const extra = {
    h: value.getHours(),
    m: value.getMinutes(),
    label: d.toLocaleTimeString(tag, { hour: 'numeric', minute: '2-digit' }),
  };
  return [...options, extra].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
}

interface TimePickerProps {
  value: Date | null;
  day: Date;
  disabled?: boolean;
  inline?: boolean;
  stepMin?: number;
  startHour?: number;
  endHour?: number;
  onChange: (next: Date) => void;
}

export function TimePicker({
  value,
  day,
  disabled,
  inline,
  stepMin = DEFAULT_STEP_MIN,
  startHour = DEFAULT_START_H,
  endHour = DEFAULT_END_H,
  onChange,
}: TimePickerProps): JSX.Element {
  const t = useT();
  const [locale] = useLocale();
  const timeOptions = useMemo(
    () => withSelectedTime(buildTimeOptions(locale, stepMin, startHour, endHour), value, locale),
    [locale, stepMin, startHour, endHour, value],
  );
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const display = value ? formatTimeShort(value, locale) : '—';

  const activeKey = useMemo(() => {
    if (!value) return null;
    return `${value.getHours()}:${value.getMinutes()}`;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || inline || !listRef.current || !activeKey) return;
    const el = listRef.current.querySelector(`[data-time="${activeKey}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [open, inline, activeKey]);

  const timeAria = t('hone.taskboard.time_aria');

  const renderOptions = () =>
    timeOptions.map(({ h, m, label }) => {
      const key = `${h}:${m}`;
      const active = activeKey === key;
      return (
        <button
          key={key}
          type="button"
          data-time={key}
          role="option"
          aria-selected={active}
          onClick={(e) => {
            e.stopPropagation();
            const next = new Date(day);
            next.setHours(h, m, 0, 0);
            onChange(next);
            if (!inline) setOpen(false);
          }}
          className="mono"
          style={{
            display: 'block',
            width: '100%',
            border: 'none',
            background: active ? 'rgb(var(--ink-rgb) / 0.1)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-60)',
            fontSize: 11,
            textAlign: inline ? 'center' : 'left',
            padding: inline ? '5px 4px' : '6px 12px',
            borderRadius: inline ? 4 : 0,
            cursor: 'pointer',
          }}
        >
          {label}
        </button>
      );
    });

  const menuStyle: React.CSSProperties = inline
    ? {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 2,
        width: 136,
        maxHeight: 168,
        overflowY: 'auto',
        padding: 4,
      }
    : {
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        width: 88,
        maxHeight: 176,
        overflowY: 'auto',
        padding: '4px 0',
        background: 'rgb(22 22 22 / 0.98)',
        border: '1px solid rgb(var(--ink-rgb) / 0.1)',
        borderRadius: 8,
        boxShadow: '0 12px 32px rgb(0 0 0 / 0.45)',
        zIndex: zIndex.dropdown,
      };

  if (inline) {
    return (
      <div ref={listRef} role="listbox" aria-label={timeAria} style={menuStyle}>
        {renderOptions()}
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        className="mono"
        style={{
          border: 'none',
          background: open ? 'rgb(var(--ink-rgb) / 0.08)' : 'transparent',
          color: 'var(--ink-40)',
          opacity: value ? 1 : 0.45,
          fontSize: 10,
          padding: '2px 4px',
          borderRadius: 4,
          cursor: disabled ? 'default' : 'pointer',
          minWidth: 44,
          textAlign: 'center',
        }}
      >
        {display}
      </button>

      {open && (
        <div ref={listRef} role="listbox" aria-label={timeAria} style={menuStyle}>
          {renderOptions()}
        </div>
      )}
    </div>
  );
}
