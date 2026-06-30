// Centralized custom-event names для Hone renderer.
//
// Keys, dispatched + listened в 3+ местах. Typo в одной из ссылок →
// беззвучный no-op (CustomEvent listener никогда не сработает), поэтому
// держим имена в одном const, а не как inline literals.
//
// Single-dispatch events (no co-located listener) остаются inline в их
// модуле — централизация только для пар dispatch↔listen.

export const HONE_EVENTS = {
  /** EcosystemSection → App: open the identity-intro modal. */
  openIdentityIntro: 'hone:open-identity-intro',
  /** Sidebar → App: navigate to home. */
  navHome: 'hone:nav-home',
  /** Outbox/sync → ConflictModal: render a conflict UI. */
  conflict: 'hone:conflict',
  /** Hotkey → Notes layout: toggle the sidebar. */
  toggleSidebar: 'hone:toggle-sidebar',
  /** Editor → Notes header: pending-write count changed. */
  syncChanged: 'hone:sync-changed',
  /** Deeplink → TaskBoard: open task drawer. */
  openTask: 'hone:open-task',
  /** Deeplink → Notes: select note by id. */
  openNote: 'hone:open-note',
  /** TaskBoard → App: open palette prefilled for a day. */
  openPaletteAddTask: 'hone:open-palette-add-task',
  /** Palette → TaskBoard: refresh task list after create. */
  tasksChanged: 'hone:tasks-changed',
  /** Theme module (lib/theme.ts) — theme switched. */
  themeChanged: 'hone:theme-changed',
} as const;

