# Source Inventory

Use this file as the guardrail for implementation slices. Every file from the original app must be moved, mapped, deferred, or explicitly approved for removal.

Original source root: `E:/Personal Projects/Marinara-Engine`.

## Frontend Sources

Source: `packages/client`.

Track these groups during frontend slices:

- `src/components/layout`: app shell, top bar, sidebars, modal root, theme injector.
- `src/components/panels`: settings and feature panels.
- `src/components/ui`: reusable UI primitives and shared controls.
- `src/components/modals`: modal bodies owned by their feature modules.
- `src/components/chat`: chat, conversation, roleplay, gallery, scene, and prompt preview UI.
- `src/components/game`: game mode UI.
- `src/components/agents`: agents, tools, regex, context, and debug UI.
- `src/components/bot-browser`, `characters`, `connections`, `lorebooks`, `onboarding`, `personas`, `presets`, `spotify`: feature-owned UI.
- `src/hooks`: migrate with the feature that owns the behavior.
- `src/stores`: migrate with the feature or app/shared state boundary that owns the data.
- `src/lib`: keep frontend-only helpers in React; move filesystem, secret, provider, import, and backend behavior to Rust.
- `src/styles`: global styles and themes.
- `public`: copy assets only when the slice that renders them moves.

## Backend Sources

Source: `packages/server` and `packages/shared`.

Track these groups during Rust backend slices:

- `src/routes`: route behavior maps to Tauri commands and Rust services.
- `src/services`: service behavior maps to Rust domain modules.
- `src/services/storage`: repository behavior maps to raw file-backed Rust repositories.
- `src/db`: use only as source metadata for the current file-native shapes; do not port SQL, Drizzle, SQLite, or migrations.
- `src/middleware`: map relevant protections to Tauri capabilities, command validation, filesystem policy, outbound URL policy, and secret handling.
- `src/utils`, `src/config`, `src/lib`: map useful behavior to `core`, `security`, or owning domain modules.
- `packages/shared/src/types`, `schemas`, `constants`, `utils`: map to Rust domain DTOs, generated TypeScript bindings, or frontend-only helpers.
- `assets`: copy defaults only when the owning feature slice needs them.
- `scripts`, platform folders, installer/launcher support: account for them during sidecar, updates, packaging, and sync phases.
- `tests`: use as behavior references for Rust service/repository tests.

## Required Slice Update

Each slice handoff must list source inventory status:

- moved
- mapped to a new module
- deferred with reason
- removed with explicit approval

Do not leave a touched source area unaccounted for.
