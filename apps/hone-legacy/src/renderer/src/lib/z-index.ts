// Semantic z-index scale shared inside this app.
//
// Use these tokens instead of hard-coding numbers. Order (low → high):
//   base      — default in-flow content
//   raised    — sticky headers / sidebars inside a page
//   dropdown  — popovers, menus, floating toolbars
//   overlay   — drawer / sheet backdrops scoped to a page
//   modal     — global modals with full-viewport backdrop
//   toast     — toasts, snackbars, banners surfacing system events
//   tooltip   — tooltips, cursor labels, emergency overlays above everything
//
// Keep the scale small. If you reach for a new tier, prefer using an
// existing one — collisions usually mean two surfaces are competing for
// the same role and the fix is at the call site, not in this table.
export const zIndex = {
  base: 0,
  raised: 10,
  dropdown: 60,
  overlay: 100,
  modal: 1000,
  toast: 2000,
  tooltip: 3000,
} as const;

