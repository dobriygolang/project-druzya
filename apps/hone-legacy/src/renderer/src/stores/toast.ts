// Hosts two streams:
//   1. Auto-categorise toasts (CategorizeToast component) — surface
//      backend's «Auto-tagged as <Kind>» events. Shows reasoning peek
//      + override affordance.
//   2. Generic toasts (informational, action confirmations) — replaces
//      the per-page inline toasts that lived in TaskBoard.tsx.
//
// Toast lifecycle:
//   - showCategorize(entry) / showInfo(msg) → push.
//   - dismissToast(id)                       → manual close.
//   - Auto-dismiss after `autoDismissMs` (default 5500ms for categorise,
//     2500ms for info). Stored as deadline timestamp so a re-render
//     doesn't reset the timer.
//
// Stack limit: 3 visible. New toast pushes oldest out.

import { create } from 'zustand';

import type { TaskKind } from '../api/tasks';

// CategorizeToastEntry — payload for «Auto-tagged as <Kind>» surface.
export interface CategorizeToastEntry {
  id: string;
  kind: 'categorize';
  taskId: string;
  taskTitle: string;
  detectedKind: TaskKind;
  reasoning: string;
  confidence: number; // 0..1
  createdAt: number;
  deadline: number;
}

// InfoToastEntry — generic confirmations («Task created», «Moved to Done»).
export interface InfoToastEntry {
  id: string;
  kind: 'info';
  message: string;
  createdAt: number;
  deadline: number;
}

export type ToastEntry = CategorizeToastEntry | InfoToastEntry;

interface ToastState {
  toasts: ToastEntry[];
  showCategorize: (e: Omit<CategorizeToastEntry, 'id' | 'kind' | 'createdAt' | 'deadline'>) => string;
  showInfo: (message: string, durationMs?: number) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

// Stack cap — 3 visible. Above that we drop the oldest to keep the
// surface scannable. Aligned с UpdateToast / OfflineBanner patterns
// elsewhere в Hone — quiet, не covering the canvas.
const MAX_VISIBLE_TOASTS = 3;

// Auto-dismiss tunings — categorise toasts stay longer because they
// have actionable affordances (Why? + Override); info toasts fade
// quickly («Moved to Done» — confirmation only).
const CATEGORIZE_AUTO_DISMISS_MS = 5500;
const INFO_AUTO_DISMISS_MS = 2500;

let toastSeq = 0;
function nextId(): string {
  toastSeq += 1;
  return `t${Date.now()}-${toastSeq}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showCategorize: (entry) => {
    const id = nextId();
    const now = Date.now();
    const next: CategorizeToastEntry = {
      ...entry,
      id,
      kind: 'categorize',
      createdAt: now,
      deadline: now + CATEGORIZE_AUTO_DISMISS_MS,
    };
    set((s) => {
      // Dedup: same taskId — replace prior categorise toast (LLM may emit
      // sequence of events for one task as confidence sharpens; second
      // wins, no stale «previously thought it was X»).
      const filtered = s.toasts.filter((t) => !(t.kind === 'categorize' && t.taskId === entry.taskId));
      const combined = [...filtered, next];
      // Cap — drop oldest beyond MAX_VISIBLE_TOASTS.
      return { toasts: combined.slice(-MAX_VISIBLE_TOASTS) };
    });
    // Schedule auto-dismiss via setTimeout. Cheap (1 timer per toast) and
    // simpler than per-toast useEffect in consumer — store owns lifecycle.
    window.setTimeout(() => {
      get().dismissToast(id);
    }, CATEGORIZE_AUTO_DISMISS_MS);
    return id;
  },

  showInfo: (message, durationMs) => {
    const id = nextId();
    const now = Date.now();
    const ms = typeof durationMs === 'number' && durationMs > 0 ? durationMs : INFO_AUTO_DISMISS_MS;
    const next: InfoToastEntry = {
      id,
      kind: 'info',
      message,
      createdAt: now,
      deadline: now + ms,
    };
    set((s) => ({ toasts: [...s.toasts, next].slice(-MAX_VISIBLE_TOASTS) }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, ms);
    return id;
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  clearAll: () => set({ toasts: [] }),
}));
