# Promansis

## Current Work

- Bug 15: Mobile shell panels leave hidden content in the tab order.
  - Status: In progress
  - Last updated: 2026-05-19
  - Branch: `fix/bug-15-mobile-panel-focus`
  - Worktree: `../Marinara-Engine-Refactor-bug15`
  - Next step: verify typecheck and mobile keyboard focus behavior.

## Owned Bugs

## Mobile shell panels leave hidden content in the tab order

- Status: In progress
- Owner: Promansis
- Impact area: UI
- Reported: 2026-05-19
- Last updated: 2026-05-19

### Steps

1. Open the app at mobile width.
2. Open the left chat sidebar, tracker drawer, or right settings/tools drawer.
3. Press `Tab` or `Shift+Tab`, then press `Escape`.

### Expected

Keyboard focus stays inside the active mobile panel, closed panels and underlying page controls are not reachable, and `Escape` dismisses the active panel.

### Actual

Closed sidebars and underlying page controls can remain tabbable while another drawer is open.

### Notes

- Owner: `src/app/shell/AppShell.tsx`.
- Branch: `fix/bug-15-mobile-panel-focus`.
- Local-only worktree: `../Marinara-Engine-Refactor-bug15`.

## Status Notes

- Bug 15 keeps the fix in the shell UI layer; no engine, shared API, storage, or Rust capability behavior is expected to change.
