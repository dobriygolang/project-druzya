import { HONE_EVENTS } from '@shared/lib/custom-events';

export const DEMO_EVENTS = {
  noteSetBody: HONE_EVENTS.demoNoteSetBody,
  noteAppend: HONE_EVENTS.demoNoteAppend,
} as const;

export function demoNoteSetBody(body: string): void {
  window.dispatchEvent(new CustomEvent(DEMO_EVENTS.noteSetBody, { detail: { body } }));
}

export function demoNoteAppend(char: string): void {
  window.dispatchEvent(new CustomEvent(DEMO_EVENTS.noteAppend, { detail: { char } }));
}
