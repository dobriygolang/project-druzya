// Centralized custom-event names for Hone renderer.

export const HONE_EVENTS = {
  /** Sidebar → App: navigate to home. */
  navHome: 'hone:nav-home',
  /** Hotkey → Notes layout: toggle the sidebar. */
  toggleSidebar: 'hone:toggle-sidebar',
  /** Editor → Notes header: pending-write count changed. */
  syncChanged: 'hone:sync-changed',
  /** Deeplink → TaskBoard: open task drawer. */
  openTask: 'hone:open-task',
  /** Deeplink → Notes: select note by id. */
  openNote: 'hone:open-note',
  /** Notes → App: open Settings (vault unlock). */
  openSettings: 'hone:open-settings',
  /** TaskBoard → App: open palette prefilled for a day. */
  openPaletteAddTask: 'hone:open-palette-add-task',
  /** Palette → TaskBoard: refresh task list after create. */
  tasksChanged: 'hone:tasks-changed',
  /** Calendar → App: navigate to task board task. */
  navOpenTask: 'hone:nav-open-task',
  /** OAuth callback → Settings: Google Calendar connected/error. */
  googleCalendarOAuth: 'hone:google-calendar-oauth',
} as const;
