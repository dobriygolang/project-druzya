// Generic info toasts for TaskBoard confirmations.

import { create } from 'zustand';

export interface InfoToastEntry {
  id: string;
  message: string;
  createdAt: number;
  deadline: number;
}

interface ToastState {
  toasts: InfoToastEntry[];
  showInfo: (message: string, durationMs?: number) => string;
  dismissToast: (id: string) => void;
  clearAll: () => void;
}

const MAX_VISIBLE_TOASTS = 3;
const INFO_AUTO_DISMISS_MS = 2500;

let toastSeq = 0;
function nextId(): string {
  toastSeq += 1;
  return `t${Date.now()}-${toastSeq}`;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],

  showInfo: (message, durationMs) => {
    const id = nextId();
    const now = Date.now();
    const ms = typeof durationMs === 'number' && durationMs > 0 ? durationMs : INFO_AUTO_DISMISS_MS;
    const next: InfoToastEntry = {
      id,
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
