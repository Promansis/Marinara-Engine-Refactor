# Promansis

## Current Work

- Bug 16: First-launch tutorial does not trap keyboard focus.
  - Status: In progress
  - Last updated: 2026-05-19
  - Branch: `fix/bug-16-onboarding-focus-trap`
  - Worktree: `../Marinara-Engine-Refactor-bug16`
  - Next step: verify typecheck and tutorial keyboard focus behavior.

## Owned Bugs

## First-launch tutorial does not trap keyboard focus

- Status: In progress
- Owner: Promansis
- Impact area: UI
- Reported: 2026-05-19
- Last updated: 2026-05-19

### Steps

1. Launch the app with onboarding incomplete.
2. When the tutorial overlay appears, press `Tab` and `Shift+Tab`.
3. Continue or skip the tutorial.

### Expected

Keyboard focus stays inside the tutorial until it is skipped or completed, then focus returns to the previously focused shell control when possible.

### Actual

The tutorial appears as an overlay, but `Tab` can move focus to shell or window controls behind it.

### Notes

- Owner: `src/features/onboarding/components/OnboardingTutorial.tsx`.
- Branch: `fix/bug-16-onboarding-focus-trap`.
- Local-only worktree: `../Marinara-Engine-Refactor-bug16`.

## Status Notes

- Bug 16 keeps the fix in onboarding UI; no engine, shared API, storage, or Rust capability behavior is expected to change.
