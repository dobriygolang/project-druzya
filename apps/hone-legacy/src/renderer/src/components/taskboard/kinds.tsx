// CategorizeToast. Extracted from TaskBoard.tsx so the picker chip + toast
// chip can re-render the same iconography (B/W rule: иконка несёт kind,
// цвет нулевой, не radio-color-coded).
import { memo, type CSSProperties, type JSX } from 'react';

import type { TaskKind } from '../../api/tasks';

export interface KindDef {
  label: string;
  color: string;
  // SVG path (24x24, stroke-based, lucide-style). Single path keeps card-icon
  // rendering cheap and consistent с минимализмом hone.
  path: string;
}

export const KINDS: Record<TaskKind, KindDef> = {
  algo:      { label: 'Algorithm',     color: 'rgb(var(--ink-rgb) / 0.65)', path: 'M16 18l6-6-6-6 M8 6l-6 6 6 6 M14.5 4l-5 16' },
  sysdesign: { label: 'System Design', color: 'rgb(var(--ink-rgb) / 0.55)', path: 'M9 19v-3 M15 19v-3 M9 8V5 M15 8V5 M5 11h14 M5 11v3a2 2 0 002 2h10a2 2 0 002-2v-3 M7 5h10' },
  quiz:      { label: 'Quiz',          color: 'rgb(var(--ink-rgb) / 0.75)', path: 'M12 22a10 10 0 100-20 10 10 0 000 20z M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3 M12 17h.01' },
  reflection:{ label: 'Reflection',    color: 'rgb(var(--ink-rgb) / 0.60)', path: 'M9.5 2A2.5 2.5 0 0112 4.5 2.5 2.5 0 0114.5 2 2.5 2.5 0 0117 4.5c0 .55-.18 1.06-.49 1.47A2.5 2.5 0 0118 8.5a2.5 2.5 0 01-1.5 2.29A2.5 2.5 0 0118 13.5a2.5 2.5 0 01-2.5 2.5h-.05A2.5 2.5 0 0113 18.5 2.5 2.5 0 0110.5 16H10A2.5 2.5 0 017.5 13.5 2.5 2.5 0 016 11 2.5 2.5 0 017.5 8.5 2.5 2.5 0 016 6 2.5 2.5 0 019.5 2z' },
  reading:   { label: 'Reading',       color: 'rgb(var(--ink-rgb) / 0.50)', path: 'M2 4h7a3 3 0 013 3v14a2 2 0 00-2-2H2V4z M22 4h-7a3 3 0 00-3 3v14a2 2 0 012-2h8V4z' },
  // ML — small neural net silhouette: 3 input nodes (left col), 2 hidden
  // nodes (middle col), 1 output node (right col), connected by hairlines.
  // Strict B/W monochrome stroke, same 24x24 viewbox + 1.8 stroke width
  // as the other kinds — visual weight matches existing 6-kind grid.
  ml:        { label: 'ML',            color: 'rgb(var(--ink-rgb) / 0.68)', path: 'M4 6h.01 M4 12h.01 M4 18h.01 M12 9h.01 M12 15h.01 M20 12h.01 M5 6l6 3 M5 12l6-3 M5 12l6 3 M5 18l6-3 M13 9l6 3 M13 15l6-3' },
  custom:    { label: 'Custom',        color: 'rgb(var(--ink-rgb) / 0.58)', path: 'M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z' },
};

export const ALL_KINDS: TaskKind[] = ['algo', 'sysdesign', 'quiz', 'reflection', 'reading', 'ml', 'custom'];

const ICON_STYLE: CSSProperties = { flexShrink: 0 };

// KindIcon — единая SVG-обёртка для всех мест где раньше был эмодзи.
export const KindIcon = memo(function KindIcon({
  kind, size = 14, color,
}: { kind: TaskKind; size?: number; color?: string }): JSX.Element {
  const def = KINDS[kind];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? def.color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={ICON_STYLE}
    >
      <path d={def.path} />
    </svg>
  );
});
